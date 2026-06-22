import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shape } from '../../theme/tokens';

interface Msg {
  id: number;
  text: string;
  mine: boolean;
  time: string;
}

const SEED: Msg[] = [
  { id: 1, text: 'Merhaba! Halka kulesi hâlâ takasta mı?', mine: true, time: '14:02' },
  { id: 2, text: 'Merhaba, evet 🙂 İlgilendiğiniz için teşekkürler.', mine: false, time: '14:03' },
  { id: 3, text: 'Tüm parçalar tam mı? Kutusu var mı?', mine: true, time: '14:03' },
  { id: 4, text: 'Tüm parçalar tam, orijinal kutusuyla gönderiyorum.', mine: false, time: '14:05' },
  { id: 5, text: 'Harika, takas başlatıyorum. Güvenli havuz puanı tutacak.', mine: true, time: '14:06' },
];

export default function Chat() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [msgs, setMsgs] = useState<Msg[]>(SEED);
  const [text, setText] = useState('');

  function send() {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { id: m.length + 1, text: text.trim(), mine: true, time: 'şimdi' }]);
    setText('');
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.appbar, { paddingTop: insets.top }]}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={styles.av}>
          <Text style={styles.avText}>{(id ?? 'S').slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>Satıcı</Text>
          <Text style={styles.status}>● çevrimiçi</Text>
        </View>
        <Pressable style={styles.iconBtn}>
          <MaterialIcons name="more-vert" size={24} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} showsVerticalScrollIndicator={false}>
        <View style={styles.dayChip}>
          <Text style={styles.dayText}>Bugün</Text>
        </View>
        {msgs.map((m) => (
          <View key={m.id} style={[styles.bubbleRow, m.mine ? styles.rowMine : styles.rowTheirs]}>
            <View style={[styles.bubble, m.mine ? styles.mine : styles.theirs]}>
              <Text style={[styles.msgText, m.mine && { color: '#fff' }]}>{m.text}</Text>
              <Text style={[styles.msgTime, m.mine && { color: 'rgba(255,255,255,0.7)' }]}>{m.time}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Mesaj yaz…"
            placeholderTextColor={colors.onSurfaceVariant}
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
          />
        </View>
        <Pressable style={styles.sendBtn} onPress={send}>
          <MaterialIcons name="send" size={22} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  appbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingBottom: 8, backgroundColor: colors.surfaceContainerLow },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  av: { width: 38, height: 38, borderRadius: shape.full, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' },
  avText: { fontWeight: '800', fontSize: 13, color: colors.onSecondaryContainer },
  name: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  status: { fontSize: 11, fontWeight: '600', color: colors.primary, marginTop: 1 },
  dayChip: { alignSelf: 'center', backgroundColor: colors.surfaceContainerHigh, borderRadius: shape.full, paddingHorizontal: 12, paddingVertical: 4 },
  dayText: { fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.surfaceContainerHigh, borderBottomLeftRadius: 4 },
  msgText: { fontSize: 14, color: colors.onSurface, lineHeight: 19 },
  msgTime: { fontSize: 10, color: colors.onSurfaceVariant, fontWeight: '500', marginTop: 3, alignSelf: 'flex-end' },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 10, backgroundColor: colors.surfaceContainer },
  inputWrap: { flex: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: 18, borderRadius: shape.full, backgroundColor: colors.surfaceContainerHigh },
  input: { fontSize: 15, color: colors.onSurface },
  sendBtn: { width: 48, height: 48, borderRadius: shape.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
