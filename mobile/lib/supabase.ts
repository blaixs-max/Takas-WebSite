import 'react-native-url-polyfill/auto';
// Sıra önemli: WebCrypto yaması istemci oluşturulmadan önce kurulmalı,
// yoksa supabase-js PKCE'yi zayıf `plain` yöntemiyle kurar.
import './webcrypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { eskiOturumKalintisiniTemizle, guvenliDepo } from './guvenliDepo';

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
        /* Jeton artık iOS Keychain / Android Keystore'da. Eskiden AsyncStorage
           idi ve orası şifresiz — root'lu cihazda oturum okunabiliyordu.
           `guvenliDepo` parçalama yapıyor: SecureStore girdi başına 2048
           baytla sınırlı ve Supabase oturumu bunu aşıyor. */
        storage: guvenliDepo,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;

/* AsyncStorage'da kalmış eski (şifresiz) oturum kaydını sil.
   Taşımıyoruz — şifresiz kopyayı ortadan kaldırmak amacın kendisi. Bedeli,
   o kayda sahip oturumların bir kez kapanması; bugün kayıtlı kullanıcı
   olmadığı için bedel sıfır ve bu yüzden şimdi yapılıyor.
   Beklenmiyor: istemci kurulumunu geciktirmemeli. */
void eskiOturumKalintisiniTemizle();
