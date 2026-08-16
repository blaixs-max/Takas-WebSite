-- KIDS TRADE — Süresi dolan takasları toplayan zamanlanmış görev
--
-- expire_stale_trades() yazıldı ama kimse çağırmazsa 48 saatlik otomatik onay
-- da, ödenmemiş takasın iadesi de hiç gerçekleşmez. Görev burada kurulur.
--
-- Saatte bir koşar. Sıklık şundan: en kısa sayaç ödeme penceresi (1 saat), en
-- uzunu şube süresi (3 gün). Saatlik tarama en kötü ihtimalle bir saatlik
-- gecikme yaratır; kullanıcıya duyurulan hiçbir süreyi bozmaz.
--
-- pg_cron her ortamda kurulu değildir (yerel test veri tabanında yok). Uzantı
-- yoksa göç sessizce geçer — bu, testlerin çalışması için gereken tavizdir;
-- üretimde uzantının kurulu olduğu Supabase panelinden doğrulanmalıdır.

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice '[expire_cron] pg_cron yok — görev kurulmadı (yerel ortam)';
    return;
  end if;

  create extension if not exists pg_cron;

  -- Aynı adla ikinci bir görev kurulmasın: göç tekrar koşabilir.
  perform cron.unschedule(jobid)
     from cron.job where jobname = 'kt-expire-stale-trades';

  perform cron.schedule(
    'kt-expire-stale-trades',
    '7 * * * *',                        -- her saatin 7. dakikası
    $cron$select public.expire_stale_trades();$cron$
  );

  raise notice '[expire_cron] saatlik görev kuruldu';
end $$;
