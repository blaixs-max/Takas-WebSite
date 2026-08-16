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
