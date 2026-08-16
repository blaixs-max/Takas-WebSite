-- ============================================================================
-- expire_stale_trades — doğru anahtarla arama, ve yorumların geri gelmesi
-- ============================================================================
--
-- ## İki şey düzeliyor
--
-- **1. Ödeme araması yanlış kolonu kullanıyordu.** `c.conversation_id` iyzico'ya
-- bakan referanstır; kendi tablomuzun anahtarı `c.trade_id`. İkisi bugün aynı
-- değeri taşıyor, yani hata üretmiyordu — ama ayrıştıkları gün buradaki
-- koruma çalışmayı bırakırdı ve sonucu ağırdır: **ödemesi alınmış bir takas
-- iade edilip iptal edilirdi.** `iyzico-callback` bu turda düzeltildi, sıra
-- burada.
--
-- **2. Yayındaki gövdede yorumlar yoktu.** Depodaki göç dosyası sekiz yorum
-- satırı taşıyor, `pg_get_functiondef` ise hiçbirini göstermiyordu. Yani bu
-- fonksiyon bir noktada dosyadan farklı bir kaynaktan uygulanmış. Mantık
-- aynıydı — satır satır karşılaştırıldı — ama depo ile veri tabanının sessizce
-- ayrışabildiğinin kanıtı. Gövde, yorumlarıyla birlikte geri yazılıyor.
--
-- Mantıkta **hiçbir değişiklik yok**: gövde canlıdaki tanımdan alındı,
-- yalnızca aranan kolon değişti ve yorumlar eklendi.
-- ============================================================================

create or replace function public.expire_stale_trades()
returns table (odenmedi integer, birakilmadi integer, otomatik_onay integer)
language plpgsql security definer set search_path = public as $$
declare t public.trades;
begin
  odenmedi := 0; birakilmadi := 0; otomatik_onay := 0;

  for t in
    select * from public.trades
     where deadline_at is not null and deadline_at <= now()
     order by deadline_at
     for update
  loop
    if t.status in ('CREATED','POINTS_HELD') then
      -- Kargo bedeli ödenmedi. Ödeme gerçekten yoksa iade et: PAID bir kayıt
      -- varken iade etmek, parası alınmış alıcının takasını iptal etmek olurdu.
      -- Arama `trade_id` ile: `conversation_id` iyzico'nun referansı, bizim
      -- anahtarımız değil.
      if exists (select 1 from public.cargo_payments c
                  where c.trade_id = t.id::text and c.status = 'PAID') then
        -- Ödeme var ama takas ilerlememiş: veri tutarsızlığı, sayacı ileri
        -- alıp insana bırakıyoruz. Sessizce iade YOK.
        update public.trades set deadline_at = now() + interval '1 hour' where id = t.id;
        raise warning '[expire_stale_trades] ödeme PAID ama takas % durumunda: %', t.status, t.id;
      else
        perform public.refund_points(t.id, 'Kargo bedeli süresinde ödenmedi');
        odenmedi := odenmedi + 1;
      end if;

    elsif t.status = 'SHIPPED' then
      -- Satıcı üç gün içinde şubeye bırakmadı. Puan alıcıya döner; kargo
      -- bedelinin iadesi ayrı bir iştir ve elle yapılır (Ana Doküman 4.5).
      perform public.refund_points(t.id, 'Satıcı ürünü süresinde kargoya vermedi');
      birakilmadi := birakilmadi + 1;

    elsif t.status = 'DELIVERED' then
      -- 48 saat doldu, alıcı ne onayladı ne itiraz etti. Puan satıcıya geçer.
      perform public.release_points(t.id);
      otomatik_onay := otomatik_onay + 1;

    else
      -- Beklenmeyen durumda sayaç asılı kalmasın.
      update public.trades set deadline_at = null where id = t.id;
    end if;
  end loop;

  return next;
end; $$;
