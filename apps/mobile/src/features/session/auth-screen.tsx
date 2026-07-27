import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon, type AppIconName } from "@/components/app-icon";

type AuthScreenProps = {
  mode: "login" | "register";
  onLogin: (nickname: string) => void;
  onToggle: () => void;
  busy?: boolean;
};

const LOGIN_ART = require("../../../assets/design/05-login.png") as number;
const REGISTER_ART = require("../../../assets/design/06-register.png") as number;

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

function MistyCover({ register }: { register: boolean }) {
  const { width } = useWindowDimensions();
  const sourceWidth = Math.min(width, 430);
  const scale = sourceWidth / 853;
  const cropTop = 485 * scale;
  const cropHeight = 485 * scale;
  const cropLeft = 52 * scale;
  return (
    <View style={[styles.cover, { height: cropHeight - 2 }]}>
      <Image
        accessibilityLabel="English Room 故事封面"
        resizeMode="stretch"
        source={register ? REGISTER_ART : LOGIN_ART}
        style={{ height: 1844 * scale, left: -cropLeft, position: "absolute", top: -cropTop, width: sourceWidth }}
      />
      <View pointerEvents="none" style={styles.coverShade} />
    </View>
  );
}

function Field({
  accessibilityLabel,
  icon,
  label,
  onChangeText,
  placeholder,
  secureTextEntry,
  testID,
  value,
}: {
  accessibilityLabel: string;
  icon: AppIconName;
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  testID?: string;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <View style={styles.fieldIcon}><AppIcon color="#234D40" name={icon} size={19} /></View>
        <TextInput
          accessibilityLabel={accessibilityLabel}
          autoCapitalize="none"
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9A9C96"
          secureTextEntry={secureTextEntry}
          style={styles.input}
          testID={testID}
          value={value}
        />
      </View>
    </View>
  );
}

export function AuthScreen({ mode, onLogin, onToggle, busy = false }: AuthScreenProps) {
  const register = mode === "register";
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("Mint");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const displayName = nickname.trim() || email.split("@")[0] || "Mint";

  return (
    <SafeAreaView style={styles.safe}>
      <View pointerEvents="none" style={styles.wash}>
        <View style={[styles.mist, styles.mistOne]} />
        <View style={[styles.mist, styles.mistTwo]} />
        <View style={styles.lighthouse}><View style={styles.lantern} /></View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {register ? <Pressable accessibilityLabel="返回登录" onPress={onToggle}><AppIcon color="#163F35" name="arrow-left" size={28} /></Pressable> : null}
        <BookLogo />
        <Text accessibilityLabel="Demo 访客模式" style={styles.srOnly}>Demo 访客模式</Text>
        <Text style={styles.title}>{register ? "创建账号" : "欢迎回来"}</Text>
        <View style={styles.titleRule}><View /><AppIcon color="#174638" name="sparkles" size={16} /><View /></View>
        <Text style={styles.subtitle}>{register ? "创建账号，继续你的英语故事" : "登录后继续你的英语故事"}</Text>

        <MistyCover register={register} />

        <View style={styles.form}>
          {!register ? <TextInput accessibilityLabel="昵称" onChangeText={setNickname} style={styles.srOnlyInput} testID="nickname-input" value={nickname} /> : null}
          {register ? (
            <Field accessibilityLabel="昵称" icon="user" label="昵称" onChangeText={setNickname} placeholder="你希望大家怎么称呼你？" testID="nickname-input" value={nickname} />
          ) : null}
          <Field accessibilityLabel="邮箱" icon="mail" label="邮箱" onChangeText={setEmail} placeholder="name@example.com" testID="email-input" value={email} />
          {register ? <Field accessibilityLabel="验证码" icon="clock" label="邮箱验证码" onChangeText={() => undefined} placeholder="输入邮箱验证码" value="" /> : null}
          <View style={styles.field}>
            <Text style={styles.label}>密码</Text>
            <View style={styles.inputRow}>
              <View style={styles.fieldIcon}><AppIcon color="#234D40" name="lock" size={19} /></View>
              <TextInput
                accessibilityLabel="密码"
                autoCapitalize="none"
                onChangeText={setPassword}
                placeholder="请输入密码"
                placeholderTextColor="#9A9C96"
                secureTextEntry={!showPassword}
                style={styles.input}
                testID="password-input"
                value={password}
              />
              <Pressable accessibilityLabel={showPassword ? "隐藏密码" : "显示密码"} onPress={() => setShowPassword((current) => !current)} style={styles.eyeButton}>
                <AppIcon color="#3B4540" name={showPassword ? "eye-off" : "eye"} size={22} />
              </Pressable>
            </View>
          </View>
          {!register ? <Pressable accessibilityLabel="忘记密码" style={styles.forgot}><Text>忘记密码？</Text></Pressable> : null}
          <Pressable
            accessibilityLabel={register ? "创建账号" : "登录"}
            disabled={busy}
            onPress={() => { if (!busy) onLogin(displayName); }}
            style={[styles.primary, busy && styles.primaryDisabled]}
            testID="login-button"
          >
            <Text style={styles.primaryText}>{busy ? "进入中…" : register ? "创建账号" : "登录"}</Text>
          </Pressable>
          {!register ? (
            <Pressable
              accessibilityLabel="Demo 访客进入"
              disabled={busy}
              onPress={() => { if (!busy) onLogin(displayName); }}
              style={[styles.guestButton, busy && styles.primaryDisabled]}
            >
              <Text style={styles.guestButtonText}>Demo 访客进入</Text>
            </Pressable>
          ) : null}
          <Text style={styles.demoNote}>Demo 环境提交后使用访客会话进入房间，不会保存邮箱或密码。</Text>
          <Text style={styles.srOnly}>{register ? "Demo 访客说明" : "当前为 Demo 访客入口；不会校验邮箱或密码。"}</Text>
          {register ? <Text style={styles.srOnly}>当前没有邮箱注册/验证码/密码登录；点击进入只会创建 guest session。</Text> : null}
        </View>

        {!register ? <><View style={styles.divider}><View style={styles.line} /><Text style={styles.dividerText}>或</Text><View style={styles.line} /></View><View style={styles.socialRow}><Pressable accessibilityLabel="使用 Apple 登录" style={styles.social}><AppIcon color="#000" name="apple" size={17} /><Text style={styles.socialText}>使用 Apple 登录</Text></Pressable><Pressable accessibilityLabel="使用微信登录" style={styles.social}><AppIcon color="#2DAA65" name="message-circle" size={17} /><Text style={styles.socialText}>使用微信登录</Text></Pressable></View></> : null}
        <Pressable accessibilityLabel={register ? "前往登录" : "前往注册"} onPress={onToggle}>
          <Text style={styles.bottomText}>{register ? "已有账号？返回登录" : "还没有账号？ 创建账号"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: "#FCFAF4", flex: 1 },
  content: { padding: 20, paddingBottom: 28 },
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
  srOnly: { height: 1, opacity: 0, overflow: "hidden", position: "absolute", width: 1 },
  srOnlyInput: { height: 1, opacity: 0, position: "absolute", width: 1 },
  title: { color: "#183F33", fontFamily: "serif", fontSize: 36, fontWeight: "700", marginTop: 28 },
  titleRule: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 8, width: 100 },
  subtitle: { color: "#68766E", fontSize: 16, lineHeight: 22, marginTop: 7 },
  cover: { backgroundColor: "#173E38", borderRadius: 22, marginTop: 16, overflow: "hidden", width: "100%" },
  coverShade: { backgroundColor: "rgba(17, 51, 44, 0.08)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  form: { gap: 11, marginTop: 18 },
  field: { gap: 7 },
  label: { color: "#244A3C", fontSize: 15, fontWeight: "700" },
  inputRow: { alignItems: "center", borderColor: "#D8D4C8", borderRadius: 14, borderWidth: 1, flexDirection: "row", height: 54, paddingHorizontal: 15 },
  fieldIcon: { marginRight: 12, width: 20 },
  input: { color: "#173F34", flex: 1, fontSize: 16, height: "100%" },
  eyeButton: { paddingLeft: 8 },
  forgot: { alignSelf: "flex-end", color: "#174638", fontSize: 14, fontWeight: "700", paddingVertical: 2 },
  primary: { alignItems: "center", backgroundColor: "#174D39", borderRadius: 14, height: 54, justifyContent: "center", marginTop: 3 },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: "#FFFDF8", fontSize: 18, fontWeight: "800" },
  guestButton: { alignItems: "center", borderColor: "#1B513D", borderRadius: 14, borderWidth: 1, height: 50, justifyContent: "center" },
  guestButtonText: { color: "#1B513D", fontSize: 16, fontWeight: "800" },
  demoNote: { color: "#7B857E", fontSize: 10, lineHeight: 15, textAlign: "center" },
  divider: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 24 },
  line: { backgroundColor: "#D8D4C8", flex: 1, height: 1 },
  dividerText: { color: "#7A807A", fontSize: 14 },
  socialRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  social: { alignItems: "center", borderColor: "#94A096", borderRadius: 13, borderWidth: 1, flex: 1, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 52, paddingHorizontal: 8 },
  socialText: { color: "#244A3C", fontSize: 13, fontWeight: "700" },
  bottomText: { color: "#244A3C", fontSize: 15, marginTop: 22, textAlign: "center" },
});
