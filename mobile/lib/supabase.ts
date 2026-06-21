import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase istemcisi.
 * Anahtarlar EXPO_PUBLIC_* ortam değişkenlerinden gelir (app config / .env).
 * Anahtar yoksa istemci null olur ve uygulama demo veriye düşer.
 *
 * NOT: Yalnızca ANON key kullanılır; service_role asla mobilde olmaz.
 * Cüzdan/defter okumaları RLS ile auth.uid() üzerinden korunur.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured: boolean = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;
