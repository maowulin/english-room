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
  onLogin: () => void;
  onToggle: () => void;
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

function Field({
  label,
  placeholder,
  testID,
  value,
  onChangeText,
  action,
}: {
  label: string;
  placeholder: string;
  testID?: string;
  value?: string;
  onChangeText?: (value: string) => void;
  action?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <Text style={styles.fieldGlyph}>{label === "密码" || label === "确认密码" ? "♙" : label === "验证码" ? "◇" : label === "昵称" ? "♙" : "✉"}</Text>
        <TextInput
          accessibilityLabel={label}
          autoCapitalize="none"
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#969A94"
          secureTextEntry={label.includes("密码")}
          style={styles.input}
          testID={testID}
          value={value}
        />
        {action ? <Pressable accessibilityLabel={action} style={styles.send}><Text style={styles.sendText}>{action}</Text></Pressable> : null}
      </View>
    </View>
  );
}

export function AuthScreen({ mode, onLogin, onToggle }: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(true);
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
        <Text style={styles.title}>{register ? "创建账号" : "欢迎回来"}</Text>
        <View style={styles.titleRule}><View /><Text>✦</Text><View /></View>
        <Text style={styles.subtitle}>{register ? "加入房间，开始你的英语冒险" : "登录后继续你的英语故事"}</Text>

        {register ? (
          <View style={styles.steps}>
            {["账号", "资料", "完成"].map((name, index) => (
              <View key={name} style={styles.step}>
                <View style={[styles.stepDot, index === 0 && styles.stepActive]}><Text style={[styles.stepText, index === 0 && styles.stepTextActive]}>{index + 1}</Text></View>
                <Text style={[styles.stepName, index === 0 && styles.stepNameActive]}>{name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.cover}>
            <View style={styles.coverDoor}><Text style={styles.coverSign}>ENGLISH{"\n"}ROOM</Text></View>
            <View style={styles.coverSea} />
            <View style={styles.coverLight} />
          </View>
        )}

        <View style={styles.form}>
          {register ? <Field label="昵称" placeholder="你的显示名称" /> : null}
          <Field label="邮箱" onChangeText={setEmail} placeholder="name@example.com" testID="email-input" value={email} />
          {register ? <Field action="发送验证码" label="验证码" placeholder="6 位验证码" /> : null}
          <Field label="密码" placeholder={register ? "至少 8 位字符" : "请输入密码"} />
          {register ? <Field label="确认密码" placeholder="再次输入密码" /> : null}
          {!register ? <Pressable accessibilityLabel="找回密码"><Text style={styles.forgot}>忘记密码？</Text></Pressable> : null}
          {register ? <Pressable accessibilityLabel="同意用户协议" onPress={() => setAgreed(!agreed)} style={styles.agree}><View style={[styles.checkbox, agreed && styles.checkboxChecked]}><Text style={styles.check}>✓</Text></View><Text style={styles.agreeText}>我已阅读并同意 <Text style={styles.link}>《用户协议》</Text> 和 <Text style={styles.link}>《隐私政策》</Text></Text></Pressable> : null}
          <Pressable accessibilityLabel={register ? "创建账号" : "登录"} onPress={onLogin} style={styles.primary} testID={register ? "register-button" : "login-button"}><Text style={styles.primaryText}>{register ? "创建账号" : "登录"}</Text></Pressable>
          {!register ? <><View style={styles.or}><View /><Text>或</Text><View /></View><View style={styles.socials}><Pressable accessibilityLabel="使用 Apple 登录" onPress={onLogin} style={styles.social}><Text>●  使用 Apple 登录</Text></Pressable><Pressable accessibilityLabel="使用微信登录" onPress={onLogin} style={styles.social}><Text style={styles.wechat}>●  使用微信登录</Text></Pressable></View></> : null}
        </View>
        <Pressable accessibilityLabel={register ? "前往登录" : "前往注册"} onPress={onToggle}><Text style={styles.bottomText}>{register ? "已有账号？  登录" : "还没有账号？  创建账号"}</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: "#FCFAF4", flex: 1 },
  content: { padding: 28, paddingBottom: 30 },
  wash: { bottom: 0, left: 0, overflow: "hidden", position: "absolute", right: 0, top: 0 },
  mist: { backgroundColor: "#DFE8E0", borderRadius: 180, opacity: 0.54, position: "absolute", transform: [{ rotate: "-18deg" }] },
  mistOne: { height: 170, right: -70, top: 128, width: 390 },
  mistTwo: { height: 90, right: -35, top: 196, width: 300 },
  lighthouse: { backgroundColor: "#587873", height: 92, opacity: 0.32, position: "absolute", right: 54, top: 104, width: 13 },
  lantern: { backgroundColor: "#31524C", borderRadius: 4, height: 16, left: -4, position: "absolute", top: -10, width: 21 },
  back: { color: "#163F35", fontSize: 42, lineHeight: 42, marginBottom: 12 },
  logo: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 30 },
  book: { borderColor: "#144B3B", borderWidth: 2, height: 36, position: "relative", width: 34 },
  bookSpine: { backgroundColor: "#144B3B", height: 36, left: 14, position: "absolute", width: 2 },
  bookPage: { borderColor: "#144B3B", borderLeftWidth: 1, borderTopWidth: 1, height: 23, left: 17, position: "absolute", top: 6, transform: [{ skewY: "-13deg" }], width: 11 },
  logoText: { color: "#174638", fontFamily: "serif", fontSize: 26, fontWeight: "700" },
  title: { color: "#183F33", fontFamily: "serif", fontSize: 40, fontWeight: "700", marginTop: 42 },
  titleRule: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 8, width: 100 },
  subtitle: { color: "#68766E", fontSize: 15, marginTop: 12 },
  cover: { backgroundColor: "#173E38", borderRadius: 18, height: 270, marginTop: 22, overflow: "hidden" },
  coverDoor: { backgroundColor: "#202D2B", borderColor: "#596258", borderWidth: 4, bottom: 0, height: 190, left: 40, position: "absolute", width: 105 },
  coverSign: { color: "#D7C184", fontSize: 9, left: 25, lineHeight: 13, position: "absolute", textAlign: "center", top: 87 },
  coverSea: { backgroundColor: "#385853", bottom: -36, height: 130, opacity: 0.8, position: "absolute", right: -40, transform: [{ rotate: "-12deg" }], width: 260 },
  coverLight: { backgroundColor: "#E6BE65", borderRadius: 20, height: 10, left: 74, position: "absolute", top: 125, width: 10 },
  form: { gap: 16, marginTop: 24 },
  field: { gap: 8 },
  label: { color: "#244A3C", fontSize: 15, fontWeight: "700" },
  inputRow: { alignItems: "center", borderColor: "#D8D4C8", borderRadius: 12, borderWidth: 1, flexDirection: "row", height: 52, paddingHorizontal: 14 },
  fieldGlyph: { color: "#234D40", fontSize: 17, marginRight: 12 },
  input: { color: "#173F34", flex: 1, fontSize: 15, height: "100%" },
  send: { borderColor: "#1E5A47", borderRadius: 7, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  sendText: { color: "#1E5A47", fontSize: 12, fontWeight: "700" },
  forgot: { color: "#295746", fontSize: 13, fontWeight: "700", textAlign: "right" },
  primary: { alignItems: "center", backgroundColor: "#174D39", borderRadius: 10, height: 53, justifyContent: "center", marginTop: 4 },
  primaryText: { color: "#FFFDF8", fontSize: 17, fontWeight: "800" },
  or: { alignItems: "center", flexDirection: "row", gap: 14, marginTop: 4 },
  socials: { flexDirection: "row", gap: 12 },
  social: { alignItems: "center", borderColor: "#9AABA0", borderRadius: 10, borderWidth: 1, flex: 1, paddingVertical: 14 },
  wechat: { color: "#1A7F55" },
  bottomText: { color: "#4E6259", fontSize: 14, marginTop: 30, textAlign: "center" },
  steps: { flexDirection: "row", justifyContent: "space-between", marginTop: 30 },
  step: { alignItems: "center", width: "30%" },
  stepDot: { alignItems: "center", backgroundColor: "#FCFAF4", borderColor: "#BEC6BE", borderRadius: 16, borderWidth: 1, height: 32, justifyContent: "center", width: 32 },
  stepActive: { backgroundColor: "#1C593F", borderColor: "#1C593F" },
  stepText: { color: "#89938B", fontSize: 16 }, stepTextActive: { color: "#FFF", fontWeight: "800" },
  stepName: { color: "#8A938C", fontSize: 13, marginTop: 7 }, stepNameActive: { color: "#1C593F", fontWeight: "800" },
  agree: { alignItems: "center", flexDirection: "row", gap: 9 },
  checkbox: { borderColor: "#1E5944", borderRadius: 4, borderWidth: 1, height: 19, width: 19 },
  checkboxChecked: { alignItems: "center", backgroundColor: "#1E5944", justifyContent: "center" },
  check: { color: "#FFF", fontSize: 13, fontWeight: "900" },
  agreeText: { color: "#53645B", flex: 1, fontSize: 12, lineHeight: 18 }, link: { color: "#1F684E" },
});
