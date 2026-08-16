-- Kareyi yeniden çekmek: depoda UPDATE izni.
--
-- ## Bulgu (2026-08-16, canlıda)
--
-- `listing-photos` kovasında INSERT, SELECT ve DELETE politikaları vardı,
-- **UPDATE yoktu.** `lib/photos.ts` ise kareyi `upsert: true` ile yüklüyor.
--
-- Sonucu: bir slot ilk kez yüklenirken INSERT çalışıyor ve geçiyor; aynı slot
-- **yeniden çekildiğinde** nesne zaten var olduğu için işlem UPDATE'e dönüyor
-- ve politika bulunmadığı için reddediliyor. Yani **onaylanmış bir kareyi
-- değiştirmek imkânsızdı.**
--
-- Reddedilen karelerde sorun görünmüyordu, çünkü ret kararı nesneyi depodan
-- siliyor; silinmiş dosyanın üstüne yazmak yine INSERT sayılıyor. Hata
-- yalnızca onaylanmış — ya da silinmesi başarısız olmuş — karelerde çıkıyordu.
-- Bu, hatayı bulmayı zorlaştıran türden bir asimetri: "bazen çalışıyor".
--
-- Kodun niyeti zaten yeniden çekimi desteklemek; `product_photos` tarafında
-- `onConflict: 'product_id,slot'` ile satır güncelleniyor ve yorumu da
-- "aynı slot yeniden çekilirse eski satır değişmeli" diyor. Eksik olan tek
-- şey depo tarafının aynı şeyi söylemesiydi.
--
-- ## Koşul neden INSERT ile birebir aynı
--
-- Sahibi klasör adından okuyoruz (`{uid}/{ilan}/{slot}.jpg`), yani üzerine
-- yazma hakkı da yükleme hakkıyla aynı sınırda: yalnızca kendi klasörün.
-- `USING` ve `WITH CHECK` ikisi de yazılıyor — `USING` hangi satırın
-- güncellenebileceğini, `WITH CHECK` güncellemenin sonucunun ne olabileceğini
-- denetler. Yalnızca `USING` yazsaydık, biri kendi klasöründeki bir nesneyi
-- **başkasının klasörüne taşıyabilirdi**.

create policy "kendi klasöründe günceller"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Kanıt kovası da aynı durumda: itiraz kanıtı yeniden yüklenebilmeli.
create policy "kanıtı kendi klasöründe günceller"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'dispute-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'dispute-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
