-- ELDENELE — İlan kaldırma (`delete_listing`)
--
-- Tamamı `bekle`/`bekle_esit` ile: iddia tutmazsa test düşer.
--
-- Kritik iddialar: 3 (başkasının ilanı kaldırılamaz **ve** varlığı ele
-- verilmez), 5 (süren takası olan ilan kaldırılamaz) ve 6 (kaldırılan ilan
-- başkalarının sepetinden düşer).

\set s 'aa11aa11-0000-0000-0000-00000000c001'
\set y 'aa11aa11-0000-0000-0000-00000000c002'

\echo ''
\echo '=== Hazırlık ==='
insert into auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data)
values (:'s', 'silen@example.com',  '+905558890001', now(), '{"full_name":"Deniz Arı"}'::jsonb),
       (:'y', 'yabanci@example.com','+905558890002', now(), '{"full_name":"Yabancı Kişi"}'::jsonb)
on conflict (id) do nothing;

set session role authenticated;
select set_config('test.uid', :'s', false);

\echo ''
\echo '=== 1) Taslak ilan kaldırılır ==='
select id from create_listing('Kaldırılacak taslak', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset t_
select delete_listing(:'t_id');
select bekle_esit('taslak REMOVED oldu',
                  (select status from products where id = :'t_id'), 'REMOVED');

\echo ''
\echo '=== 2) İkinci kez kaldırmak hata değil ==='
-- Kullanıcı listeyi tazelemeden ikinci kez basabilir; "zaten kaldırıldı"
-- diye hata vermek, istenen sonuç zaten oluşmuşken kusur bildirmek olurdu.
select delete_listing(:'t_id');
select bekle_esit('durum değişmedi',
                  (select status from products where id = :'t_id'), 'REMOVED');

\echo ''
\echo '=== 3) BAŞKASININ İLANI KALDIRILAMAZ ==='
-- Sahiplik `where`de: mesaj "bulunamadı", "senin değil" değil. İkincisi o
-- kimlikte bir ilan olduğunu doğrulardı.
select id from create_listing('Sahibinin ilanı', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset b_
select set_config('test.uid', :'y', false);
select set_config('test.pid', :'b_id', false);
do $$
declare pid text := current_setting('test.pid');
begin
  perform delete_listing(pid);
  raise notice 'SONUÇ: HATA — yabancı ilanı kaldırdı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select set_config('test.uid', :'s', false);
select bekle_esit('yabancı kaldıramadı',
                  (select status from products where id = :'b_id'), 'DRAFT');

\echo ''
\echo '=== 4) Yayındaki ilan kaldırılır ==='
select id from create_listing('Yayındaki ilan', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset a_
insert into product_photos (product_id, slot, storage_path)
select :'a_id', s, :'s' || '/' || :'a_id' || '/' || s || '.jpg'
  from unnest(array['front','back','left','right']::photo_slot[]) s;
reset role;
update product_photos set moderation_status = 'approved' where product_id = :'a_id';
set session role authenticated;
select set_config('test.uid', :'s', false);
select test_degerle(:'a_id', 300);
select publish_listing(:'a_id', 'front');
select bekle_esit('önce yayında', (select status from products where id = :'a_id'), 'ACTIVE');
select delete_listing(:'a_id');
select bekle_esit('yayındaki ilan REMOVED oldu',
                  (select status from products where id = :'a_id'), 'REMOVED');

\echo ''
\echo '=== 5) SÜREN TAKASI OLAN İLAN KALDIRILAMAZ ==='
-- Alıcının puanı Güvenli Havuz'da beklerken ilanı kaldırmak, takası askıda
-- bırakırdı. Bu dosyanın en önemli iddiası.
select id from create_listing('Takastaki ilan', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset k_
insert into product_photos (product_id, slot, storage_path)
select :'k_id', s, :'s' || '/' || :'k_id' || '/' || s || '.jpg'
  from unnest(array['front','back','left','right']::photo_slot[]) s;
reset role;
update product_photos set moderation_status = 'approved' where product_id = :'k_id';
set session role authenticated;
select set_config('test.uid', :'s', false);
select test_degerle(:'k_id', 300);
select publish_listing(:'k_id', 'front');
reset role;
-- Alıcının cüzdanı boş; takas puanı havuza alamadan açılmıyor.
select available_points from earn_points(:'y', 1000, 'test:silme');
select create_trade(:'k_id', :'y');
set session role authenticated;
select set_config('test.uid', :'s', false);
select set_config('test.pid', :'k_id', false);
do $$
declare pid text := current_setting('test.pid');
begin
  perform delete_listing(pid);
  raise notice 'SONUÇ: HATA — süren takasa rağmen kaldırdı';
exception when others then
  raise notice 'SONUÇ: doğru — engellendi (%)', sqlerrm;
end $$;
select bekle('süren takaslı ilan kaldırılmadı',
             (select status from products where id = :'k_id') <> 'REMOVED');

\echo ''
\echo '=== 6) KALDIRILAN İLAN SEPETTEN VE FAVORİLERDEN DÜŞER ==='
-- `on delete cascade` yalnızca gerçek silmede çalışır; burada satır duruyor.
-- Temizlenmezse alıcı sepetinde duran ilanı ödemeye götürünce anlayamayacağı
-- bir hata alır.
select id from create_listing('Sepetteki ilan', 'Oyun & Oyuncak', 'İyi durumda', 'M',
                              p_sub_category => 'Yapı & inşa') \gset c_
insert into product_photos (product_id, slot, storage_path)
select :'c_id', s, :'s' || '/' || :'c_id' || '/' || s || '.jpg'
  from unnest(array['front','back','left','right']::photo_slot[]) s;
reset role;
update product_photos set moderation_status = 'approved' where product_id = :'c_id';
set session role authenticated;
select set_config('test.uid', :'s', false);
select test_degerle(:'c_id', 300);
select publish_listing(:'c_id', 'front');

-- Yabancı kullanıcı ilanı sepetine ve favorilerine ekliyor.
select set_config('test.uid', :'y', false);
insert into cart_items (user_id, product_id) values (:'y', :'c_id')
  on conflict do nothing;
insert into favorites  (user_id, product_id) values (:'y', :'c_id')
  on conflict do nothing;
select bekle('önce sepette',
             exists (select 1 from cart_items where product_id = :'c_id'));

select set_config('test.uid', :'s', false);
select delete_listing(:'c_id');
select bekle('sepetten düştü',
             not exists (select 1 from cart_items where product_id = :'c_id'));
select bekle('favorilerden düştü',
             not exists (select 1 from favorites where product_id = :'c_id'));
