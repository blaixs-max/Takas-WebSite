import { Condition } from '../data/products';
import { Category } from '../data/categories';
import { SizeClass } from '../data/sizeClasses';
import { supabase, supabaseConfigured } from './supabase';

export interface NewListing {
  title: string;
  category: Category;
  condition: Condition;
  sizeClass: SizeClass;
  points: number;
  location?: string;
  description?: string;
  /** Hasar beyanı — hasar yakın çekimi karesini zorunlu yapar. */
  hasDamage?: boolean;
  /** Set beyanı — parça bütünlüğü karesini zorunlu yapar. */
  isSet?: boolean;
}

export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

/**
 * İlanı Supabase'e yazar.
 *
 * Doğrudan insert etmez, `create_listing` RPC'sini çağırır: satıcı kimliği,
 * görünen ad ve değerleme izi orada oturumdan türetilir, istemcinin
 * yazabileceği alan değildir.
 *
 * İlan TASLAK olarak açılır — vitrine çıkmaz. Yayına girmesi için yedi karenin
 * zorunlu olanları çekilip incelemeden geçmelidir (`publishListing`).
 */
export async function createListing(l: NewListing): Promise<CreateResult> {
  if (!supabaseConfigured || !supabase) {
    return { ok: false, message: 'Sunucu bağlantısı yok. Anahtarlar tanımlı değil.' };
  }

  const { data, error } = await supabase.rpc('create_listing', {
    p_title: l.title,
    p_category: l.category,
    p_condition: l.condition,
    p_size_class: l.sizeClass,
    p_points: l.points,
    p_location: l.location ?? 'Belirtilmedi',
    p_description: l.description ?? null,
    p_has_damage: l.hasDamage ?? false,
    p_is_set: l.isSet ?? false,
  });

  if (error) return { ok: false, message: cevir(error.message) };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) return { ok: false, message: 'İlan oluşturuldu ama kimliği alınamadı.' };
  return { ok: true, id: row.id as string };
}

/** Postgres hata metinlerini kullanıcıya gösterilebilir hâle çevirir. */
function cevir(mesaj: string): string {
  if (mesaj.includes('oturum açmalısınız')) return 'İlan vermek için giriş yapmalısınız.';
  if (mesaj.includes('başlık zorunludur')) return 'Başlık boş bırakılamaz.';
  if (mesaj.includes('geçersiz desi')) return 'Geçerli bir boyut seçin.';
  if (mesaj.includes('puan sıfırdan büyük')) return 'Puan sıfırdan büyük olmalı.';
  return 'İlan kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.';
}
