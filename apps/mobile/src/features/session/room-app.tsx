import { useReducer, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { sessionReducer, initialSessionState, type Screen } from "./session-reducer";
import { AuthScreen as VisualAuthScreen } from "./auth-screen";
import {
  LiveScreen,
  LobbyScreen,
  ReportScreen,
  WaitingScreen,
} from "./story-screens";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { FakeRoomClient, HttpRoomClient, type RoomClient } from "@/services/room-client";
import { resolveApiBaseUrl } from "@/services/api-base-url";

const seats = [
  { name: "MINT", status: "已就座", tone: "mint" },
  { name: "AVA", status: "等待中", tone: "warm" },
  { name: "NOAH", status: "等待中", tone: "dark" },
  { name: "LUNA", status: "等待中", tone: "soft" },
];

function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, secondary && styles.secondaryButton, disabled && styles.disabledButton]}
      testID={`${label === "登录" ? "login" : label === "创建新房间" ? "create-room" : label === "准备好了" ? "ready" : label === "开始房间" ? "start-room" : label === "结束房间" ? "end-room" : label.toLowerCase()}-button`}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
    </Pressable>
  );
}

function Brand() {
  return (
    <View style={styles.brand}>
      <View style={styles.brandMark}><Text style={styles.brandMarkText}>ER</Text></View>
      <Text style={styles.brandText}>ENGLISH ROOM</Text>
    </View>
  );
}

export function LegacyAuthScreen({ mode, onLogin, onToggle }: { mode: "login" | "register"; onLogin: () => void; onToggle: () => void }) {
  const [email, setEmail] = useState("");
  const register = mode === "register";
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.authContent}>
        <Brand />
        <View style={styles.authHero}>
          <Text style={styles.eyebrow}>SPEAK · CONNECT · GROW</Text>
          <Text style={styles.display}>{register ? "从今晚开始，开口说英语。" : "和真实的人，练真实的英语。"}</Text>
          <Text style={styles.muted}>{register ? "建立你的英语房间身份" : "每一次开口，都是向前一步。"}</Text>
        </View>
        <View style={styles.authCard}>
          <Text style={styles.cardTitle}>{register ? "创建账号" : "欢迎回来"}</Text>
          {register && <Field label="昵称" placeholder="你希望大家怎么称呼你？" />}
          <Field label="邮箱" placeholder="name@example.com" value={email} onChangeText={setEmail} testID="email-input" />
          {register && <Field label="验证码" placeholder="输入邮箱验证码" />}
          <Field label="密码" placeholder="至少 8 位字符" secureTextEntry />
          {register && <Text style={styles.terms}>注册即代表你同意《用户协议》和《隐私政策》</Text>}
          <Button label={register ? "创建并开始" : "登录"} onPress={onLogin} />
          {!register && <Text style={styles.forgot}>忘记密码？</Text>}
          <View style={styles.divider}><View style={styles.line} /><Text style={styles.dividerText}>或</Text><View style={styles.line} /></View>
          <View style={styles.socialRow}><Button label=" Apple" onPress={onLogin} secondary /><Button label="微信" onPress={onLogin} secondary /></View>
        </View>
        <Pressable accessibilityLabel={register ? "前往登录" : "前往注册"} onPress={onToggle}>
          <Text style={styles.switchText}>{register ? "已有账号？ 登录" : "还没有账号？ 立即注册"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: { label: string; placeholder: string; value?: string; onChangeText?: (value: string) => void; secureTextEntry?: boolean; testID?: string }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{props.label}</Text><TextInput accessibilityLabel={props.label} autoCapitalize="none" onChangeText={props.onChangeText} placeholder={props.placeholder} placeholderTextColor="#91A29F" secureTextEntry={props.secureTextEntry} style={styles.input} testID={props.testID} value={props.value} /></View>;
}

export function LegacyLobby({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  const [code, setCode] = useState("");
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}><Brand /><Text style={styles.eyebrow}>TONIGHT’S ENGLISH SESSION</Text><Text style={styles.display}>今晚想练哪一句？</Text><Text style={styles.muted}>选择一张语言卡，和伙伴进入一场 20 分钟的真实对话。</Text>
    <View style={styles.topicCard}><Text style={styles.topicBadge}>推荐主题</Text><Text style={styles.topicTitle}>午夜咖啡馆</Text><Text style={styles.topicBody}>用英语聊聊你的城市、旅行和此刻的心情。</Text><View style={styles.topicFooter}><Text style={styles.accentText}>20 MIN · 2–4 人</Text><Text style={styles.topicNumber}>01</Text></View></View>
    <Button label="创建新房间" onPress={onCreate} />
    <View style={styles.joinCard}><Text style={styles.cardTitle}>加入朋友的房间</Text><TextInput accessibilityLabel="房间码" autoCapitalize="characters" onChangeText={setCode} placeholder="输入 6 位房间码" placeholderTextColor="#91A29F" style={styles.input} value={code} /><Button label="加入房间" onPress={onJoin} secondary /></View>
  </ScrollView></SafeAreaView>;
}

export function LegacyWaiting({ ready, onReady, onStart, onLeave }: { ready: boolean; onReady: () => void; onStart: () => void; onLeave: () => void }) {
  const avatarStyles = [styles.avatar0, styles.avatar1, styles.avatar2, styles.avatar3];
  return <SafeAreaView style={styles.darkSafe}><ScrollView contentContainerStyle={styles.darkPage}><View style={styles.topbar}><Text style={styles.darkBrand}>ENGLISH ROOM</Text><Pressable accessibilityLabel="离开房间" onPress={onLeave}><Text style={styles.leave}>离开</Text></Pressable></View><Text style={styles.roomCode}>ROOM · MINT 02</Text><Text style={styles.darkDisplay}>等待同伴入座</Text><Text style={styles.darkMuted}>每个人准备好后，就可以开始今天的对话。</Text>
    <View style={styles.seatGrid}>{seats.map((seat, index) => <View key={seat.name} style={[styles.seat, index === 0 && styles.occupiedSeat]}><View style={[styles.avatar, avatarStyles[index]]}><Text style={styles.avatarText}>{seat.name.slice(0, 1)}</Text></View><Text style={styles.seatName}>{seat.name}</Text><Text style={styles.seatStatus}>{index === 0 && ready ? "已准备" : seat.status}</Text></View>)}</View>
    <View style={styles.micCheck}><View style={styles.pulseDot} /><View><Text style={styles.micTitle}>麦克风检查正常</Text><Text style={styles.micBody}>你的声音将只在房间内被听见</Text></View></View>
    <Button label={ready ? "已准备" : "准备好了"} onPress={onReady} secondary={ready} /><Button label="开始房间" disabled={!ready} onPress={onStart} />
  </ScrollView></SafeAreaView>;
}

export function LegacyLive({ onEnd }: { onEnd: () => void }) {
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  return <SafeAreaView style={styles.darkSafe}><View style={styles.livePage}><View style={styles.topbar}><Text style={styles.darkBrand}>ENGLISH ROOM</Text><View style={styles.network}><View style={styles.networkDot} /><Text style={styles.networkText}>网络良好</Text></View></View><Text style={styles.roomCode}>午夜咖啡馆 · 08:42</Text><Text style={styles.darkDisplay}>正在练习</Text><Text style={styles.darkMuted}>轮到 Mint 分享一个让你微笑的瞬间</Text>
    <View style={styles.liveStage}><View style={styles.speakerRing}><View style={styles.speakerAvatar}><Text style={styles.speakerInitial}>M</Text></View></View><Text style={styles.liveName}>MINT</Text><Text style={styles.speaking}>正在发言 · 00:42</Text><View style={styles.wave}>{[1,2,3,4,5,6,7].map((bar) => <View key={bar} style={[styles.waveBar, { height: 12 + (bar % 3) * 12 }]} />)}</View></View>
    <View style={styles.controlBar}><Control label={muted ? "打开麦克风" : "静音"} icon={muted ? "⌁" : "◉"} onPress={() => setMuted(!muted)} /><Control label={speaker ? "扬声器开" : "扬声器关"} icon="◌" onPress={() => setSpeaker(!speaker)} /><Control label="结束房间" icon="×" danger onPress={onEnd} /></View>
  </View></SafeAreaView>;
}

function Control({ label, icon, danger, onPress }: { label: string; icon: string; danger?: boolean; onPress: () => void }) { return <Pressable accessibilityLabel={label} onPress={onPress} style={styles.control} testID={label === "结束房间" ? "end-room-button" : undefined}><View style={[styles.controlIcon, danger && styles.dangerIcon]}><Text style={styles.controlIconText}>{icon}</Text></View><Text style={styles.controlLabel}>{label}</Text></Pressable>; }

export function LegacyReport({ onRetry, onDone }: { onRetry: () => void; onDone: () => void }) {
  const [retried, setRetried] = useState(false);
  const rows = [["MINT", "表达流畅", "88", "done"], ["AVA", "正在分析语音", "处理中", "processing"], ["NOAH", "等待音频上传", "等待中", "waiting"], ["LUNA", retried ? "已重新提交" : "评分暂时失败", retried ? "处理中" : "重试", retried ? "processing" : "failed"]] as const;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}><Brand /><Text style={styles.eyebrow}>SESSION COMPLETE · MINT 02</Text><Text style={styles.display}>本局口语报告</Text><Text style={styles.muted}>每一次开口，都让表达更自然一点。</Text><View style={styles.scoreHero}><Text style={styles.scoreLabel}>你的综合评分</Text><Text style={styles.score}>88</Text><Text style={styles.scoreCaption}>优秀 · 自信表达者</Text><View style={styles.scorePills}><Text style={styles.scorePill}>流利度 90</Text><Text style={styles.scorePill}>发音 86</Text><Text style={styles.scorePill}>词汇 88</Text></View></View><Text style={styles.sectionTitle}>房间成员报告</Text>{rows.map(([name, body, status, tone]) => <View key={name} style={styles.reportRow}><View style={styles.reportAvatar}><Text style={styles.reportAvatarText}>{name[0]}</Text></View><View style={styles.reportInfo}><Text style={styles.reportName}>{name}</Text><Text style={styles.reportBody}>{body}</Text></View>{tone === "failed" ? <Pressable accessibilityLabel="重试评分" onPress={() => { setRetried(true); onRetry(); }}><Text style={styles.retry}>重试</Text></Pressable> : <Text style={[styles.reportStatus, tone === "done" && styles.successStatus]}>{status}</Text>}</View>)}<Button label="回到大厅" onPress={onDone} /></ScrollView></SafeAreaView>;
}

export function RoomApp() {
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);
  const client = useRef<RoomClient>(new HttpRoomClient({ baseUrl: resolveApiBaseUrl() })).current;
  const [fallback, setFallback] = useState(false);
  const auth = () => { void client.createGuestSession({ nickname: "Mint" }).then((player) => dispatch({ type: "authenticated", player: { id: player.playerId, nickname: player.nickname } })).catch(() => { setFallback(true); const fake = new FakeRoomClient(); void fake.createGuestSession({ nickname: "Mint" }).then((player) => dispatch({ type: "authenticated", player: { id: player.playerId, nickname: player.nickname } })); }); };
  const join = () => { void client.createRoom({ title: "雾港疑云" }).then((room) => dispatch({ type: "roomJoined", room })).catch(() => { setFallback(true); const fake = new FakeRoomClient(); void fake.createRoom({ title: "雾港疑云" }).then((room) => dispatch({ type: "roomJoined", room })); }); };
  const roomId = state.room?.id;
  const ready = () => { if (roomId) void client.setReady(roomId, !state.ready).catch(() => undefined).finally(() => dispatch({ type: "readyChanged", ready: !state.ready })); };
  const start = () => { if (roomId) void client.startRoom(roomId).catch(() => undefined).finally(() => dispatch({ type: "roomStarted" })); };
  const end = () => { if (roomId) void client.endRoom(roomId).catch(() => undefined).finally(() => dispatch({ type: "roomEnded" })); };
  const pages: Record<Screen, React.ReactNode> = {
    login: <VisualAuthScreen mode="login" onLogin={auth} onToggle={() => dispatch({ type: "showRegister" })} />,
    register: <VisualAuthScreen mode="register" onLogin={auth} onToggle={() => dispatch({ type: "showLogin" })} />,
    lobby: <LobbyScreen onCreate={join} onJoin={join} />,
    waiting: <WaitingScreen ready={state.ready} onLeave={() => dispatch({ type: "leaveRoom" })} onReady={ready} onStart={start} />,
    live: <LiveScreen onEnd={end} />,
    report: <ReportScreen onDone={() => dispatch({ type: "leaveRoom" })} onRetry={() => undefined} />,
  };
  return <>{fallback ? <Text accessibilityLabel="开发 fallback">开发模式：已切换 Fake 服务</Text> : null}{pages[state.screen]}</>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, darkSafe: { flex: 1, backgroundColor: colors.ink },
  page: { padding: spacing.page, paddingBottom: spacing.xxl, gap: spacing.md }, darkPage: { padding: spacing.page, paddingBottom: spacing.xxl, gap: spacing.md },
  authContent: { flexGrow: 1, padding: spacing.page, paddingTop: spacing.xl, gap: spacing.lg }, brand: { alignItems: "center", flexDirection: "row", gap: 8 }, brandMark: { alignItems: "center", backgroundColor: colors.ink, borderRadius: 9, height: 30, justifyContent: "center", width: 30 }, brandMarkText: { color: colors.accentLight, fontSize: 10, fontWeight: "900" }, brandText: { color: colors.ink, fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  authHero: { marginTop: spacing.lg, gap: spacing.md }, eyebrow: { color: colors.accentDark, fontSize: typography.caption, fontWeight: "800", letterSpacing: 1.2, marginTop: spacing.lg }, display: { color: colors.ink, fontSize: typography.display, fontWeight: "800", letterSpacing: -1.2, lineHeight: 45 }, muted: { color: colors.muted, fontSize: typography.small, lineHeight: typography.smallLineHeight },
  authCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, gap: spacing.md, padding: spacing.lg }, cardTitle: { color: colors.ink, fontSize: typography.heading, fontWeight: "800" }, field: { gap: 6 }, fieldLabel: { color: colors.ink, fontSize: typography.caption, fontWeight: "700" }, input: { backgroundColor: colors.neutralSoft, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 15, minHeight: 48, paddingHorizontal: spacing.md }, button: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 14, justifyContent: "center", minHeight: 50, paddingHorizontal: spacing.md }, buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" }, secondaryButton: { backgroundColor: colors.accentSoft, borderColor: colors.accent, borderWidth: 1 }, secondaryButtonText: { color: colors.accentDark }, disabledButton: { backgroundColor: "#647C77" }, forgot: { color: colors.accentDark, fontSize: typography.caption, fontWeight: "700", textAlign: "right" }, terms: { color: colors.muted, fontSize: 11, lineHeight: 17 }, divider: { alignItems: "center", flexDirection: "row", gap: 10 }, line: { backgroundColor: colors.border, flex: 1, height: 1 }, dividerText: { color: colors.muted, fontSize: 12 }, socialRow: { flexDirection: "row", gap: spacing.sm }, switchText: { color: colors.accentDark, fontSize: 14, fontWeight: "700", textAlign: "center" },
  topicCard: { backgroundColor: colors.ink, borderRadius: radii.lg, gap: spacing.md, marginTop: spacing.md, padding: spacing.lg }, topicBadge: { color: colors.accentLight, fontSize: 12, fontWeight: "800" }, topicTitle: { color: colors.surface, fontSize: 29, fontWeight: "800" }, topicBody: { color: colors.onDarkMuted, fontSize: 14, lineHeight: 21 }, topicFooter: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between" }, accentText: { color: colors.accentLight, fontSize: 11, fontWeight: "800" }, topicNumber: { color: "#496460", fontSize: 42, fontWeight: "900" }, joinCard: { backgroundColor: colors.surface, borderRadius: radii.md, gap: spacing.md, marginTop: spacing.md, padding: spacing.lg },
  topbar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, darkBrand: { color: colors.surface, fontSize: 12, fontWeight: "800", letterSpacing: 1.3 }, leave: { color: colors.accentLight, fontSize: 13, fontWeight: "700" }, roomCode: { color: colors.accentLight, fontSize: 12, fontWeight: "800", letterSpacing: 1.1, marginTop: spacing.lg }, darkDisplay: { color: colors.surface, fontSize: 36, fontWeight: "800", letterSpacing: -1, lineHeight: 44 }, darkMuted: { color: colors.onDarkMuted, fontSize: 14, lineHeight: 21 },
  seatGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg }, seat: { alignItems: "center", backgroundColor: "#193A37", borderColor: "#2C514D", borderRadius: radii.md, borderStyle: "dashed", borderWidth: 1, gap: 5, paddingVertical: spacing.lg, width: "47%" }, occupiedSeat: { backgroundColor: "#194D44", borderColor: colors.accent, borderStyle: "solid" }, avatar: { alignItems: "center", backgroundColor: "#51736E", borderRadius: 25, height: 50, justifyContent: "center", width: 50 }, avatar0: { backgroundColor: colors.accent }, avatar1: { backgroundColor: "#C79559" }, avatar2: { backgroundColor: "#7294AF" }, avatar3: { backgroundColor: "#B17A91" }, avatarText: { color: colors.surface, fontSize: 19, fontWeight: "900" }, seatName: { color: colors.surface, fontSize: 13, fontWeight: "800" }, seatStatus: { color: colors.onDarkMuted, fontSize: 11 }, micCheck: { alignItems: "center", backgroundColor: "#183F39", borderRadius: radii.md, flexDirection: "row", gap: spacing.md, marginVertical: spacing.md, padding: spacing.md }, pulseDot: { backgroundColor: colors.accent, borderRadius: 6, height: 12, width: 12 }, micTitle: { color: colors.surface, fontSize: 14, fontWeight: "700" }, micBody: { color: colors.onDarkMuted, fontSize: 11, marginTop: 3 },
  livePage: { flex: 1, padding: spacing.page }, network: { alignItems: "center", flexDirection: "row", gap: 5 }, networkDot: { backgroundColor: colors.accentLight, borderRadius: 4, height: 8, width: 8 }, networkText: { color: colors.accentLight, fontSize: 11, fontWeight: "700" }, liveStage: { alignItems: "center", flex: 1, justifyContent: "center" }, speakerRing: { alignItems: "center", backgroundColor: "#1D554B", borderColor: "#4A9382", borderRadius: 110, borderWidth: 1, height: 220, justifyContent: "center", width: 220 }, speakerAvatar: { alignItems: "center", backgroundColor: colors.accent, borderRadius: 76, height: 152, justifyContent: "center", width: 152 }, speakerInitial: { color: colors.surface, fontSize: 58, fontWeight: "900" }, liveName: { color: colors.surface, fontSize: 18, fontWeight: "800", letterSpacing: 2, marginTop: spacing.lg }, speaking: { color: colors.accentLight, fontSize: 13, fontWeight: "700", marginTop: 6 }, wave: { alignItems: "center", flexDirection: "row", gap: 5, height: 48, marginTop: spacing.md }, waveBar: { backgroundColor: colors.accent, borderRadius: 4, width: 5 }, controlBar: { backgroundColor: "#173532", borderRadius: radii.lg, flexDirection: "row", justifyContent: "space-around", paddingVertical: spacing.md }, control: { alignItems: "center", gap: 6, maxWidth: 88 }, controlIcon: { alignItems: "center", backgroundColor: "#2B5851", borderRadius: 24, height: 48, justifyContent: "center", width: 48 }, dangerIcon: { backgroundColor: "#9B4C44" }, controlIconText: { color: colors.surface, fontSize: 21, fontWeight: "800" }, controlLabel: { color: colors.onDarkMuted, fontSize: 10, textAlign: "center" },
  scoreHero: { alignItems: "center", backgroundColor: colors.ink, borderRadius: radii.lg, gap: spacing.sm, marginTop: spacing.md, padding: spacing.xl }, scoreLabel: { color: colors.accentLight, fontSize: 13, fontWeight: "700" }, score: { color: colors.surface, fontSize: 74, fontWeight: "900", letterSpacing: -3 }, scoreCaption: { color: colors.onDarkMuted, fontSize: 14 }, scorePills: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: spacing.sm }, scorePill: { color: colors.accentLight, fontSize: 11, fontWeight: "700" }, sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", marginTop: spacing.md }, reportRow: { alignItems: "center", backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md }, reportAvatar: { alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: 19, height: 38, justifyContent: "center", width: 38 }, reportAvatarText: { color: colors.accentDark, fontSize: 14, fontWeight: "800" }, reportInfo: { flex: 1 }, reportName: { color: colors.ink, fontSize: 14, fontWeight: "800" }, reportBody: { color: colors.muted, fontSize: 12, marginTop: 3 }, reportStatus: { color: colors.warning, fontSize: 12, fontWeight: "800" }, successStatus: { color: colors.accentDark }, retry: { color: colors.accentDark, fontSize: 13, fontWeight: "800" },
});
