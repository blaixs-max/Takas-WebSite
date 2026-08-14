-- Favori ve sepet — RLS yalıtımı
--
-- Bu tablolarda iş mantığı yok; tek koruma RLS. O yüzden test de tek bir şeyi
-- ölçüyor: bir kullanıcı yalnızca kendi satırlarını görebiliyor, ekleyebiliyor
-- ve silebiliyor mu.
--
-- `with check` yanı ayrıca sınanıyor. Politikaya yalnızca `using` yazmak sık
-- yapılan bir hata: okuma doğru kısıtlanır ama kullanıcı BAŞKASININ adına
-- satır ekleyebilir ve bu, yalnızca okumaya bakan bir testten kaçar.

\set a '11111111-1111-1111-1111-111111111111'
\set b '22222222-2222-2222-2222-222222222222'

insert into auth.users (id, email) values
  (:'a', 'a@ornek.com'), (:'b', 'b@ornek.com')
on conflict (id) do nothing;

insert into products (id, title, points, ai_suggested_points, condition, category,
                      location, image_key, seller_id, seller_name, seller_initials, size_class)
values ('fav-urun', 'Favori testi', 200, 200, 'İyi durumda', 'Oyun & Oyuncak',
        'Kadıköy', 'wooden-blocks', :'b', 'Satıcı', 'ST', 'S')
on conflict (id) do update set status = 'ACTIVE';

set session role authenticated;

\echo '=== 1) A kendi favorisini ekler ve görür ==='
select set_config('test.uid', :'a', false);
insert into favorites (user_id, product_id) values (:'a', 'fav-urun');
select count(*) as a_favori from favorites;
\echo 'BEKLENEN: 1'

\echo ''
\echo '=== 2) B, A''nın favorisini GÖREMEZ ==='
select set_config('test.uid', :'b', false);
select count(*) as b_gordugu from favorites;
\echo 'BEKLENEN: 0'

\echo ''
\echo '=== 3) B, A adına favori EKLEYEMEZ (with check) ==='
do $$
begin
  insert into favorites (user_id, product_id) values
    ('11111111-1111-1111-1111-111111111111', 'fav-urun');
  raise exception 'BEKLENMEDİK: başkasının adına favori eklenebildi';
exception
  when insufficient_privilege then
    raise notice 'BEKLENEN: with check reddetti';
end
$$;

\echo ''
\echo '=== 4) B, A''nın favorisini SİLEMEZ ==='
delete from favorites where product_id = 'fav-urun';
select set_config('test.uid', :'a', false);
select count(*) as a_favori_hala from favorites;
\echo 'BEKLENEN: 1 — B''nin silme denemesi hiçbir satıra dokunmadı'

\echo ''
\echo '=== 5) Aynı ürün iki kez favoriye eklenemez ==='
do $$
begin
  insert into favorites (user_id, product_id) values
    ('11111111-1111-1111-1111-111111111111', 'fav-urun');
  raise exception 'BEKLENMEDİK: aynı satır iki kez yazıldı';
exception
  when unique_violation then
    raise notice 'BEKLENEN: birincil anahtar tekrarı engelledi';
end
$$;

\echo ''
\echo '=== 6) Sepet aynı kurallarla çalışıyor ==='
insert into cart_items (user_id, product_id) values (:'a', 'fav-urun');
select count(*) as a_sepet from cart_items;
\echo 'BEKLENEN: 1'
select set_config('test.uid', :'b', false);
select count(*) as b_gordugu_sepet from cart_items;
\echo 'BEKLENEN: 0'

\echo ''
\echo '=== 7) A kendi favorisini silebilir ==='
select set_config('test.uid', :'a', false);
delete from favorites where product_id = 'fav-urun';
select count(*) as a_favori_son from favorites;
\echo 'BEKLENEN: 0'

\echo ''
\echo '=== 8) İlan silinince sepet satırı da gider (cascade) ==='
reset role;
delete from products where id = 'fav-urun';
select count(*) as kalan_sepet from cart_items where product_id = 'fav-urun';
\echo 'BEKLENEN: 0'
