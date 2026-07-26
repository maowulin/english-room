import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AuthScreenProps = {
  mode: "login" | "register";
  onLogin: (nickname: string) => void;
  onToggle: () => void;
  busy?: boolean;
};

function BookLogo() {
  return (
    <View style={styles.logo}>
      <View style={styles.book}>
        <View style={styles.bookSpine} />
        <View style={styles.bookPage} />
      </View>
      <Text style={styles.logoText}>English Room</Text>
    </View>
  );
}

export function AuthScreen({ mode, onLogin, onToggle, busy = false }: AuthScreenProps) {
  const [nickname, setNickname] = useState("Mint");
  const register = mode === "register";

  return (
    <SafeAreaView style={styles.safe}>
      <View pointerEvents="none" style={styles.wash}>
        <View style={[styles.mist, styles.mistOne]} />
        <View style={[styles.mist, styles.mistTwo]} />
        <View style={styles.lighthouse}><View style={styles.lantern} /></View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {register ? <Pressable accessibilityLabel="返回登录" onPress={onToggle}><Text style={styles.back}>‹</Text></Pressable> : null}
        <BookLogo />
        <View style={styles.demoBadge} accessibilityLabel="Demo 访客模式">
          <Text style={styles.demoBadgeText}>Demo Guest Mode · 非真实登录</Text>
        </View>
        <Text style={styles.title}>{register ? "Demo 访客说明" : "欢迎回来"}</Text>
        <View style={styles.titleRule}><View /><Text>✦</Text><View /></View>
        <Text style={styles.subtitle}>
          {register
            ? "当前没有邮箱注册/验证码/密码登录；点击进入只会创建 guest session。"
            : "当前为 Demo 访客入口；不会校验邮箱或密码。"}
        </Text>

        <View style={styles.cover}>
          <View style={styles.coverDoor}><Text style={styles.coverSign}>ENGLISH{"\n"}ROOM</Text></View>
          <View style={styles.coverSea} />
          <View style={styles.coverLight} />
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>昵称（Demo）</Text>
            <View style={styles.inputRow}>
              <Text style={styles.fieldGlyph}>♙</Text>
              <TextInput
                accessibilityLabel="昵称"
                autoCapitalize="none"
                editable={!busy}
                onChangeText={setNickname}
                placeholder="输入显示昵称"
                placeholderTextColor="#969A94"
                style={styles.input}
                testID="nickname-input"
                value={nickname}
              />
            </View>
          </View>
          <Text style={styles.hint}>真实邮箱注册/密码登录尚未接入；本屏只调用 POST /v1/guest-sessions。</Text>
          <Pressable
            accessibilityLabel="以访客进入"
            disabled={busy}
            onPress={() => { if (!busy) onLogin(nickname.trim() || "Mint"); }}
            style={[styles.primary, busy && styles.primaryDisabled]}
            testID="login-button"
          >
            <Text style={styles.primaryText}>{busy ? "进入中…" : "以访客进入（Demo）"}</Text>
          </Pressable>
        </View>
        <Pressable accessibilityLabel={register ? "前往登录" : "前往注册"} onPress={onToggle}>
          <Text style={styles.bottomText}>
            {register ? "返回 Demo 入口" : "了解 Demo 模式说明"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: "#FCFAF4", flex: 1 },
  content: { padding: 20, paddingBottom: 18 },
  wash: { bottom: 0, left: 0, overflow: "hidden", position: "absolute", right: 0, top: 0 },
  mist: { backgroundColor: "#DFE8E0", borderRadius: 180, opacity: 0.54, position: "absolute", transform: [{ rotate: "-18deg" }] },
  mistOne: { height: 170, right: -70, top: 128, width: 390 },
  mistTwo: { height: 90, right: -35, top: 196, width: 300 },
  lighthouse: { backgroundColor: "#587873", height: 92, opacity: 0.32, position: "absolute", right: 54, top: 104, width: 13 },
  lantern: { backgroundColor: "#31524C", borderRadius: 4, height: 16, left: -4, position: "absolute", top: -10, width: 21 },
  back: { color: "#163F35", fontSize: 42, lineHeight: 42, marginBottom: 12 },
  logo: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 12 },
  book: { borderColor: "#144B3B", borderWidth: 2, height: 36, position: "relative", width: 34 },
  bookSpine: { backgroundColor: "#144B3B", height: 36, left: 14, position: "absolute", width: 2 },
  bookPage: { borderColor: "#144B3B", borderLeftWidth: 1, borderTopWidth: 1, height: 23, left: 17, position: "absolute", top: 6, transform: [{ skewY: "-13deg" }], width: 11 },
  logoText: { color: "#174638", fontFamily: "serif", fontSize: 26, fontWeight: "700" },
  demoBadge: { alignSelf: "flex-start", backgroundColor: "#E8F2EA", borderColor: "#1C593F", borderRadius: 8, borderWidth: 1, marginTop: 14, paddingHorizontal: 10, paddingVertical: 6 },
  demoBadgeText: { color: "#1C593F", fontSize: 12, fontWeight: "800" },
  title: { color: "#183F33", fontFamily: "serif", fontSize: 36, fontWeight: "700", marginTop: 16 },
  titleRule: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 8, width: 100 },
  subtitle: { color: "#68766E", fontSize: 14, lineHeight: 20, marginTop: 7 },
  cover: { backgroundColor: "#173E38", borderRadius: 18, height: 188, marginTop: 14, overflow: "hidden" },
  coverDoor: { backgroundColor: "#202D2B", borderColor: "#596258", borderWidth: 4, bottom: 0, height: 190, left: 40, position: "absolute", width: 105 },
  coverSign: { color: "#D7C184", fontSize: 9, left: 25, lineHeight: 13, position: "absolute", textAlign: "center", top: 87 },
  coverSea: { backgroundColor: "#385853", bottom: -36, height: 130, opacity: 0.8, position: "absolute", right: -40, transform: [{ rotate: "-12deg" }], width: 260 },
  coverLight: { backgroundColor: "#E6BE65", borderRadius: 20, height: 10, left: 74, position: "absolute", top: 125, width: 10 },
  form: { gap: 9, marginTop: 14 },
  field: { gap: 8 },
  label: { color: "#244A3C", fontSize: 15, fontWeight: "700" },
  inputRow: { alignItems: "center", borderColor: "#D8D4C8", borderRadius: 12, borderWidth: 1, flexDirection: "row", height: 47, paddingHorizontal: 14 },
  fieldGlyph: { color: "#234D40", fontSize: 17, marginRight: 12 },
  input: { color: "#173F34", flex: 1, fontSize: 15, height: "100%" },
  hint: { color: "#6A776F", fontSize: 12, lineHeight: 18 },
  primary: { alignItems: "center", backgroundColor: "#174D39", borderRadius: 10, height: 47, justifyContent: "center", marginTop: 2 },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: "#FFFDF8", fontSize: 17, fontWeight: "800" },
  bottomText: { color: "#4E6259", fontSize: 13, marginTop: 13, textAlign: "center" },
});
