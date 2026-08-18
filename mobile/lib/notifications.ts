import { MaterialIcons } from '@expo/vector-icons';
import { supabase, supabaseConfigured } from './supabase';

/**
 * Bildirim kuyruğu.
 *
 * Kayıtları sunucu üretir — trigger'lar. İstemci yalnızca okur ve okundu
 * işaretler; metni burada kurmuyoruz, çünkü aynı olayın iki yerde iki farklı
 * cümleyle anlatılması kaçınılmaz olurdu.
 */

export interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  okundu: boolean;
  createdAt: string;
}

export async function loadNotifications(): Promise<NotificationRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('id, kind, title, body, data, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data.map((n) => ({
    id: n.id as string,
    kind: n.kind as string,
    title: n.title as string,
    body: n.body as string,
    data: (n.data as Record<string, unknown>) ?? {},
    okundu: n.read_at !== null,
    createdAt: n.created_at as string,
  }));
}

export async function markAllRead(): Promise<number> {
  if (!supabaseConfigured || !supabase) return 0;
  const { data, error } = await supabase.rpc('mark_notifications_read', { p_ids: null });
  if (error) return 0;
  return Number(data ?? 0);
}

export async function unreadCount(): Promise<number> {
  if (!supabaseConfigured || !supabase) return 0;
  const { data, error } = await supabase.rpc('unread_notification_count');
  if (error) return 0;
  return Number(data ?? 0);
}

interface Gorunum {
  ikon: keyof typeof MaterialIcons.glyphMap;
  ton: 'primary' | 'tertiary' | 'dikkat';
}

/** Bildirim türünden ikon ve ton. Bilinmeyen tür sessizce nötr görünür. */
export function gorunum(kind: string): Gorunum {
  switch (kind) {
    case 'listing.published':
      return { ikon: 'verified', ton: 'primary' };
    case 'photo.rejected':
      return { ikon: 'photo-camera', ton: 'dikkat' };
    case 'trade.created':
      return { ikon: 'swap-horiz', ton: 'primary' };
    case 'trade.shipped':
      return { ikon: 'local-shipping', ton: 'tertiary' };
    case 'trade.delivered':
      return { ikon: 'inventory', ton: 'tertiary' };
    case 'trade.completed':
      return { ikon: 'check-circle', ton: 'primary' };
    case 'trade.refunded':
      return { ikon: 'undo', ton: 'dikkat' };
    case 'dispute.opened':
      return { ikon: 'gavel', ton: 'dikkat' };
    case 'dispute.resolved':
    case 'dispute.rejected':
      return { ikon: 'gavel', ton: 'tertiary' };
    case 'campaign.granted':
      return { ikon: 'card-giftcard', ton: 'primary' };
    default:
      return { ikon: 'notifications', ton: 'tertiary' };
  }
}

/** Göreli zaman — Hermes'te Intl güvenilir değil, elle yazıyoruz. */
export function gecenSure(iso: string): string {
  const fark = Date.now() - new Date(iso).getTime();
  const dk = Math.floor(fark / 60_000);
  if (dk < 1) return 'az önce';
  if (dk < 60) return `${dk} dk`;
  const saat = Math.floor(dk / 60);
  if (saat < 24) return `${saat} sa`;
  const gun = Math.floor(saat / 24);
  if (gun < 30) return `${gun} gün`;
  return `${Math.floor(gun / 30)} ay`;
}

/**
 * Bildirimin götüreceği ekran; hedefi yoksa null.
 *
 * **Sohbet ürünün önünde.** Mesaj bildirimi hem `conversation` hem `product`
 * taşıyor; sıra ürüne öncelik verdiği için "Yeni mesajınız var"a dokunan
 * kullanıcı sohbete değil ilan sayfasına düşüyordu — mesajı okumak için orada
 * ayrıca "Mesaj"a basması gerekiyordu. Bildirimin amacı okunmasıysa varış yeri
 * mesajın kendisi olmalı.
 */
export function hedef(n: NotificationRow): string | null {
  if (typeof n.data.conversation === 'string') return `/chat/${n.data.conversation}`;
  if (typeof n.data.trade === 'string') return '/trades';
  if (typeof n.data.product === 'string') return `/product/${n.data.product}`;
  if (n.kind === 'campaign.granted') return '/wallet';
  return null;
}
