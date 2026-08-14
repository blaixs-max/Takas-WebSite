import React, { useRef } from 'react';
import { Animated, Image, ImageSourcePropType, Platform, ScrollView, StyleSheet } from 'react-native';
import { PinchGestureHandler, PinchGestureHandlerGestureEvent, State } from 'react-native-gesture-handler';

/**
 * Tam ekran görüntüleyicideki tek kare — iki parmakla yakınlaştırılabilir.
 *
 * ## Neden iki ayrı yol
 *
 * `ScrollView`in `maximumZoomScale`/`minimumZoomScale` özellikleri **yalnızca
 * iOS'ta** çalışıyor; Android'de sessizce yok sayılıyorlar. Yani kare tam
 * ekran açılıyordu ama Android'de yakınlaştırma diye bir şey yoktu ve bunu
 * kullanıcıya söyleyen de bir şey yoktu.
 *
 * iOS tarafı olduğu gibi bırakıldı: çalışan, platformun kendi davranışını
 * kullanan bir yol. Android'e `PinchGestureHandler` kondu. Tek bir ortak yol
 * yazmak daha temiz görünürdü ama çalışan iOS davranışını sınanmamış kodla
 * değiştirmek anlamına gelirdi.
 *
 * ## Ölçek nasıl sınırlanıyor
 *
 * Jest sırasında ölçek doğrudan parmağı izliyor; jest bitince 1'in altına
 * inmişse 1'e, 4'ün üstüne çıkmışsa 4'e yaylanıyor. Sınırı jest sırasında
 * uygulamak parmağın altında takılma hissi veriyor.
 */
export function YakinlastirilabilirKare({
  kaynak,
  genislik,
  sayfaStili,
  resimStili,
}: {
  kaynak: ImageSourcePropType;
  genislik: number;
  sayfaStili?: object;
  resimStili?: object;
}) {
  const olcek = useRef(new Animated.Value(1)).current;
  const sonOlcek = useRef(1);

  if (Platform.OS === 'ios') {
    return (
      <ScrollView
        style={{ width: genislik }}
        contentContainerStyle={sayfaStili}
        maximumZoomScale={4}
        minimumZoomScale={1}
        centerContent
        showsVerticalScrollIndicator={false}
      >
        <Image source={kaynak} style={resimStili} resizeMode="contain" />
      </ScrollView>
    );
  }

  function jestDegisti(e: PinchGestureHandlerGestureEvent) {
    if (e.nativeEvent.state !== State.END) return;
    const hedef = Math.min(4, Math.max(1, sonOlcek.current * e.nativeEvent.scale));
    sonOlcek.current = hedef;
    Animated.spring(olcek, { toValue: hedef, useNativeDriver: true, bounciness: 0 }).start();
  }

  return (
    <PinchGestureHandler
      onGestureEvent={Animated.event([{ nativeEvent: { scale: olcek } }], {
        useNativeDriver: true,
      })}
      onHandlerStateChange={jestDegisti}
    >
      <Animated.View style={[{ width: genislik }, sayfaStili, styles.orta]}>
        <Animated.Image
          source={kaynak}
          style={[resimStili, { transform: [{ scale: olcek }] }]}
          resizeMode="contain"
        />
      </Animated.View>
    </PinchGestureHandler>
  );
}

const styles = StyleSheet.create({
  orta: { alignItems: 'center', justifyContent: 'center' },
});
