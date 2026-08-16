-- Engellenenler listesi.
--
-- `block_user` / `unblock_user` / `block_conversation_peer` vardı ama
-- kullanıcının kimi engellediğini görebileceği bir uç yoktu. Engelleme
-- tek yönlü bir kapıydı: açan var, kapatan yok. Yanlışlıkla engellenen
-- biri kalıcı olarak engelli kalıyordu.
--
-- ## Neden isim değil bağlam döndürüyor
--
-- Uygulama karşı tarafın adını zaten göstermiyor: `my_conversations`,
-- alıcıya satıcının adını veriyor ama satıcıya alıcı için düz "Alıcı"
-- yazıyor. Engellenenler listesi isim gösterseydi, uygulamanın başka
-- hiçbir yerinde vermediği bir veriyi burada verirdi — üstelik
-- `profiles` üzerindeki SELECT ilkesi de "yalnızca kendi profilin".
--
-- Onun yerine **hangi bağlamda engellediği** dönüyor: "Suluk ilanının
-- satıcısı". Kullanıcının hatırlaması için gereken bilgi bu, kimlik değil.
-- Sohbet bulunamazsa (engelleme başka bir yoldan yapıldıysa ya da sohbet
-- silindiyse) null döner ve istemci nötr bir satır çizer.
--
-- `blocked_id` dönüyor çünkü `unblock_user` onu istiyor. Bu bir sızıntı
-- değil: kullanıcı zaten o kişiyi kendisi engelledi, kimliği elinde.

create or replace function public.my_blocks()
returns table(blocked_id uuid, engellendi_at timestamptz, baglam text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select b.blocked_id,
         b.created_at,
         (select case
                   when c.buyer_id = auth.uid()
                     then coalesce(p.title, 'Kaldırılmış ilan') || ' ilanının satıcısı'
                   else coalesce(p.title, 'Kaldırılmış ilan') || ' ilanındaki alıcı'
                 end
            from public.conversations c
            left join public.products p on p.id = c.product_id
           where (c.buyer_id = auth.uid() and c.seller_id = b.blocked_id)
              or (c.seller_id = auth.uid() and c.buyer_id = b.blocked_id)
           order by c.last_message_at desc nulls last
           limit 1)
    from public.user_blocks b
   where auth.uid() is not null
     and b.blocker_id = auth.uid()
   order by b.created_at desc;
$function$;

revoke all on function public.my_blocks() from public, anon;
grant execute on function public.my_blocks() to authenticated;
