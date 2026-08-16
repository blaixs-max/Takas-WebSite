import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Supabase oturumunun saklandığı yer.
 *
 * ## Neden AsyncStorage yetmiyor
 *
 * Jeton `AsyncStorage`'daydı ve orası **şifresiz**: iOS'ta uygulamanın kum
 * havuzunda düz bir dosya, Android'de düz bir SQLite kaydı. Cihaz root'lu ya
 * da jailbreak'liyse, ya da yedek çözülebiliyorsa, oturum jetonu okunabilir.
 * Jeton okunan kişinin hesabına girilebilir: puanı, adresi, mesajları.
 *
 * `SecureStore` bunu iOS Keychain ve Android Keystore'a taşıyor — anahtar
 * donanım destekli saklanıyor ve uygulama dışından okunamıyor.
 *
 * ## Neden düz bir `SecureStore` sarmalayıcısı değil
 *
 * **SecureStore girdi başına 2048 baytla sınırlı.** Supabase oturumu erişim
 * jetonu, yenileme jetonu ve kullanıcı nesnesini birlikte tutuyor; JSON'u
 * rahatlıkla bu sınırı aşıyor. Doğrudan bağlansaydı oturum **sessizce
 * kaydedilmezdi** — kullanıcı her açılışta yeniden giriş yapardı ve sebebi
 * hiçbir yerde görünmezdi.
 *
 * Bu yüzden değer parçalara bölünüyor: `anahtar.0`, `anahtar.1`, … ve kaç
 * parça olduğu `anahtar` altında tutuluyor. Okurken parçalar birleştiriliyor.
 *
 * ## Web'de SecureStore yok
 *
 * `expo-secure-store` web'de çalışmıyor. Uygulama web'de yalnızca geliştirme
 * ve ekran görüntüsü için açılıyor, orada `AsyncStorage`'a düşülüyor.
 *
 * ## Eski oturumlar
 *
 * `AsyncStorage`'daki eski kayıt taşınmıyor, **siliniyor**: taşımak, şifresiz
 * kopyayı bir süre daha yerinde bırakmak demekti. Bedeli, mevcut oturumların
 * bir kez kapanması. Bunu şimdi yapmanın sebebi de bu — bugün kayıtlı
 * kullanıcı yok, yani bedeli sıfır.
 */

/** SecureStore'un girdi başına sınırı 2048 bayt; güvenli tarafta kalıyoruz. */
const PARCA = 1800;

const web = Platform.OS === 'web';

async function sil(anahtar: string): Promise<void> {
  const sayiHam = await SecureStore.getItemAsync(anahtar).catch(() => null);
  const sayi = Number(sayiHam ?? 0);
  await SecureStore.deleteItemAsync(anahtar).catch(() => {});
  for (let i = 0; i < sayi; i++) {
    await SecureStore.deleteItemAsync(`${anahtar}.${i}`).catch(() => {});
  }
}

export const guvenliDepo = {
  async getItem(anahtar: string): Promise<string | null> {
    if (web) return AsyncStorage.getItem(anahtar);

    const sayiHam = await SecureStore.getItemAsync(anahtar).catch(() => null);
    if (sayiHam === null) return null;

    const sayi = Number(sayiHam);
    if (!Number.isInteger(sayi) || sayi < 1) return null;

    const parcalar: string[] = [];
    for (let i = 0; i < sayi; i++) {
      const p = await SecureStore.getItemAsync(`${anahtar}.${i}`).catch(() => null);
      /* Bir parça eksikse birleştirilen değer bozuk JSON olurdu ve
         supabase-js onu çözemeyip beklenmedik biçimde davranırdı. Yarım
         oturumdansa oturumsuzluk: null dönüp yeniden giriş istiyoruz. */
      if (p === null) return null;
      parcalar.push(p);
    }
    return parcalar.join('');
  },

  async setItem(anahtar: string, deger: string): Promise<void> {
    if (web) return AsyncStorage.setItem(anahtar, deger);

    // Parça sayısı değişebilir; eskiler kalırsa okumada karışıklık olur.
    await sil(anahtar);

    const parcalar: string[] = [];
    for (let i = 0; i < deger.length; i += PARCA) parcalar.push(deger.slice(i, i + PARCA));

    for (let i = 0; i < parcalar.length; i++) {
      await SecureStore.setItemAsync(`${anahtar}.${i}`, parcalar[i]);
    }
    /* Sayaç EN SON yazılıyor: yarıda kesilen bir yazma, okunmaya çalışılan
       eksik bir oturum bırakmasın. Sayaç yoksa `getItem` null döner. */
    await SecureStore.setItemAsync(anahtar, String(parcalar.length));
  },

  async removeItem(anahtar: string): Promise<void> {
    if (web) return AsyncStorage.removeItem(anahtar);
    await sil(anahtar);
  },
};

/**
 * `AsyncStorage`'da kalmış eski oturum kayıtlarını siler.
 *
 * Bir kez, uygulama açılırken çalışır. Taşıma yapmıyor — şifresiz kopyayı
 * silmek amacın kendisi.
 */
export async function eskiOturumKalintisiniTemizle(): Promise<void> {
  if (web) return;
  try {
    const anahtarlar = await AsyncStorage.getAllKeys();
    const oturum = anahtarlar.filter((k) => k.startsWith('sb-') || k.startsWith('supabase.'));
    if (oturum.length > 0) await AsyncStorage.multiRemove(oturum);
  } catch {
    // Temizlik başarısız olursa uygulama yine çalışmalı.
  }
}
