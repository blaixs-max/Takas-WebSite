import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, shape } from '../theme/tokens';

export default function EditProfile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [name, setName] = useState('Emrah Atabek');
  const [city, setCity] = useState('Kadıköy, İstanbul');
  const [bio, setBio] = useState('İki çocuk babası. Montessori ve ahşap oyuncak takasını seviyorum.');

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.appbar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Profili düzenle</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.save}>Kaydet</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>EA</Text>
          </View>
          <Pressable style={styles.camera}>
            <MaterialIcons name="photo-camera" size={18} color="#fff" />
          </Pressable>
        </View>
        <Text style={styles.changePhoto}>Fotoğrafı değiştir</Text>

        <Text style={styles.label}>AD SOYAD</Text>
        <View style={styles.field}>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.onSurfaceVariant} />
        </View>

        <Text style={styles.label}>KONUM</Text>
        <View style={styles.field}>
          <MaterialIcons name="place" size={20} color={colors.onSurfaceVariant} />
          <TextInput style={styles.input} value={city} onChangeText={setCity} placeholderTextColor={colors.onSurfaceVariant} />
        </View>

        <Text style={styles.label}>HAKKINDA</Text>
        <View style={[styles.field, styles.bioField]}>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={bio}
            onChangeText={setBio}
            multiline
            placeholderTextColor={colors.onSurfaceVariant}
          />
        </View>

        <Pressable style={styles.saveBtn} onPress={() => router.back()}>
          <MaterialIcons name="check" size={20} color="#fff" />
          <Text style={styles.saveBtnText}>Değişiklikleri kaydet</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 6 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.onSurface },
  save: { color: colors.primary, fontWeight: '700', fontSize: 14, paddingHorizontal: 12 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatarWrap: { alignSelf: 'center', marginTop: 6 },
  avatar: { width: 96, height: 96, borderRadius: shape.full, backgroundColor: colors.tertiary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 34, fontWeight: '800', color: '#fff' },
  camera: { position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: shape.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.surface },
  changePhoto: { alignSelf: 'center', color: colors.primary, fontWeight: '700', fontSize: 13, marginTop: 10, marginBottom: 18 },
  label: { fontSize: 12, fontWeight: '700', color: colors.onSurfaceVariant, letterSpacing: 0.4, marginBottom: 8, marginTop: 14 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, paddingHorizontal: 16, borderRadius: shape.sm, backgroundColor: colors.surfaceContainerHigh },
  bioField: { alignItems: 'flex-start', paddingVertical: 12 },
  input: { flex: 1, fontSize: 15, color: colors.onSurface },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: shape.full, backgroundColor: colors.primary, marginTop: 28, ...elevation.level1 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
