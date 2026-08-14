import { supabase, supabaseConfigured } from './supabase';

/**
 * Profil istatistikleri ve güven skoru.
 *
 * Ekran daha önce dört sabit sayı gösteriyordu: skor 96, 38 takas, 1.260 puan,
 * 4,9 değerlendirme. Dördü de uydurmaydı ve biri — değerlendirme — karşılığı
 * hiç olmayan bir sistemi ima ediyordu.
 *
 * `trustSkor` null gelebilir: yeterli işlemi olmayan kullanıcının skoru YOKTUR.
 * Bu durumda arayüz sayı göstermez; uydurulmuş bir 100, uydurulmuş bir 96
 * kadar yanlış olurdu.
 */

export interface ProfileStats {
  availablePoints: number;
  heldPoints: number;
  basariliTakas: number;
  aktifTakas: number;
  yayindakiIlan: number;
  satilanIlan: number;
  trustSkor: number | null;
  trustIslem: number;
  ayipliSatis: number;
  asilsizTalep: number;
  odenmemisBorc: number;
  gecKargo: number;
  mesajIhlali: number;
}

export async function loadProfileStats(): Promise<ProfileStats | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc('profile_stats');
  if (error || !data) return null;
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    availablePoints: Number(r.available_points ?? 0),
    heldPoints: Number(r.held_points ?? 0),
    basariliTakas: Number(r.basarili_takas ?? 0),
    aktifTakas: Number(r.aktif_takas ?? 0),
    yayindakiIlan: Number(r.yayindaki_ilan ?? 0),
    satilanIlan: Number(r.satilan_ilan ?? 0),
    trustSkor: r.trust_skor === null || r.trust_skor === undefined ? null : Number(r.trust_skor),
    trustIslem: Number(r.trust_islem ?? 0),
    ayipliSatis: Number(r.ayipli_satis ?? 0),
    asilsizTalep: Number(r.asilsiz_talep ?? 0),
    odenmemisBorc: Number(r.odenmemis_borc ?? 0),
    gecKargo: Number(r.gec_kargo ?? 0),
    mesajIhlali: Number(r.mesaj_ihlali ?? 0),
  };
}

/**
 * Skoru düşüren kalemleri cümleye çevirir.
 *
 * Skoru gerekçesiz göstermek, kullanıcıya davranışını düzeltme imkânı vermez.
 * Ceza yoksa boş dizi döner.
 */
export function trustGerekceleri(s: ProfileStats): string[] {
  const liste: string[] = [];
  if (s.ayipliSatis > 0) liste.push(`${s.ayipliSatis} iade talebi lehine sonuçlandı`);
  if (s.asilsizTalep > 0) liste.push(`${s.asilsizTalep} talebiniz reddedildi`);
  if (s.odenmemisBorc > 0) liste.push(`${s.odenmemisBorc} ödenmemiş borç kaydı`);
  if (s.gecKargo > 0) liste.push(`${s.gecKargo} gönderi süresinde kargoya verilmedi`);
  if (s.mesajIhlali > 0) liste.push(`${s.mesajIhlali} mesajınız kurallara aykırı bulundu`);
  return liste;
}

/** Binlik ayracı — Hermes'te Intl güvenilir değil. */
export function binlik(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export interface Sanction {
  level: 'WARNED' | 'RESTRICTED' | 'CLOSED';
  reason: string;
}

/**
 * Açık yaptırım.
 *
 * Kısıtlı bir kullanıcının bunu ancak bir işlem denerken hata mesajından
 * öğrenmesi kabul edilemez; profilinde yazılı durmalı.
 */
export async function loadSanction(): Promise<Sanction | null> {
  const { supabase, supabaseConfigured } = await import('./supabase');
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc('my_sanction');
  if (error || !data) return null;
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!r?.level) return null;
  return { level: r.level as Sanction['level'], reason: (r.reason as string) ?? '' };
}

export function yaptirimMetni(s: Sanction): { baslik: string; metin: string } {
  if (s.level === 'CLOSED') {
    return { baslik: 'Hesabınız kapatıldı', metin: s.reason };
  }
  if (s.level === 'RESTRICTED') {
    return {
      baslik: 'Hesabınız geçici olarak kısıtlı',
      metin: 'Yeni ilan veremez ve yeni alım yapamazsınız. Süren takaslarınız normal şekilde tamamlanır.',
    };
  }
  return {
    baslik: 'Güven skorunuz uyarı seviyesinde',
    metin: 'Skorunuz düşmeye devam ederse yeni ilan verme ve alım yapma yetkiniz geçici olarak durur.',
  };
}

/* ==========================================================================
   Profil bilgileri — ad, konum, hakkında
   ========================================================================== */

export interface Profile {
  fullName: string;
  city: string;
  bio: string;
}

export const BOS_PROFIL: Profile = { fullName: '', city: '', bio: '' };

export type KaydetSonucu = { ok: true } | { ok: false; message: string };

/**
 * Profili okur.
 *
 * Ad iki yerde duruyor ve bu bilinçli: tek gerçek kaynak
 * `auth.users.raw_user_meta_data.full_name` — `create_listing` oradan okuyor
 * ve GoTrue'nun kendi API'siyle yazılıyor. `profiles` tablosu onun aynası,
 * ayrıca konum ve hakkında alanlarını taşıyor.
 *
 * Okurken metadata öncelikli: yazma sırası önce GoTrue sonra tablo olduğu
 * için ikisi ayrışırsa güncel olan metadata'dır.
 */
export async function loadProfile(): Promise<Profile> {
  if (!supabaseConfigured || !supabase) return BOS_PROFIL;

  const { data: oturum } = await supabase.auth.getUser();
  const metaAd = (oturum?.user?.user_metadata?.full_name as string | undefined) ?? '';

  const { data } = await supabase.from('profiles').select('full_name, city, bio').maybeSingle();

  return {
    fullName: metaAd || data?.full_name || '',
    city: data?.city ?? '',
    bio: data?.bio ?? '',
  };
}

/**
 * Profili kaydeder.
 *
 * İki adım, ikisi de gerekli:
 *
 *   1. `auth.updateUser` — adı GoTrue metadata'sına yazar. `create_listing`
 *      yeni ilanın `seller_name`'ini buradan türetiyor.
 *   2. `update_profile` RPC — `profiles` satırını yazar **ve** kullanıcının
 *      mevcut ilanlarındaki `seller_name` kopyasını tazeler.
 *
 * Sıra önemli. Metadata önce yazılıyor: ikinci adım düşerse yeni ilanlar
 * doğru adı alır, eski ilanlar eski adı taşımaya devam eder — kısmi ama
 * ilerleyen bir durum. Ters sırada ikinci adım düştüğünde kullanıcı "kaydettim"
 * görür, sonraki ilan hâlâ e-postadan türeyen adı taşır.
 */
export async function saveProfile(p: Profile): Promise<KaydetSonucu> {
  if (!supabaseConfigured || !supabase) {
    return { ok: false, message: 'Sunucu bağlantısı yok. Anahtarlar tanımlı değil.' };
  }

  const ad = p.fullName.trim();
  if (ad.length < 2) return { ok: false, message: 'Adınızı yazın (en az 2 karakter).' };
  if (ad.length > 60) return { ok: false, message: 'Ad en fazla 60 karakter olabilir.' };

  const { error: metaHata } = await supabase.auth.updateUser({ data: { full_name: ad } });
  if (metaHata) return { ok: false, message: metaHata.message };

  const { error: rpcHata } = await supabase.rpc('update_profile', {
    p_full_name: ad,
    p_city: p.city.trim() || null,
    p_bio: p.bio.trim() || null,
  });
  if (rpcHata) return { ok: false, message: rpcHata.message };

  return { ok: true };
}

/**
 * Görünen addan baş harfler; sunucudaki `seller_initials` ile aynı kural.
 * Ad yoksa em dash — uydurma bir harf koymaktan iyidir.
 */
export function basHarfler(ad: string): string {
  const p = ad.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '—';
  return (p[0][0] + (p.length > 1 ? p[1][0] : p[0][0])).toLocaleUpperCase('tr-TR');
}

/** Selamlamada kullanılan ilk ad. Ad yoksa boş döner, çağıran karar verir. */
export function ilkAd(ad: string): string {
  return ad.trim().split(/\s+/).filter(Boolean)[0] ?? '';
}
