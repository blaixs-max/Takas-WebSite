import { supabase, supabaseConfigured } from './supabase';

/**
 * Alıcı–satıcı mesajlaşması.
 *
 * Sohbet ürüne bağlıdır, takasa değil: alıcının satın almadan önce soru
 * sorabilmesi gerekiyor. Takas açıldığında aynı sohbet devam eder.
 *
 * Gönderilmiş mesaj değiştirilemez ve silinemez — uyuşmazlıkta konuşma kaydı
 * kanıttır ve sonradan düzenlenebilen bir kanıt kanıt değildir.
 */

export interface ConversationRow {
  id: string;
  productId: string;
  productTitle: string;
  karsiTaraf: string;
  benAliciyim: boolean;
  sonMesaj: string | null;
  sonMesajAt: string | null;
  okunmamis: number;
}

export async function loadConversations(): Promise<ConversationRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc('my_conversations');
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((c) => ({
    id: c.conversation_id as string,
    productId: c.product_id as string,
    productTitle: (c.product_title as string) ?? 'İlan kaldırılmış',
    karsiTaraf: (c.karsi_taraf as string) ?? '—',
    benAliciyim: c.ben_aliciyim === true,
    sonMesaj: (c.son_mesaj as string) ?? null,
    sonMesajAt: (c.son_mesaj_at as string) ?? null,
    okunmamis: Number(c.okunmamis ?? 0),
  }));
}

/**
 * Okunmamış **mesaj** sayısı — sohbetlerin toplamı.
 *
 * Profildeki "Mesajlarım" satırı bu sayıyı değil, bildirim sayacını
 * (`unreadCount`, `lib/notifications.ts`) gösteriyordu. İkisi ayrı şeyler:
 * ilan yayına alındığında bildirim düşer, mesaj düşmez. Sonuç, gelen kutusu
 * bomboşken "1 okunmamış mesaj" yazmasıydı; kullanıcı satıra basıyor ve
 * hiçbir şey bulamıyordu.
 *
 * Sunucuda ayrı bir sayaç yok — `my_conversations`'ın satır başına döndürdüğü
 * `okunmamis` değerlerinin toplamı.
 */
export async function unreadMessageCount(): Promise<number> {
  const sohbetler = await loadConversations();
  return sohbetler.reduce((toplam, s) => toplam + s.okunmamis, 0);
}

export interface MessageRow {
  id: string;
  body: string;
  benim: boolean;
  createdAt: string;
}

export async function loadMessages(conversationId: string): Promise<MessageRow[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data: oturum } = await supabase.auth.getUser();
  const uid = oturum?.user?.id;

  const { data, error } = await supabase
    .from('messages')
    .select('id, body, sender_id, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];

  return data.map((m) => ({
    id: m.id as string,
    body: m.body as string,
    benim: m.sender_id === uid,
    createdAt: m.created_at as string,
  }));
}

export type SendResult = { ok: true; id: string } | { ok: false; message: string };

export async function sendMessage(conversationId: string, body: string): Promise<SendResult> {
  if (!supabaseConfigured || !supabase) return { ok: false, message: 'Sunucu bağlantısı yok.' };
  const { data, error } = await supabase.rpc('send_message', {
    p_conversation_id: conversationId,
    p_body: body,
  });
  if (error) return { ok: false, message: cevir(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, id: (row?.id as string) ?? '' };
}

/** İlan üzerinden sohbeti açar ya da varsa onu getirir. */
export async function startConversation(
  productId: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (!supabaseConfigured || !supabase) return { ok: false, message: 'Sunucu bağlantısı yok.' };
  const { data, error } = await supabase.rpc('start_conversation', { p_product_id: productId });
  if (error) return { ok: false, message: cevir(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) return { ok: false, message: 'Sohbet açılamadı.' };
  return { ok: true, id: row.id as string };
}

export async function markConversationRead(conversationId: string): Promise<void> {
  if (!supabaseConfigured || !supabase) return;
  await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
}

/**
 * Yeni mesajları canlı dinler.
 *
 * Realtime yayını kapalıysa hiçbir şey olmaz; ekran yine çalışır, yalnızca
 * kullanıcının tazelemesi gerekir. Bu yüzden abonelik bir gereklilik değil,
 * varsa kullanılan bir kolaylıktır.
 */
export function subscribeMessages(conversationId: string, onNew: () => void): () => void {
  if (!supabaseConfigured || !supabase) return () => {};
  const kanal = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      () => onNew(),
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(kanal);
  };
}

/** Saat:dakika — Hermes'te Intl güvenilir değil. */
export function saat(iso: string): string {
  const d = new Date(iso);
  const iki = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${iki(d.getHours())}:${iki(d.getMinutes())}`;
}

function cevir(mesaj: string): string {
  if (mesaj.includes('kendi ilanınıza')) return 'Kendi ilanınıza mesaj gönderemezsiniz.';
  if (mesaj.includes('henüz yayında değil')) return 'Bu ilan henüz yayında değil.';
  if (mesaj.includes('tarafı değilsiniz')) return 'Bu sohbetin tarafı değilsiniz.';
  if (mesaj.includes('boş mesaj')) return 'Boş mesaj gönderilemez.';
  if (mesaj.includes('oturum bulunamadı')) return 'Giriş yapmalısınız.';
  if (mesaj.includes('ilan bulunamadı')) return 'İlan bulunamadı.';
  return 'Mesaj gönderilemedi. Bağlantınızı kontrol edin.';
}

export type ReportReason = 'HARASSMENT' | 'OFF_PLATFORM' | 'SCAM' | 'INAPPROPRIATE' | 'OTHER';

export const SIKAYET_NEDENLERI: { kod: ReportReason; etiket: string }[] = [
  { kod: 'HARASSMENT', etiket: 'Taciz veya hakaret' },
  { kod: 'OFF_PLATFORM', etiket: 'Platform dışına yönlendiriyor' },
  { kod: 'SCAM', etiket: 'Dolandırıcılık şüphesi' },
  { kod: 'INAPPROPRIATE', etiket: 'Uygunsuz içerik' },
  { kod: 'OTHER', etiket: 'Diğer' },
];

/**
 * Mesajı şikâyet eder.
 *
 * Şikâyet etmek suçlama değildir ve karşı tarafın skorunu kendiliğinden
 * düşürmez — yalnızca onaylanmış ihlal düşürür. Aksi hâlde şikâyet bir silaha
 * dönüşürdü.
 */
export async function reportMessage(
  messageId: string,
  reason: ReportReason,
  note?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabaseConfigured || !supabase) return { ok: false, message: 'Sunucu bağlantısı yok.' };
  const { error } = await supabase.rpc('report_message', {
    p_message_id: messageId,
    p_reason: reason,
    p_note: note ?? null,
  });
  if (error) {
    if (error.message.includes('kendi mesajınızı')) {
      return { ok: false, message: 'Kendi mesajınızı şikâyet edemezsiniz.' };
    }
    return { ok: false, message: 'Şikâyet gönderilemedi. Tekrar deneyin.' };
  }
  return { ok: true };
}
