import { Component, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { hataBildir } from '../lib/hatalar';
import { colors, shape } from '../theme/tokens';

/**
 * Çizim sırasındaki bir hata bütün uygulamayı götürmesin.
 *
 * Bugüne kadar hata sınırı **yoktu**: bileşen ağacının herhangi bir yerindeki
 * bir hata kökü söküyor ve ekran beyaza düşüyordu. Kullanıcının gördüğü şey
 * boş bir ekrandı — ne olduğu, ne yapması gerektiği, hatta uygulamanın çökmüş
 * olduğu bile yazmıyordu.
 *
 * İki iş yapıyor ve ikincisi daha önemli:
 *   1. Kullanıcıya ne olduğunu söyleyip bir çıkış veriyor.
 *   2. Hatayı **bildiriyor**. Sınır olmadan hata sessizce kayboluyordu.
 *
 * `ErrorBoundary` yalnızca **çizim** hatalarını yakalar; `setTimeout` ya da
 * bir `Promise` içindeki hatayı görmez. Onları `kureselYakalayiciyiKur`
 * yakalıyor — ikisi birlikte gerekiyor.
 *
 * Sınıf bileşeni olmak zorunda: `componentDidCatch`in kanca (hook) karşılığı
 * React'te yok.
 */
interface Props {
  children: ReactNode;
}

interface State {
  hata: Error | null;
}

export class HataSiniri extends Component<Props, State> {
  state: State = { hata: null };

  static getDerivedStateFromError(hata: Error): State {
    return { hata };
  }

  componentDidCatch(hata: Error, bilgi: { componentStack?: string | null }) {
    /* Bileşen yığını, JS yığınından daha faydalı: hangi ekranın hangi
       parçasının patladığını söylüyor. İlk 1500 karakter yeterli — gerisi
       kök bileşenlere kadar giden tekrar. */
    void hataBildir(hata, {
      kaynak: 'cizim',
      bilesenYigini: bilgi.componentStack?.slice(0, 1500) ?? null,
    });
  }

  render() {
    if (!this.state.hata) return this.props.children;

    return (
      <View style={styles.root}>
        <View style={styles.ikon}>
          <MaterialIcons name="error-outline" size={30} color={colors.error} />
        </View>
        <Text style={styles.baslik}>Bir şeyler ters gitti</Text>
        <Text style={styles.metin}>
          Beklenmedik bir hata oldu ve ekran yüklenemedi. Sorunu bize bildirdik.
        </Text>

        {/* Tek çıkış: yeniden dene. Uygulamayı kapattırmak yerine ağacı
            yeniden kurmayı deniyoruz — hatanın çoğu geçici bir durumdan
            (kopan bir istek, yarım kalan bir veri) geliyor ve ikinci
            denemede geçiyor. */}
        <Pressable style={styles.dugme} onPress={() => this.setState({ hata: null })}>
          <MaterialIcons name="refresh" size={19} color="#fff" />
          <Text style={styles.dugmeText}>Yeniden dene</Text>
        </Pressable>

        {/* Geliştirmede hatanın kendisi görünüyor; yayında görünmüyor.
            Kullanıcıya yığın izi göstermek ona bir şey anlatmaz ve içinde
            teknik ayrıntı taşır. */}
        {__DEV__ && <Text style={styles.detay}>{String(this.state.hata?.message)}</Text>}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
    backgroundColor: colors.surface,
  },
  ikon: {
    width: 60,
    height: 60,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorContainer,
    marginBottom: 4,
  },
  baslik: { fontSize: 17, fontWeight: '800', color: colors.onSurface },
  metin: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 19,
  },
  dugme: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 22,
    borderRadius: shape.full,
    backgroundColor: colors.primary,
    marginTop: 12,
  },
  dugmeText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  detay: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },
});
