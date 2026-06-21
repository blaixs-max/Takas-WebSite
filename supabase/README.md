# KIDS TRADE — Ödeme backend'i (Supabase + iyzico)

Bu klasör, **kargo ücreti tahsilatı + komisyon** akışının backend'ini içerir.
Güvenli havuz (puan) bu katmanda **değildir** — burada yalnızca gerçek para (kargo) akar.

## Mimari özeti

```
Mobil (Expo)                 Supabase Edge Functions            iyzico
─────────────                ───────────────────────            ──────
[Takas et] ──► cargo-payment-init ──► Checkout Form başlat ────► (sandbox-api)
                  │  cargo_payments: PENDING
                  ▼
   token + paymentPageUrl ◄───────────────────────────────────┘
WebView'de ödeme ekranı ──► kullanıcı kartla öder ──► iyzico
                                              │
            iyzico-callback ◄── token (POST) ─┘
                  │  RETRIEVE ile doğrula → PAID/FAILED
                  │  komisyon = amount − carrier_cost (init'te sabitlendi)
                  ▼
       trades.status = SHIPPED + kargo etiketi + bildirim
```

- `cargo-payment-init` — ödemeyi başlatır, PENDING kayıt açar, komisyonu sabitler.
- `iyzico-callback` — token'ı **RETRIEVE ile doğrular** (callback gövdesine güvenmez), PAID/FAILED yazar.
- `_shared/iyzico.ts` — IYZWSv2 (HMAC-SHA256) imzalama + Checkout Form initialize/retrieve.

## Komisyon mantığı
`amount (alıcının ödediği) = carrier_cost (anlaşmalı kargo) + commission (platform)`
Platform tek üye işyeri olduğu için komisyon doğrudan platforma kalır; iyzico
pazaryeri/alt-üye (split) **gerekmez**. `daily_commission` view'ı günlük geliri verir.

## Kurulum & test (sandbox)

1. **Supabase CLI** ile bağlan:
   ```bash
   supabase link --project-ref <proje-ref>
   ```
2. **Şemayı uygula:**
   ```bash
   supabase db push        # migrations/ altındaki SQL
   ```
3. **Sırları (secrets) ekle** (`.env.example`'a bak):
   ```bash
   supabase secrets set IYZICO_BASE_URL=https://sandbox-api.iyzipay.com \
     IYZICO_API_KEY=sandbox-... IYZICO_SECRET_KEY=sandbox-... \
     IYZICO_CALLBACK_URL=https://<ref>.supabase.co/functions/v1/iyzico-callback \
     APP_RETURN_URL=kidstrade://payment-result
   ```
4. **Fonksiyonları yayınla:**
   ```bash
   supabase functions deploy cargo-payment-init
   supabase functions deploy iyzico-callback --no-verify-jwt   # iyzico JWT göndermez
   ```
5. **Yerelde dene:**
   ```bash
   supabase functions serve --env-file supabase/functions/.env
   curl -X POST http://localhost:54321/functions/v1/cargo-payment-init \
     -H "Content-Type: application/json" \
     -d '{
       "tradeId":"trade_123","carrierCost":48,"commission":12,"carrierName":"MNG Kargo",
       "sellerId":"00000000-0000-0000-0000-000000000002",
       "buyer":{"id":"00000000-0000-0000-0000-000000000001","name":"Emrah","surname":"Atabek",
         "email":"blaixs@gmail.com","identityNumber":"11111111111","address":"Kadıköy","city":"İstanbul"}
     }'
   ```
   Dönen `paymentPageUrl`'i tarayıcıda açıp iyzico **sandbox test kartı** ile ödersiniz:
   `5528790000000008` · 12/30 · CVC 123.

## Sandbox test kartları
- Başarılı: `5528790000000008` (Halkbank MasterCard)
- Başarısız: `4111111111111129`
- 3DS akışı test kartlarının tamamı: iyzico sandbox dokümanında.

## Güvenlik notları
- `IYZICO_SECRET_KEY` **yalnızca** Edge Function ortamında; mobil uygulamada **asla**.
- `iyzico-callback` herkese açıktır (iyzico çağırır) → JWT doğrulaması kapalı; güvenlik
  **token + RETRIEVE doğrulaması** ile sağlanır.
- `cargo_payments` tablosunda RLS açık; yazma yalnızca `service_role` ile yapılır.

## Puan defteri (güvenli havuz) ✅
`migrations/20260621130000_points_ledger.sql` — gerçek para olmadan puan escrow'u:
- `wallets` (available/held, CHECK ≥ 0) · `wallet_entries` (değişmez log) · `trades` (durum makinesi)
- Atomik fonksiyonlar: `earn_points`, `hold_points`, `release_points`, `refund_points`
  (SELECT … FOR UPDATE ile yarış-koşulsuz; negatif bakiye ve çift harcama engelli)
- RLS açık; yazma yalnızca `service_role` (SECURITY DEFINER) ile.

**Yerel test** (geçici Postgres cluster ile, `tests/points_ledger_test.sql`):
```bash
psql "$DATABASE_URL" -f supabase/migrations/20260621130000_points_ledger.sql
psql "$DATABASE_URL" -f supabase/tests/points_ledger_test.sql
```
Senaryolar: kazanç → havuza al → teslim → satıcıya geçiş, iade, negatif bakiye
engeli, çift harcama/idempotency engeli, çift-giriş tutarlılığı. (Hepsi doğrulandı.)

## Sonraki adım
- Kargo **aggregator** (Navlungo/Kolay Gelsin) entegrasyonu: `iyzico-callback` içinde
  `carrier_cost` ile etiket üretimi (şu an `TODO`).
- Mobil tarafta ödeme WebView ekranı + deep-link dönüşü.
