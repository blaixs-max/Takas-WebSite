-- ============================================================================
-- Ödeme token geçmişi — "para alındı ama kayıt bulunamadı" senaryosu
-- ============================================================================
--
-- ## Bulgu
--
-- `cargo-payment-init` yarım kalmış bir denemeyi yeniden başlatırken **aynı
-- satırı** kullanıyor ve sonunda `token`'ı yenisiyle **üzerine yazıyor**.
-- Eski token o anda iyzico tarafında hâlâ geçerli olabiliyor
-- (`tokenExpireTime` dolana kadar).
--
-- Senaryo:
--   1. Alıcı ödemeyi başlatıyor, iyzico sayfası açılıyor. Token A.
--   2. Sayfayı kapatmadan uygulamaya dönüp yeniden deniyor. Token B yazılıyor,
--      A satırdan siliniyor.
--   3. Alıcı **açık duran eski sekmeye** dönüp ödemeyi orada tamamlıyor.
--   4. iyzico callback'i token A ile çağırıyor.
--   5. `.eq('token', A)` hiçbir şey bulmuyor → 404.
--
-- Sonuç: **para çekilmiş, hiçbir yere yazılmamış.** Takas `POINTS_HELD`'de
-- kalıyor, `expire_stale_trades` PAID kayıt göremediği için puanı iade edip
-- takası iptal ediyor. Yani alıcı hem kargo parasını veriyor hem takası
-- kaybediyor ve bizim elimizde bunu gösteren tek kayıt iyzico panelinde.
--
-- ## Çözüm
--
-- Token'lar artık kaybolmuyor: üzerine yazılan her token `previous_tokens`
-- dizisine ekleniyor ve callback ilk aramada bulamazsa geçmişe bakıyor.
--
-- Dizi tercih edildi çünkü alternatif — ayrı bir token tablosu — bu kadar
-- küçük bir ilişki için fazla; bir ödeme satırının ömründe birkaç token olur,
-- yüzlerce değil.
-- ============================================================================

alter table public.cargo_payments
  add column if not exists previous_tokens text[] not null default '{}';

/* Callback token'ı bununla arıyor; dizi araması indekssiz yavaş olurdu.
   GIN, dizi içinde eleman aramanın doğru indeksi. */
create index if not exists cargo_payments_previous_tokens_idx
  on public.cargo_payments using gin (previous_tokens);

comment on column public.cargo_payments.previous_tokens is
  'Üzerine yazılmış iyzico token''ları. Callback burada da arar: eski bir '
  'ödeme sayfası tamamlanırsa kayıt yine bulunmalı, yoksa para alınıp '
  'hiçbir yere yazılmaz.';
