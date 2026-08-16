-- KIDS TRADE — Yayındaki ilanın kareleri depoda da okunabilir
--
-- Cihazdaki ilk gerçek ilanda çıktı ve tablo/depo arasındaki bir tutarsızlıktı.
--
-- `product_photos` TABLOSUNDA politika doğruydu: yayındaki ilanın kareleri
-- anon ve authenticated'a açık. Ama karelerin kendisi `listing-photos`
-- kovasında ve orada okuma yalnızca KLASÖR SAHİBİNE ve yöneticiye açıktı.
--
-- Yani alıcı, satırı görebiliyor ama görseli göremiyordu; imzalı bağlantı
-- üretemediği için ilan kapaksız görünüyordu. Satıcı kendi ilanına baktığında
-- fotoğrafı gördüğü için kusur uzun süre fark edilmeyebilirdi — vitrinin
-- alıcıda boş, satıcıda dolu göründüğü bir durum.
--
-- Politika tablo tarafındaki kuralı birebir yansıtıyor, bir sıkı şart ekleyerek:
-- yalnızca ONAYLANMIŞ kare açılır. Tablo politikası moderasyon durumuna
-- bakmıyor; bir kare yayın sonrası reddedilirse görseli açıkta kalmamalı.

drop policy if exists "yayındaki ilanın kareleri depoda açık" on storage.objects;
create policy "yayındaki ilanın kareleri depoda açık"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'listing-photos'
    and exists (
      select 1
        from public.product_photos f
        join public.products p on p.id = f.product_id
       where f.storage_path = storage.objects.name
         and f.moderation_status = 'approved'
         and p.status in ('ACTIVE', 'RESERVED', 'SOLD')
    )
  );
