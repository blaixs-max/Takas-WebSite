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

/**
 * Eski token'ı geçmişe ekler.
 *
 * PostgREST'ten diziye ekleme yapmak, satırı okuyup geri yazmayı gerektirirdi
 * ve iki eşzamanlı yeniden başlatma birbirinin eklediğini silebilirdi. Tek
 * ifadelik `array_append` bu yarışı ortadan kaldırıyor.
 *
 * `service_role`a özel: yalnızca cargo-payment-init çağırıyor.
 */
create or replace function public.cargo_payment_token_arsivle(
  p_payment_id uuid,
  p_eski_token text
)
returns void
language sql security definer set search_path = public as $$
  update public.cargo_payments
     set previous_tokens = array_append(previous_tokens, p_eski_token)
   where id = p_payment_id
     and p_eski_token is not null
     and not (p_eski_token = any(previous_tokens));
$$;

revoke all on function public.cargo_payment_token_arsivle(uuid, text) from public;
grant execute on function public.cargo_payment_token_arsivle(uuid, text) to service_role;
