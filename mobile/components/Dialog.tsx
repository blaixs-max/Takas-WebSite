import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, elevation, shape } from '../theme/tokens';

/**
 * Uygulama içi diyalog — `Alert.alert`'in yerine.
 *
 * ## Neden yerine geçti
 *
 * `Alert.alert` işletim sisteminin kendi kutusunu açıyor: iOS'ta sistem grisi
 * ve San Francisco, Android'de Material'ın varsayılan teması. İkisi de
 * uygulamanın kremini, turkuazını ve yuvarlaklığını taşımıyor — kutu
 * uygulamadan değil, telefondan geliyormuş gibi duruyor. Kullanıcı bunu
 * "başka bir mesaj" diye okuyor, ki haklı: gerçekten başka bir katmandan
 * geliyor.
 *
 * ## Neden kanca değil de modül düzeyinde bir işlev
 *
 * `uyar()` her yerden — bileşenin içinden de, `lib/` altındaki bir yardımcıdan
 * da — çağrılabilsin diye. Otuz altı çağrı yerini kanca bağlantısıyla
 * dolaştırmak, `Alert.alert` → `uyar` değişiminden kat kat büyük bir iş
 * olurdu ve kazancı sıfırdı. Çağrı biçimi bilerek `Alert.alert` ile aynı:
 * başlık, gövde, düğme dizisi.
 *
 * Tek pencereli bir uygulamada tek bir sunucu (host) yeterli; React Native'in
 * kendi `Alert`'i de aynı biçimde çalışıyor.
 */

export interface DialogDugmesi {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface DialogIstek {
  baslik: string;
  mesaj?: string;
  dugmeler: DialogDugmesi[];
}

let sunucuyaGonder: ((istek: DialogIstek) => void) | null = null;

/**
 * Diyalog açar. `Alert.alert` ile aynı imza.
 *
 * Sunucu henüz bağlanmamışsa (kuramsal olarak: kök düzen çizilmeden önce)
 * çağrı sessizce düşer — sistem kutusuna geri dönmek, tam da kaçındığımız
 * görünümü geri getirirdi.
 */
export function uyar(baslik: string, mesaj?: string, dugmeler?: DialogDugmesi[]): void {
  sunucuyaGonder?.({
    baslik,
    mesaj,
    dugmeler: dugmeler?.length ? dugmeler : [{ text: 'Tamam' }],
  });
}

/** Kök düzende bir kez çizilir. */
export function DialogHost() {
  const [istek, setIstek] = useState<DialogIstek | null>(null);
  /* Aynı anda ikinci bir diyalog istenirse sıraya girer; üst üste binen iki
     modal Android'de ikincisini hiç göstermiyor. */
  const kuyruk = useRef<DialogIstek[]>([]);

  useEffect(() => {
    sunucuyaGonder = (yeni) => {
      setIstek((mevcut) => {
        if (mevcut) {
          kuyruk.current.push(yeni);
          return mevcut;
        }
        return yeni;
      });
    };
    return () => {
      sunucuyaGonder = null;
    };
  }, []);

  function kapat(d?: DialogDugmesi) {
    setIstek(kuyruk.current.shift() ?? null);
    d?.onPress?.();
  }

  /* Android geri tuşu: iptal düğmesi varsa onu işletir, yoksa kapatır.
     Sessizce yok saymak, kullanıcıyı kutunun içine hapsederdi. */
  function geriTusu() {
    if (!istek) return;
    const iptal = istek.dugmeler.find((d) => d.style === 'cancel');
    kapat(iptal ?? undefined);
  }

  useEffect(() => {
    if (!istek) return;
    const abone = BackHandler.addEventListener('hardwareBackPress', () => {
      geriTusu();
      return true;
    });
    return () => abone.remove();
  });

  return (
    <Modal
      visible={istek !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={geriTusu}
    >
      {/* Perdeye dokunmak yalnızca iptal edilebilir diyalogları kapatır.
          Tek düğmeli bir bilgi kutusunu perdeyle kapatmak, kullanıcının
          mesajı okumadan geçmesini kolaylaştırırdı. */}
      <Pressable
        style={styles.perde}
        onPress={() => {
          const iptal = istek?.dugmeler.find((d) => d.style === 'cancel');
          if (iptal) kapat(iptal);
        }}
      >
        {/* İçe dokunuş perdeye ulaşmasın. */}
        <Pressable style={styles.kart} onPress={() => {}} accessibilityViewIsModal>
          <Text style={styles.baslik} accessibilityRole="header">
            {istek?.baslik}
          </Text>
          {istek?.mesaj ? <Text style={styles.mesaj}>{istek.mesaj}</Text> : null}

          <View style={styles.dugmeler}>
            {istek?.dugmeler.map((d, i) => (
              <Pressable
                key={`${d.text}-${i}`}
                style={styles.dugme}
                onPress={() => kapat(d)}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.dugmeText,
                    d.style === 'cancel' && styles.dugmeIptal,
                    d.style === 'destructive' && styles.dugmeYikici,
                  ]}
                >
                  {d.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  perde: {
    flex: 1,
    backgroundColor: 'rgba(31,41,55,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  kart: {
    width: '100%',
    maxWidth: 420,
    borderRadius: shape.xl,
    backgroundColor: colors.surfaceContainerLow,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 12,
    ...elevation.level3,
  },
  baslik: { fontSize: 19, fontWeight: '800', color: colors.onSurface },
  mesaj: { fontSize: 14.5, lineHeight: 21, fontWeight: '500', color: colors.onSurfaceVariant, marginTop: 10 },
  /* M3 diyalog düğmeleri metin düğmesidir ve sağa yaslanır; en sağdaki
     onaylayan eylemdir. Çağrı yerleri zaten [iptal, onay] sırasıyla yazılmış. */
  dugmeler: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 18 },
  dugme: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' },
  dugmeText: { fontSize: 14.5, fontWeight: '700', color: colors.primary },
  dugmeIptal: { color: colors.onSurfaceVariant },
  dugmeYikici: { color: colors.error },
});
