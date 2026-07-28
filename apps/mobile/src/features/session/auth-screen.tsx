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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon, type AppIconName } from "@/components/app-icon";

type AuthScreenProps = {
  mode: "login" | "register";
  onLogin: (nickname: string) => void;
  onToggle: () => void;
  busy?: boolean;
};

const LOGIN_ART = require("../../../assets/design/05-login.png") as number;
const AUTH_CONTENT_BOTTOM_PADDING = 10;
const GUEST_NAMES = ["Avery", "Blair", "Casey", "Dylan", "Ellis", "Harper", "Jamie", "Jordan", "Morgan", "Riley", "Quinn"] as const;

export function createRandomGuestName(random = Math.random): string {
  const index = Math.min(GUEST_NAMES.length - 1, Math.floor(random() * GUEST_NAMES.length));
  return GUEST_NAMES[index] ?? GUEST_NAMES[0];
}

function BookLogo({ register }: { register: boolean }) {
  return (
    <View style={[styles.logo, register && styles.registerLogo]} testID="auth-brand">
      <AppIcon color="#174B3B" name="book-open" size={31} />
      <Text style={styles.logoWordmark} testID="auth-brand-wordmark">English Room</Text>
    </View>
  );
}

function MistyCover() {
  const { width } = useWindowDimensions();
  const sourceWidth = Math.min(width, 430);
  const scale = sourceWidth / 853;
  const cropTop = 485 * scale;
  const cropHeight = 485 * scale;
  const cropLeft = 52 * scale;
  return (
    <View style={[styles.cover, { height: cropHeight - 2 }]} testID="auth-cover">
      <Image
        accessibilityLabel="English Room story cover"
        resizeMode="stretch"
        source={LOGIN_ART}
        style={{ height: 1844 * scale, left: -cropLeft, position: "absolute", top: -cropTop, width: sourceWidth }}
      />
      <View pointerEvents="none" style={styles.coverShade} />
    </View>
  );
}

function RegisterSteps() {
  const steps = ["Account", "Profile", "Done"] as const;

  return (
    <View accessibilityLabel="Registration progress" style={styles.registerSteps} testID="register-steps">
      <View pointerEvents="none" style={styles.stepLine} />
      <View style={styles.stepRow}>
        {steps.map((step, index) => (
          <View key={step} style={styles.step}>
            <View style={[styles.stepBadge, index === 0 && styles.stepBadgeActive]}>
              <Text style={[styles.stepNumber, index === 0 && styles.stepNumberActive]}>{index + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, index === 0 && styles.stepLabelActive]}>{step}</Text>
          </View>
        ))}
      </View>
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
      <View style={styles.inputRow} testID={testID ? `${testID}-row` : undefined}>
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
  const [nickname, setNickname] = useState(createRandomGuestName);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [accountNotice, setAccountNotice] = useState<string>();
  const insets = useSafeAreaInsets();
  const displayName = nickname.trim() || email.split("@")[0] || "Mint";
  const toggleMode = () => {
    setAccountNotice(undefined);
    onToggle();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View pointerEvents="none" style={styles.wash}>
        <View style={[styles.mist, styles.mistOne]} />
        <View style={[styles.mist, styles.mistTwo]} />
        <View style={styles.lighthouse}><View style={styles.lantern} /></View>
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, register && styles.registerContent, { flexGrow: 1, paddingBottom: AUTH_CONTENT_BOTTOM_PADDING + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        testID="auth-content"
      >
        {register ? <Pressable accessibilityLabel="Back to login" onPress={toggleMode} style={styles.backButton}><AppIcon color="#163F35" name="arrow-left" size={28} /></Pressable> : null}
        <BookLogo register={register} />
        <Text style={[styles.title, register && styles.registerTitle]} testID="auth-title">{register ? "Create account" : "Welcome back"}</Text>
        <View style={styles.titleRule}><View style={styles.ruleLine} /><AppIcon color="#174638" name="sparkles" size={14} /><View style={styles.ruleLine} /></View>
        <Text style={styles.subtitle}>{register ? "Create an account to continue your English story" : "Log in to continue your English story"}</Text>

        {register ? <RegisterSteps /> : <MistyCover />}

        <View style={styles.form}>
          {!register ? <TextInput accessibilityLabel="Name" onChangeText={setNickname} style={styles.srOnlyInput} testID="nickname-input" value={nickname} /> : null}
          {register ? (
            <Field accessibilityLabel="Name" icon="user" label="Name" onChangeText={setNickname} placeholder="What should we call you?" testID="nickname-input" value={nickname} />
          ) : null}
          <Field accessibilityLabel="Email" icon="mail" label="Email" onChangeText={setEmail} placeholder="name@example.com" testID="email-input" value={email} />
          {register ? <Field accessibilityLabel="Verification code" icon="clock" label="Email verification code" onChangeText={setVerificationCode} placeholder="Enter your email code" value={verificationCode} /> : null}
          <View style={[styles.field, !register && styles.loginPasswordField]}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow} testID="password-input-row">
              <View style={styles.fieldIcon}><AppIcon color="#234D40" name="lock" size={19} /></View>
              <TextInput
                accessibilityLabel="Password"
                autoCapitalize="none"
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#9A9C96"
                secureTextEntry={!showPassword}
                style={styles.input}
                testID="password-input"
                value={password}
              />
              <Pressable accessibilityLabel={showPassword ? "Hide password" : "Show password"} onPress={() => setShowPassword((current) => !current)} style={styles.eyeButton}>
                <AppIcon color="#3B4540" name={showPassword ? "eye-off" : "eye"} size={22} />
              </Pressable>
            </View>
          </View>
          {!register ? <Pressable accessibilityLabel="Forgot password" style={styles.forgot}><Text style={styles.forgotText}>Forgot password?</Text></Pressable> : null}
          <Pressable
            accessibilityLabel={register ? "Create account" : "Log in"}
            disabled={busy}
            onPress={() => {
              if (!busy) {
                setAccountNotice(
                  register
                    ? "Account registration is not available yet."
                    : "Account sign-in is not available yet.",
                );
              }
            }}
            style={[styles.primary, busy && styles.primaryDisabled]}
            testID="account-login-button"
          >
            <Text style={styles.primaryText}>{register ? "Create account" : "Log in"}</Text>
          </Pressable>
          {accountNotice ? <Text accessibilityLabel="Account availability" style={styles.accountNotice}>{accountNotice}</Text> : null}
          {!register ? (
            <Pressable
              accessibilityLabel="Demo guest entry"
              disabled={busy}
              hitSlop={10}
              onPress={() => { if (!busy) onLogin(displayName); }}
              style={[styles.guestButton, busy && styles.primaryDisabled]}
              testID="demo-guest-button"
            >
              <View style={styles.guestButtonContent}><AppIcon color="#1B513D" name="user" size={18} /><Text style={styles.guestButtonText}>{busy ? "Entering…" : "Enter as Demo guest"}</Text></View>
            </Pressable>
          ) : null}
        </View>

        {!register ? <><View style={styles.divider}><View style={styles.line} /><Text style={styles.dividerText}>or</Text><View style={styles.line} /></View><View style={styles.socialRow} testID="auth-social-row"><Pressable accessibilityLabel="Sign in with Apple" style={styles.social}><AppIcon color="#000" name="apple" size={17} /><Text style={styles.socialText}>Sign in with Apple</Text></Pressable><Pressable accessibilityLabel="Sign in with WeChat" style={styles.social}><AppIcon color="#2DAA65" name="message-circle" size={17} /><Text style={styles.socialText}>Sign in with WeChat</Text></Pressable></View></> : null}
        <Pressable accessibilityLabel={register ? "Go to login" : "Go to sign up"} onPress={toggleMode} style={styles.footer} testID="auth-footer">
          <Text style={styles.bottomText}>{register ? "Already have an account? Back to login" : "Don't have an account? Create one"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: "#FCFAF4", flex: 1 },
  scroll: { flex: 1 },
  content: { paddingBottom: 10, paddingHorizontal: 20, paddingTop: 32 },
  registerContent: { paddingTop: 20 },
  wash: { bottom: 0, left: 0, overflow: "hidden", position: "absolute", right: 0, top: 0 },
  mist: { backgroundColor: "#DFE8E0", borderRadius: 180, opacity: 0.54, position: "absolute", transform: [{ rotate: "-18deg" }] },
  mistOne: { height: 170, right: -70, top: 128, width: 390 },
  mistTwo: { height: 90, right: -35, top: 196, width: 300 },
  lighthouse: { backgroundColor: "#587873", height: 92, opacity: 0.32, position: "absolute", right: 54, top: 104, width: 13 },
  lantern: { backgroundColor: "#31524C", borderRadius: 4, height: 16, left: -4, position: "absolute", top: -10, width: 21 },
  backButton: { alignSelf: "flex-start" },
  logo: { alignItems: "center", flexDirection: "row", gap: 9, height: 46, width: 180 },
  logoWordmark: { color: "#174638", fontFamily: "serif", fontSize: 23, fontWeight: "700" },
  registerLogo: { marginTop: 16 },
  srOnlyInput: { height: 1, opacity: 0, position: "absolute", width: 1 },
  title: { color: "#183F33", fontFamily: "serif", fontSize: 36, fontWeight: "700", lineHeight: 42, marginTop: 20 },
  registerTitle: { marginTop: 16 },
  titleRule: { alignItems: "center", flexDirection: "row", gap: 7, height: 14, marginTop: 4, width: 100 },
  ruleLine: { backgroundColor: "#6F8A80", height: 1, width: 28 },
  subtitle: { color: "#68766E", fontSize: 15, lineHeight: 19, marginTop: 3 },
  cover: { backgroundColor: "#173E38", borderRadius: 22, marginTop: 13, overflow: "hidden", width: "100%" },
  coverShade: { backgroundColor: "rgba(17, 51, 44, 0.08)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  registerSteps: { height: 76, marginTop: 14, paddingTop: 4, position: "relative" },
  stepLine: { backgroundColor: "#AEB8B1", height: 1, left: 42, position: "absolute", right: 42, top: 19 },
  stepRow: { flexDirection: "row", justifyContent: "space-between" },
  step: { alignItems: "center", width: 72 },
  stepBadge: { alignItems: "center", backgroundColor: "#FCFAF4", borderColor: "#AEB8B1", borderRadius: 16, borderWidth: 1, height: 32, justifyContent: "center", width: 32 },
  stepBadgeActive: { backgroundColor: "#174D39", borderColor: "#174D39" },
  stepNumber: { color: "#848B86", fontSize: 15, lineHeight: 18 },
  stepNumberActive: { color: "#FFFDF8", fontWeight: "800" },
  stepLabel: { color: "#7B827D", fontSize: 13, lineHeight: 17, marginTop: 6 },
  stepLabelActive: { color: "#174D39", fontWeight: "800" },
  form: { marginTop: 18 },
  field: { gap: 6, marginBottom: 6 },
  loginPasswordField: { marginBottom: 2 },
  label: { color: "#244A3C", fontSize: 15, fontWeight: "700", lineHeight: 18 },
  inputRow: { alignItems: "center", borderColor: "#D8D4C8", borderRadius: 14, borderWidth: 1, flexDirection: "row", height: 50, paddingHorizontal: 15 },
  fieldIcon: { marginRight: 12, width: 20 },
  input: { color: "#173F34", flex: 1, fontSize: 16, height: "100%" },
  eyeButton: { paddingLeft: 8 },
  forgot: { alignSelf: "flex-end", marginBottom: 4 },
  forgotText: { color: "#174638", fontSize: 14, fontWeight: "700", lineHeight: 17 },
  primary: { alignItems: "center", backgroundColor: "#174D39", borderRadius: 14, height: 46, justifyContent: "center", marginTop: 7 },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: "#FFFDF8", fontSize: 18, fontWeight: "800" },
  accountNotice: { color: "#8A5A16", fontSize: 11, lineHeight: 14, marginTop: 4, textAlign: "center" },
  guestButton: { alignItems: "center", alignSelf: "stretch", backgroundColor: "#F2F7F0", borderColor: "#5B806C", borderRadius: 14, borderWidth: 1, height: 48, justifyContent: "center", marginTop: 8, paddingHorizontal: 18 },
  guestButtonContent: { alignItems: "center", flexDirection: "row", gap: 8 },
  guestButtonText: { color: "#1B513D", fontSize: 15, fontWeight: "800" },
  divider: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 0 },
  line: { backgroundColor: "#D8D4C8", flex: 1, height: 1 },
  dividerText: { color: "#7A807A", fontSize: 13, lineHeight: 16 },
  socialRow: { flexDirection: "row", gap: 10, marginTop: 1 },
  social: { alignItems: "center", borderColor: "#94A096", borderRadius: 12, borderWidth: 1, flex: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 40, paddingHorizontal: 6 },
  socialText: { color: "#244A3C", fontSize: 13, fontWeight: "700" },
  footer: { marginTop: 16 },
  bottomText: { color: "#244A3C", fontSize: 14, lineHeight: 18, textAlign: "center" },
});
