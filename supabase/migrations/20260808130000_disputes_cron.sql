-- KIDS TRADE — İtiraz sayaçları için zamanlanmış görev
--
-- expire_stale_disputes() kanıt süresi dolan talebi reddediyor ve karar süresi
-- aşılanı kuyruğa alıyor. Çağıran olmazsa iki iş de hiç olmaz: kanıtsız talep
-- sonsuza kadar açık kalır ve satıcının puanı süresiz rehin kalır.
--
-- Takas görevinden ayrı bir kayıt: biri patlarsa diğeri koşmaya devam etsin.

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice '[disputes_cron] pg_cron yok — görev kurulmadı (yerel ortam)';
    return;
  end if;

  create extension if not exists pg_cron;

  perform cron.unschedule(jobid)
     from cron.job where jobname = 'kt-expire-stale-disputes';

  perform cron.schedule(
    'kt-expire-stale-disputes',
    '22 * * * *',                       -- takas görevinden 15 dakika sonra
    $cron$select public.expire_stale_disputes();$cron$
  );

  raise notice '[disputes_cron] saatlik görev kuruldu';
end $$;
