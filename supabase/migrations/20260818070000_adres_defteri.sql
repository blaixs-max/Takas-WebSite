/**
 * Adres defteri — kullanıcı adreslerini kaydedebiliyor.
 *
 * ## Bu bir karar değişikliği
 *
 * Ana Doküman ve `addresses.tsx` bugüne kadar tersini söylüyordu: "Kargo
 * adresin, takas onaylandıktan sonra ödeme adımında alınır ve yalnızca o
 * gönderi için kullanılır." Ekranda bir adres defteri değil, defterin **neden
 * olmadığını** anlatan bir not duruyordu.
 *
 * Karar kullanıcının (2026-08-18): adres saklanacak, düzenlenebilecek,
 * silinebilecek ve birden fazla olabilecek. Dokümanlar aynı turda güncellendi
 * — kod bir kararı değiştiriyorsa önce doküman yazılır.
 *
 * ## Neyin saklanmadığı değişmedi
 *
 * **T.C. kimlik numarası hâlâ saklanmıyor.** Fatura için her ödemede sorulur ve
 * yalnızca o istekte iletilir. Bu tabloda öyle bir kolon yok ve olmayacak:
 * adres ile kimlik numarası aynı türden veri değil. Adresi yanlış kişiye
 * göstermek bir gizlilik kusuru; kimlik numarası sızdırmak farklı bir
 * kategoridir ve saklanmayan veri sızdırılamaz.
 *
 * Adres **hiçbir yüzeyde başkasına gösterilmiyor**: vitrin bu tabloyu
 * okumuyor, ilan kartı okumuyor, pazarlama sitesi zaten veri tabanına hiç
 * bağlanmıyor. Tek okuyucusu sahibinin kendi ödeme formu.
 *
 * ## Neden RPC değil, doğrudan tablo
 *
 * `create_listing` ve arkadaşları RPC çünkü orada istemcinin yazamaması
 * gereken alanlar var (satıcı kimliği, puan, değerleme izi). Adres satırında
 * öyle bir alan yok — hepsi kullanıcının kendi yazdığı, kendi okuduğu veri.
 * RLS burada gerçekten yeterli ve araya bir RPC koymak, doğrulamayı iki yere
 * bölerdi.
 *
 * Tek istisna varsayılan işareti ve o bir trigger'la çözülüyor: iki adresin
 * birden varsayılan olması istemcinin iki ayrı `update` çağırmasına
 * bırakılamaz, arada uygulama kapanırsa iki varsayılan kalır.
 */

create table if not exists public.addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  /* "Ev", "Ofis", "Annemler" — kullanıcının kendi etiketi. Sabit bir listeden
     seçtirmedik: üçüncü adresi olan herkes listenin dışında kalıyor. */
  baslik     text not null check (btrim(baslik) <> '' and length(baslik) <= 24),
  ad_soyad   text not null check (btrim(ad_soyad) <> '' and length(ad_soyad) <= 60),
  telefon    text check (telefon is null or length(telefon) <= 20),
  il         text not null check (btrim(il) <> '' and length(il) <= 40),
  ilce       text not null check (btrim(ilce) <> '' and length(ilce) <= 40),
  /* Açık adres: mahalle, cadde, kapı numarası. `konumlar.ts` listesi il/ilçe
     için var, bunun için yok ve olamaz. */
  acik_adres text not null check (btrim(acik_adres) <> '' and length(acik_adres) <= 300),
  varsayilan boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists addresses_user_idx on public.addresses(user_id);

/* Kullanıcı başına tek varsayılan. Kısmi indeks, çünkü kısıt yalnızca
   `varsayilan = true` satırlar için var — kullanıcı istediği kadar
   varsayılan-olmayan adres tutabilir. */
create unique index if not exists addresses_tek_varsayilan_uidx
  on public.addresses(user_id) where varsayilan;

alter table public.addresses enable row level security;

drop policy if exists "kendi adreslerini gör"      on public.addresses;
drop policy if exists "kendi adresini ekle"        on public.addresses;
drop policy if exists "kendi adresini güncelle"    on public.addresses;
drop policy if exists "kendi adresini sil"         on public.addresses;

create policy "kendi adreslerini gör"
  on public.addresses for select to authenticated using (user_id = auth.uid());
create policy "kendi adresini ekle"
  on public.addresses for insert to authenticated with check (user_id = auth.uid());
create policy "kendi adresini güncelle"
  on public.addresses for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "kendi adresini sil"
  on public.addresses for delete to authenticated using (user_id = auth.uid());

/* Yetki matrisi RLS'in yedeği değil, ikinci kilidi (CLAUDE.md). Supabase
   kurulumu yeni tablolara `anon`'a kadar yazma yetkisi verebiliyor; burada
   açıkça daraltılıyor. Yönetici de dahil hiç kimsenin adres okuması gerekmiyor
   — bu tablonun okuyucusu yalnızca sahibi. */
revoke all on table public.addresses from public, anon;
grant select, insert, update, delete on table public.addresses to authenticated;

comment on table public.addresses is
  'Kullanıcının kayıtlı kargo adresleri. T.C. kimlik numarası BURADA TUTULMAZ '
  've tutulmayacak — fatura kimliği her ödemede ayrıca sorulur. Adres hiçbir '
  'yüzeyde başkasına gösterilmez; tek okuyucusu sahibinin ödeme formu.';

/**
 * Varsayılan işaretinin tutarlılığı.
 *
 * Üç şey aynı yerde çözülüyor çünkü üçü de aynı soruya bakıyor — "bu
 * kullanıcının şu an varsayılanı hangisi":
 *
 *   1. İlk adres kendiliğinden varsayılan olur. Olmasaydı tek adresi olan
 *      kullanıcının ödeme formu boş açılırdı ve "varsayılan seç" diye bir
 *      adım öğrenmesi gerekirdi.
 *   2. Yeni bir adres varsayılan yapılırsa eskisi bırakılır. Kısmi indeks
 *      bunu zaten dayatıyor ama tek başına **hata** üretirdi; kullanıcının
 *      gördüğü şey "kaydedilemedi" olurdu.
 *   3. Sıfırlama engelleniyor: tek adresi varsayılan olmaktan çıkarmak,
 *      defteri varsayılansız bırakırdı.
 */
create or replace function public.addresses_varsayilan_tekil()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
begin
  if tg_op = 'INSERT' and not exists (
       select 1 from public.addresses where user_id = new.user_id) then
    new.varsayilan := true;
  end if;

  if new.varsayilan then
    update public.addresses
       set varsayilan = false
     where user_id = new.user_id
       and id <> new.id
       and varsayilan;
  end if;

  new.updated_at := now();
  return new;
end; $function$;

drop trigger if exists addresses_varsayilan_trg on public.addresses;
create trigger addresses_varsayilan_trg
  before insert or update on public.addresses
  for each row execute function public.addresses_varsayilan_tekil();

/**
 * Varsayılan adres silinince başkası varsayılan olur.
 *
 * Yoksa defterde üç adres kalır ve hiçbiri varsayılan değildir; ödeme formu
 * boş açılır ve kullanıcı sebebini anlamaz. En yeni adres seçiliyor: son
 * eklenen, büyük olasılıkla güncel olan.
 */
create or replace function public.addresses_varsayilan_devret()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
begin
  if old.varsayilan then
    update public.addresses
       set varsayilan = true
     where id = (select id from public.addresses
                  where user_id = old.user_id
                  order by created_at desc limit 1);
  end if;
  return old;
end; $function$;

drop trigger if exists addresses_devret_trg on public.addresses;
create trigger addresses_devret_trg
  after delete on public.addresses
  for each row execute function public.addresses_varsayilan_devret();

/**
 * Adres sayısı sınırlı.
 *
 * On adres, "Ev / Ofis / Annemler / yazlık" için fazlasıyla yeterli. Sınır
 * kullanıcıyı değil tabloyu koruyor: sınırsız bir defter, hesap başına
 * sınırsız satır demek.
 */
create or replace function public.addresses_sayi_siniri()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
begin
  if (select count(*) from public.addresses where user_id = new.user_id) >= 10 then
    raise exception 'en fazla 10 adres kaydedebilirsiniz';
  end if;
  return new;
end; $function$;

drop trigger if exists addresses_sayi_trg on public.addresses;
create trigger addresses_sayi_trg
  before insert on public.addresses
  for each row execute function public.addresses_sayi_siniri();
