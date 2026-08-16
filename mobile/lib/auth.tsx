import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabase';
import { APP_SCHEME, AUTH_REDIRECT_PATH } from './brand';

WebBrowser.maybeCompleteAuthSession();

type OAuthProvider = 'google' | 'apple';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** Supabase yapılandırılmamışsa (anahtar yok) demo/serbest mod. */
  configured: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error?: string }>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<{ error?: string }>;
  /** Şifre sıfırlama bağlantısı gönderir. Oturum gerektirmez. */
  sifreSifirlamaGonder: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

// Oturum süresi dolmasın diye uygulama öne gelince token yenilemeyi tetikle
AppState.addEventListener('change', (state) => {
  if (!supabase) return;
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      configured: supabaseConfigured,

      async signInWithEmail(email, password) {
        if (!supabase) return { error: 'Supabase yapılandırılmadı' };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? { error: error.message } : {};
      },

      /**
        * Kayıt — **ad zorunlu.**
        *
        * Eskiden yalnızca e-posta ve şifre alıyordu, `raw_user_meta_data` boş
        * kalıyordu. `create_listing` satıcı adını oradan okuyor ve boşsa
        * `split_part(email, '@', 1)`e düşüyor; ilk gerçek ilan vitrine
        * **`emrahatabek`** diye çıktı. Site açık web ve indeksleniyor, yani
        * kişinin e-postasının yarısı yayınlanmış oluyordu.
        *
        * Site tarafına "e-postadan türeyen adı yayınlama" kuralı konuldu ve o
        * kural bugün "Üye" yazıyor — doğru, ama bir yama. Kök sebep buydu:
        * kullanıcıya adı hiç sorulmuyordu.
        *
        * Anahtar `full_name`; `create_listing`, `publish_listing` ve
        * `lib/profile.ts` üçü de bu anahtarı okuyor.
        */
      async signUpWithEmail(email, password, fullName) {
        if (!supabase) return { error: 'Supabase yapılandırılmadı' };
        const ad = fullName.trim();
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: ad } },
        });
        return error ? { error: error.message } : {};
      },

      async signInWithOAuth(provider) {
        if (!supabase) return { error: 'Supabase yapılandırılmadı' };
        const redirectTo = makeRedirectUri({ scheme: APP_SCHEME, path: AUTH_REDIRECT_PATH });
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error || !data?.url) return { error: error?.message ?? 'OAuth başlatılamadı' };

        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type !== 'success') return { error: 'Giriş iptal edildi' };

        // PKCE: dönüş URL'indeki code → oturum
        const code = new URL(res.url).searchParams.get('code');
        if (!code) return { error: 'Yetkilendirme kodu alınamadı' };
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        return exErr ? { error: exErr.message } : {};
      },

      /**
       * Şifre sıfırlama bağlantısı.
       *
       * `Güvenlik & doğrulama` ekranında zaten bir sıfırlama vardı ama oraya
       * girmek için **oturum açmış olmak** gerekiyordu — yani tam da şifresini
       * unutan kişinin ulaşamadığı yerdeydi. Bu yüzden giriş ekranına taşındı.
       *
       * `redirectTo` bilerek veriliyor: verilmezse Supabase bağlantıyı projenin
       * Site URL'ine yollar, o da varsayılanda `localhost:3000`'dir. Mobil
       * kullanıcı e-postadaki bağlantıya bastığında hiçbir yere gitmez.
       * Uygulamanın derin bağlantısı `eldenele://auth-callback`.
       */
      async sifreSifirlamaGonder(email) {
        if (!supabase) return { error: 'Supabase yapılandırılmadı' };
        const redirectTo = makeRedirectUri({ scheme: APP_SCHEME, path: AUTH_REDIRECT_PATH });
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        return error ? { error: error.message } : {};
      },

      async signOut() {
        await supabase?.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return ctx;
}
