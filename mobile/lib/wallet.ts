import { MaterialIcons } from '@expo/vector-icons';
import { supabase, supabaseConfigured } from './supabase';

/** wallet_entries.type ile birebir. */
export type EntryType = 'EARN' | 'HOLD' | 'RELEASE_IN' | 'RELEASE_OUT' | 'REFUND';

export interface WalletBalance {
  available: number;
  held: number;
  earnedThisMonth: number;
  trustScore: number;
}

export interface WalletTx {
  id: string;
  title: string;
  sub: string;
  subIcon: keyof typeof MaterialIcons.glyphMap;
  value: string; // "+260" / "−340" / "340"
  tone: 'pos' | 'pool' | 'neutral';
  icon: keyof typeof MaterialIcons.glyphMap;
}

export interface WalletData {
  source: 'live' | 'demo';
  balance: WalletBalance;
  entries: WalletTx[];
}

/** Bir defter kaydını ekranda gösterilecek biçime çevirir. */
function mapEntry(e: {
  id: number | string;
  type: EntryType;
  amount: number;
  memo: string | null;
  created_at: string;
}): WalletTx {
  const d = new Date(e.created_at);
  const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const date = `${d.getDate()} ${AYLAR[d.getMonth()]}`;
  const base = { id: String(e.id), sub: `${date}${e.memo ? ' · ' + e.memo : ''}` };
  switch (e.type) {
    case 'EARN':
      return { ...base, title: 'Puan kazanıldı', subIcon: 'verified', value: `+${e.amount}`, tone: 'pos', icon: 'add-circle' };
    case 'HOLD':
      return { ...base, title: 'Güvenli havuza alındı', subIcon: 'schedule', value: `−${e.amount}`, tone: 'pool', icon: 'lock' };
    case 'RELEASE_IN':
      return { ...base, title: 'Takas tamamlandı — puan alındı', subIcon: 'trending-up', value: `+${e.amount}`, tone: 'pos', icon: 'swap-horiz' };
    case 'RELEASE_OUT':
      return { ...base, title: 'Teslim onaylandı', subIcon: 'check-circle', value: `${e.amount}`, tone: 'neutral', icon: 'check-circle' };
    case 'REFUND':
      return { ...base, title: 'İade edildi', subIcon: 'undo', value: `+${e.amount}`, tone: 'pos', icon: 'undo' };
  }
}

/** Anahtar/oturum yokken gösterilen örnek veri (ekran her zaman dolu görünür). */
export const DEMO_WALLET: WalletData = {
  source: 'demo',
  balance: { available: 1260, held: 360, earnedThisMonth: 540, trustScore: 96 },
  entries: [
    { id: 'd1', title: 'Renk ayırma oyunu eklendi', sub: '21 Haz · AI onaylı', subIcon: 'verified', value: '+260', tone: 'pos', icon: 'add-circle' },
    { id: 'd2', title: 'Halka kulesi · havuzda', sub: 'Teslim onayı bekliyor', subIcon: 'schedule', value: '−340', tone: 'pool', icon: 'lock' },
    { id: 'd3', title: 'Ahşap blok takası tamamlandı', sub: '18 Haz · güven +2', subIcon: 'trending-up', value: '+420', tone: 'pos', icon: 'swap-horiz' },
    { id: 'd4', title: 'Davet bonusu', sub: '15 Haz · arkadaş katıldı', subIcon: 'group-add', value: '+100', tone: 'pos', icon: 'card-giftcard' },
  ],
};

/**
 * Cüzdanı yükler. Supabase yapılandırılmış ve oturum varsa CANLI veri,
 * aksi halde DEMO veri döner. Defter güvenliği RLS ile korunur.
 */
export async function loadWallet(): Promise<WalletData> {
  if (!supabaseConfigured || !supabase) return DEMO_WALLET;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEMO_WALLET;

  const [walletRes, entriesRes] = await Promise.all([
    supabase.from('wallets').select('available_points, held_points').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('wallet_entries')
      .select('id, type, amount, memo, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const w = walletRes.data;
  if (!w) return DEMO_WALLET; // henüz cüzdan yok → demo

  const entries = (entriesRes.data ?? []) as Parameters<typeof mapEntry>[0][];

  // Bu ay kazanılan = bu ayki EARN + RELEASE_IN toplamı
  const now = new Date();
  const earnedThisMonth = entries
    .filter((e) => (e.type === 'EARN' || e.type === 'RELEASE_IN') && new Date(e.created_at).getMonth() === now.getMonth() && new Date(e.created_at).getFullYear() === now.getFullYear())
    .reduce((s, e) => s + e.amount, 0);

  return {
    source: 'live',
    balance: {
      available: w.available_points,
      held: w.held_points,
      earnedThisMonth,
      trustScore: 96, // güven skoru ayrı profil metriği (defterde değil)
    },
    entries: entries.map(mapEntry),
  };
}
