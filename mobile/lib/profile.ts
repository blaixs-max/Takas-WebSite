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
