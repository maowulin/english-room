import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon, type AppIconName } from "@/components/app-icon";
import type { ReportItem } from "@/services/room-client";
import type { RoomMemberView } from "./session-reducer";

export type MediaUiState = {
  mode: "demo" | "real";
  network: "good" | "weak" | "bad";
  permission: "unknown" | "requesting" | "granted" | "denied";
  grant: "idle" | "loading" | "ready" | "failed";
  rtc: "idle" | "joining" | "joined" | "reconnecting" | "disconnected" | "kicked" | "joinFailed";
  recording: "idle" | "processing" | "ready" | "failed";
  report: "waiting" | "processing" | "ready" | "failed";
};

export type LiveRemoteSeat = {
  userId: string;
  speaking: boolean;
  audioAvailable: boolean;
};

export const demoMediaUiState: MediaUiState = {
  grant: "ready",
  mode: "demo",
  network: "good",
  permission: "granted",
  recording: "ready",
  report: "ready",
  rtc: "joined",
};

const demoPlayers: [string, string, string][] = [
  ["林舟", "已准备", "#213C38"],
  ["Mia", "已准备", "#765B4D"],
  ["Alex", "检查麦克风", "#584A37"],
  ["苏晴", "连接中", "#3B4C55"],
];

const WAITING_ROOM_CAPACITY = 6;
const ROOM_ENTRY_ART = require("../../../assets/design/01-room-entry.png") as number;
const WAITING_ROOM_ART = require("../../../assets/design/02-waiting-room.png") as number;
const LIVE_ROOM_ART = require("../../../assets/design/03-live-voice-room.png") as number;
const REPORT_ART = require("../../../assets/design/04-score-report.png") as number;

function DesignSlice({
  crop,
  horizontalPadding = 36,
  source,
  style,
}: {
  crop: { height: number; left: number; top: number; width: number };
  horizontalPadding?: number;
  source: number;
  style?: object;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const frameWidth = Math.min(windowWidth - horizontalPadding, 817);
  const scale = frameWidth / crop.width;
  return (
    <View pointerEvents="none" style={[{ height: crop.height * scale, overflow: "hidden", width: frameWidth }, style]}>
      <Image
        resizeMode="stretch"
        source={source}
        style={{ height: 1844 * scale, left: -crop.left * scale, position: "absolute", top: -crop.top * scale, width: 853 * scale }}
      />
    </View>
  );
}

function memberReadyLabel(ready: boolean) {
  return ready ? "已准备" : "未准备";
}

function memberSeatTone(index: number) {
  return ["#213C38", "#765B4D", "#584A37", "#3B4C55", "#2F4A44", "#3B4C55"][index % 6];
}

function Avatar({ label, tone, size = 50 }: { label: string; tone: string; size?: number }) {
  return <View style={[styles.avatar, { backgroundColor: tone, borderRadius: size / 2, height: size, width: size }]}><Text style={[styles.avatarText, { fontSize: size * 0.28 }]}>{label.slice(0, 1)}</Text></View>;
}

function RealWaitingSeats({ members }: { members: RoomMemberView[] }) {
  if (members.length === 0) {
    return (
      <View style={styles.seats}>
        <View style={styles.seat}>
          <View style={[styles.seatAvatar, { backgroundColor: "#DDD7C7" }]}>
          <AppIcon color="#FFF" name="user" size={24} />
          </View>
          <View style={styles.seatMeta}>
            <Text style={styles.seatName}>等待加入</Text>
            <Text style={styles.seatState}>暂无成员</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.seats}>
      {members.map((member, index) => (
        <View key={member.playerId} style={styles.seat}>
          <View style={[styles.seatAvatar, { backgroundColor: memberSeatTone(index) }]}>
            {member.nickname ? <Text style={styles.avatarInitial}>{member.nickname.slice(0, 1)}</Text> : <AppIcon color="#FFF" name="user" size={24} />}
          </View>
          <View style={styles.seatMeta}>
            <Text style={styles.seatName}>{member.nickname}</Text>
            <Text style={styles.seatId}>{member.playerId}</Text>
            <Text style={[styles.seatState, member.ready && styles.ready]}>{memberReadyLabel(member.ready)}</Text>
          </View>
          <View style={styles.mic}><AppIcon color="#1C6048" name="mic" size={18} /></View>
        </View>
      ))}
    </View>
  );
}

function DemoWaitingSeats({ ready }: { ready: boolean }) {
  return (
    <View style={styles.seats}>
      {demoPlayers.concat([["", "等待加入", "#DDD7C7"], ["", "等待加入", "#DDD7C7"]]).map(([name, state, tone], index) => (
        <View key={`${name}-${index}`} style={styles.seat}>
          <View style={[styles.seatAvatar, { backgroundColor: tone }]}>
            {name ? <Text style={styles.avatarInitial}>{name.slice(0, 1)}</Text> : <AppIcon color="#FFF" name="user" size={24} />}
          </View>
          <View style={styles.seatMeta}>
            <Text style={styles.seatName}>{name || "等待加入"}</Text>
            <Text style={[styles.seatState, index === 0 && ready && styles.ready]}>{index === 0 && ready ? "已准备" : state}</Text>
          </View>
          {name ? <View style={styles.mic}><AppIcon color="#1C6048" name="mic" size={18} /></View> : null}
        </View>
      ))}
    </View>
  );
}

function mediaReady(mediaState: MediaUiState) {
  return mediaState.permission === "granted" && mediaState.grant === "ready" && mediaState.rtc === "joined";
}

function realMediaPermissionStep(permission: MediaUiState["permission"]) {
  if (permission === "granted") return "麦克风：已授权";
  if (permission === "denied") return "麦克风：被拒绝";
  if (permission === "requesting") return "麦克风：请求中…";
  return "麦克风：待确认";
}

function realMediaGrantStep(grant: MediaUiState["grant"]) {
  if (grant === "ready") return "语音凭证：已获取";
  if (grant === "loading") return "语音凭证：获取中…";
  if (grant === "failed") return "语音凭证：获取失败";
  return "语音凭证：等待获取";
}

function realMediaRtcStep(rtc: MediaUiState["rtc"]) {
  if (rtc === "joined") return "TRTC：已入房";
  if (rtc === "joining") return "TRTC：入房中…";
  if (rtc === "joinFailed") return "TRTC：入房失败";
  if (rtc === "reconnecting") return "TRTC：重连中…";
  if (rtc === "disconnected") return "TRTC：已断开";
  if (rtc === "kicked") return "TRTC：已踢出";
  return "TRTC：等待连接";
}

function realMediaRecoverable(mediaState: MediaUiState) {
  return (
    mediaState.permission === "denied" ||
    mediaState.grant === "failed" ||
    mediaState.rtc === "joinFailed" ||
    mediaState.rtc === "disconnected" ||
    mediaState.rtc === "kicked"
  );
}

function WaitingMediaNotice({ mediaState }: { mediaState: MediaUiState }) {
  if (mediaState.mode === "demo") {
    return <View style={styles.micCheck}><AppIcon color="#215943" name="mic" size={28} /><Text>请先确认麦克风可用</Text></View>;
  }
  const message =
    mediaState.permission === "denied"
      ? "麦克风权限被拒绝，请在系统设置中开启后重试"
      : mediaState.grant === "failed"
        ? "语音凭证获取失败，请检查网络或后端后重试"
        : mediaState.rtc === "joinFailed"
          ? "语音入房失败，可点击下方重试语音连接"
          : mediaState.rtc === "disconnected"
            ? "语音已断开，请检查网络后重试"
            : mediaState.rtc === "kicked"
              ? "你已离开语音房间"
              : mediaReady(mediaState)
            ? "麦克风与语音房间已就绪"
            : mediaState.grant === "loading" || mediaState.rtc === "joining"
              ? "正在准备真实语音连接…"
              : "等待麦克风授权与语音入房";
  return (
    <View style={[styles.micCheck, styles.realMediaNotice]}>
      <AppIcon color="#215943" name="mic" size={28} />
      <View style={styles.realMediaDetail}>
        <Text style={styles.realMediaText}>{message}</Text>
        <Text style={styles.realMediaStep}>{realMediaPermissionStep(mediaState.permission)}</Text>
        <Text style={styles.realMediaStep}>{realMediaGrantStep(mediaState.grant)}</Text>
        <Text style={styles.realMediaStep}>{realMediaRtcStep(mediaState.rtc)}</Text>
      </View>
    </View>
  );
}

function LiveMediaStatus({ mediaState, demoReconnecting }: { mediaState: MediaUiState; demoReconnecting: boolean }) {
  if (mediaState.mode === "demo") {
    return <View style={styles.liveStatusRow}><AppIcon color="#78E2AE" name="signal" size={15} /><Text style={styles.liveStatus}>语音进行中{"\n"}{demoReconnecting ? "Fake 重连中" : "18:42"}</Text></View>;
  }
  const status =
    mediaState.permission === "denied"
      ? ["麦克风权限被拒绝", "请在系统设置中开启后重试"]
      : mediaState.grant === "loading"
        ? ["正在获取语音凭证", "正在连接语音房间"]
        : mediaState.grant === "failed"
          ? ["语音凭证获取失败", "请稍后重试"]
          : mediaState.rtc === "joining"
            ? ["正在连接语音房间", "连接成功后才会开始语音"]
          : mediaState.rtc === "reconnecting"
              ? ["正在重新连接", "其他人可能暂时听不到你"]
                : mediaState.rtc === "kicked"
                  ? ["你已离开语音房间", "请返回房间重新加入"]
                  : mediaState.rtc === "disconnected"
                    ? ["语音已断开", "请检查网络后重试"]
                    : mediaState.rtc === "joinFailed"
                      ? ["语音入房失败", "请稍后重试"]
                    : mediaReady(mediaState)
                      ? ["语音进行中", mediaState.network === "weak" ? "网络较弱，建议靠近 Wi-Fi" : mediaState.network === "bad" ? "网络很差，语音可能中断" : "18:42"]
                      : ["等待语音入房", "连接成功后才会开始语音"];
  return <View><Text style={styles.liveStatus}>{status[0]}</Text><Text style={styles.liveStatusSub}>{status[1]}</Text></View>;
}

function roomProcessingLabels(mediaState: MediaUiState) {
  if (mediaState.mode === "demo") return [];
  const labels: string[] = [];
  if (mediaState.recording === "processing") labels.push("录音上传中");
  if (mediaState.recording === "failed") labels.push("录音上传失败");
  if (mediaState.report === "waiting") labels.push("等待报告生成");
  if (mediaState.report === "processing") labels.push("报告生成中");
  if (mediaState.report === "failed") labels.push("报告生成失败");
  return labels;
}

function Header({ title, back }: { title: string; back?: () => void }) {
  return <View style={styles.header}>{back ? <Pressable accessibilityLabel="离开房间" onPress={back}><AppIcon color="#174638" name="arrow-left" size={26} /></Pressable> : <View style={styles.logo}><AppIcon color="#174B3B" name="book-open" size={24} /><Text style={styles.logoText}>English Room</Text></View>}<View style={styles.profile}><AppIcon color="#174638" name="user" size={19} /></View></View>;
}

function BottomTabs() { return <View style={styles.tabs} testID="lobby-bottom-tabs"><View style={styles.tabItem}><AppIcon color="#1B573F" name="house" size={19} /><Text style={styles.tabActive}>大厅</Text></View><View style={styles.tabItem}><AppIcon color="#98A298" name="door-open" size={19} /><Text style={styles.tab}>房间</Text></View><View style={styles.tabItem}><AppIcon color="#98A298" name="user" size={19} /><Text style={styles.tab}>我的</Text></View></View>; }

export function LobbyScreen({
  onCreate,
  onJoin,
  busy = false,
  mediaState = demoMediaUiState,
}: {
  onCreate: () => void;
  onJoin: (code: string) => void;
  busy?: boolean;
  mediaState?: MediaUiState;
}) {
  const [code, setCode] = useState("");
  const [joinHint, setJoinHint] = useState<string>();
  const trimmed = code.trim();
  const canJoin = trimmed.length > 0 && !busy;
  const submitJoin = () => {
    if (!trimmed) {
      setJoinHint("请输入房间码后再加入");
      return;
    }
    if (busy) return;
    setJoinHint(undefined);
    onJoin(trimmed);
  };
  return <SafeAreaView style={styles.safe}><View style={styles.lobby}><Header title="" /><Text style={mediaState.mode === "real" ? styles.realChip : styles.demoChip} accessibilityLabel={mediaState.mode === "real" ? "真实语音模式" : "Demo 控制面"}>{mediaState.mode === "real" ? "真实语音模式 · TRTC/SOE" : "Demo / Fake 控制面 · 非真实 TRTC/SOE"}</Text><Text style={styles.lobbyTitle}>用英语进入今晚的故事</Text><Text style={styles.lobbyPrompt}>今晚想练哪一句？</Text><View style={styles.smallRule}><View /><AppIcon color="#174638" name="sparkles" size={15} /><View /></View>
    <View style={styles.portCard}><DesignSlice crop={{ height: 570, left: 38, top: 635, width: 778 }} horizontalPadding={32} source={ROOM_ENTRY_ART} style={styles.portArt} /><View style={styles.portMist} /><View pointerEvents="none" style={styles.portFooterShade} /><View style={styles.portName}><AppIcon color="#FFF" name="anchor" size={18} /><Text style={styles.portNameText}>雾港疑云</Text></View><Text style={styles.roomPill}>{mediaState.mode === "real" ? "ROOM LIVE" : "ROOM DEMO"}</Text>
    {mediaState.mode === "demo" ? (
      <>
        <View style={styles.avatarGroup}><Avatar label="林舟" tone="#213C38" /><Avatar label="Mia" tone="#765B4D" /><Avatar label="Alex" tone="#584A37" /><Avatar label="苏晴" tone="#3B4C55" /><View style={styles.moreAvatar}><Text style={styles.avatarText}>+2</Text></View></View>
        <View style={styles.portMeta}><AppIcon color="#FFF" name="users" size={15} /><Text style={styles.portMetaText}>4 / 6 位玩家</Text><Text style={styles.portMetaSeparator}>|</Text><AppIcon color="#FFF" name="clock" size={15} /><Text style={styles.portMetaText}>预计 25 分钟</Text></View>
      </>
    ) : (
      <View style={styles.portMeta}><AppIcon color="#FFF" name="users" size={15} /><Text style={styles.portMetaText}>真实房间 · 创建或加入后同步成员</Text></View>
    )}
    </View>
    <Pressable accessibilityLabel="加入语音房间" disabled={!canJoin} onPress={submitJoin} style={[styles.primaryCta, !canJoin && styles.ctaDisabled]} testID="join-room-button"><View style={styles.ctaContent}>{busy ? <Text style={styles.ctaText}>加入中…</Text> : <><AppIcon color="#FFF" name="mic" size={19} /><Text style={styles.ctaText}>加入语音房间</Text><AppIcon color="#FFF" name="chevron-right" size={19} /></>}</View></Pressable>
    <Pressable accessibilityLabel="创建新房间" disabled={busy} onPress={onCreate} style={[styles.outlineCta, busy && styles.ctaDisabled]} testID="create-room-button"><View style={styles.ctaContent}>{busy ? <Text style={styles.outlineText}>创建中…</Text> : <><AppIcon color="#1B513D" name="house" size={19} /><Text style={styles.outlineText}>创建新房间</Text><AppIcon color="#1B513D" name="chevron-right" size={19} /></>}</View></Pressable>
    <View style={[styles.codeCta, !trimmed && styles.codeCtaEmpty]}><AppIcon color="#1B513D" name="grid" size={19} /><TextInput accessibilityLabel="房间码" autoCapitalize="characters" editable={!busy} onChangeText={(value) => { setCode(value); if (value.trim()) setJoinHint(undefined); }} placeholder="输入房间码" placeholderTextColor="#63756B" style={styles.codeInput} testID="room-code-input" value={code}/><Pressable accessibilityLabel="输入房间码" disabled={!canJoin} onPress={submitJoin} testID="submit-room-code-button"><AppIcon color={canJoin ? "#1B513D" : "#9EAEA4"} name="chevron-right" size={19} /></Pressable></View>
    {joinHint ? <Text accessibilityLabel="加入提示" style={styles.joinHint}>{joinHint}</Text> : null}
    {!trimmed ? <Text accessibilityLabel="房间码空提示" style={styles.joinHint}>房间码为空时无法加入</Text> : null}
  </View><BottomTabs /></SafeAreaView>;
}

export function WaitingScreen({
  ready,
  onReady,
  onStart,
  onLeave,
  onReconnectMedia,
  roomCode,
  busy = false,
  mediaState = demoMediaUiState,
  members = [],
}: {
  ready: boolean;
  onReady: () => void;
  onStart: () => void;
  onLeave: () => void;
  onReconnectMedia?: () => void;
  roomCode?: string;
  busy?: boolean;
  mediaState?: MediaUiState;
  members?: RoomMemberView[];
}) {
  const canStart = ready && !busy && (mediaState.mode === "demo" || mediaReady(mediaState));
  const realMode = mediaState.mode === "real";
  const memberCount = realMode ? members.length : 4;
  const showMediaRetry = realMode && realMediaRecoverable(mediaState) && Boolean(onReconnectMedia);
  const insets = useSafeAreaInsets();
  const waitingScrollStyle = [styles.waiting, { paddingBottom: 110 + insets.bottom }];
  const waitingFooterStyle = [styles.waitFooter, { bottom: insets.bottom }];
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={waitingScrollStyle} testID="waiting-scroll"><Header back={onLeave} title=""/><Text style={realMode ? styles.realChip : styles.demoChip} accessibilityLabel={realMode ? "真实语音模式" : "Demo 控制面"}>{realMode ? "真实语音模式 · 等待媒体就绪" : "Demo / Fake 控制面 · 语音为 Fake"}</Text><Text style={styles.waitTitle}>雾港疑云</Text><View style={styles.waitRule}><View /><AppIcon color="#6D5A3A" name="sparkles" size={15} /><View /></View><Text style={styles.waitingHint}>等待同伴入座</Text>{realMode ? null : <Text style={styles.legacyLabel}>MINT</Text>}<View style={styles.codeRow}><Text style={styles.codeBadge} accessibilityLabel="真实房间码">房间 {roomCode ?? "—"}</Text><View style={styles.shareBadge}><AppIcon color="#1C4C3B" name="share" size={18} /></View></View><View style={styles.banner}><DesignSlice crop={{ height: 285, left: 30, top: 332, width: 793 }} horizontalPadding={36} source={WAITING_ROOM_ART} style={styles.bannerArt} /><View style={[styles.bannerOverlay, { backgroundColor: "rgba(8, 43, 37, .88)" }]} /><AppIcon color="#C8B378" name="anchor" size={34} /><Text style={styles.bannerText}>序章将在所有玩家准备后开始</Text></View><Text style={styles.count}>────  玩家 {memberCount} / {WAITING_ROOM_CAPACITY}  ────</Text>{realMode ? <RealWaitingSeats members={members} /> : <DemoWaitingSeats ready={ready} />}<WaitingMediaNotice mediaState={mediaState} />{showMediaRetry ? <Pressable accessibilityLabel="重试语音连接" disabled={busy} onPress={() => onReconnectMedia?.()} style={[styles.mediaRetry, busy && styles.ctaDisabled]} testID="waiting-reconnect-media-button"><View style={styles.inlineButtonContent}><AppIcon color="#7A4E00" name="refresh" size={18} /><Text style={styles.mediaRetryText}>重试语音连接</Text></View></Pressable> : null}</ScrollView><View style={waitingFooterStyle} testID="waiting-footer"><Pressable accessibilityLabel="准备好了" disabled={busy} onPress={onReady} style={[styles.testMic, busy && styles.ctaDisabled]} testID="ready-button"><View style={styles.inlineButtonContent}>{busy ? <Text>提交中…</Text> : ready ? <><AppIcon color="#1E503D" name="check" size={18} /><Text>已准备</Text></> : <><AppIcon color="#1E503D" name="mic" size={18} /><Text>测试麦克风</Text></>}</View></Pressable><Pressable accessibilityLabel="开始房间" disabled={!canStart} onPress={onStart} style={[styles.start, !canStart && styles.startDisabled]} testID="start-room-button"><View style={styles.inlineButtonContent}>{busy ? <Text style={styles.startText}>开始中…</Text> : <><AppIcon color="#FFF" name="book-open" size={18} /><Text style={styles.startText}>开始故事</Text></>}</View></Pressable></View></SafeAreaView>;
}

function Player({ name, state, speaker, reconnecting }: { name: string; state: string; speaker?: boolean; reconnecting?: boolean }) {
  return <View style={styles.livePlayer}><View style={[styles.liveAvatar, speaker && styles.speakerAvatar, reconnecting && styles.reconnectAvatar]}><Text style={styles.liveInitial}>{name[0]}</Text></View><Text style={styles.liveName}>{name}</Text><Text style={[styles.liveState, speaker && styles.speakingState, reconnecting && styles.reconnectState]}>{reconnecting ? "重新连接中" : state}</Text></View>;
}

export function LiveScreen({
  onEnd,
  busy = false,
  mediaState = demoMediaUiState,
  muted: mutedProp,
  speakerOn: speakerProp,
  onToggleMute,
  onToggleSpeaker,
  onReconnectMedia,
  remotes = [],
  localName = "我",
}: {
  onEnd: () => void;
  busy?: boolean;
  mediaState?: MediaUiState;
  muted?: boolean;
  speakerOn?: boolean;
  onToggleMute?: () => void;
  onToggleSpeaker?: () => void;
  onReconnectMedia?: () => void;
  remotes?: LiveRemoteSeat[];
  localName?: string;
}) {
  const [mutedLocal, setMutedLocal] = useState(false);
  const [speakerLocal, setSpeakerLocal] = useState(true);
  const [demoReconnecting, setDemoReconnecting] = useState(false);
  const realMode = mediaState.mode === "real";
  const muted = realMode ? Boolean(mutedProp) : mutedLocal;
  const speaker = realMode ? speakerProp !== false : speakerLocal;
  const reconnecting = realMode ? mediaState.rtc === "reconnecting" : demoReconnecting;
  const realAudioDisabled = realMode && !mediaReady(mediaState);
  const rtcNeedsReconnect =
    realMode && (mediaState.rtc === "disconnected" || mediaState.rtc === "joinFailed" || mediaState.rtc === "kicked");
  const reconnectLabel = mediaState.rtc === "disconnected" ? "重新连接" : "重新入房";
  const networkLabel =
    mediaState.network === "weak" ? "较弱" : mediaState.network === "bad" ? "很差" : "良好";
  const toggleMute = () => {
    if (realMode) {
      onToggleMute?.();
      return;
    }
    setMutedLocal(!mutedLocal);
  };
  const toggleSpeaker = () => {
    if (realMode) {
      onToggleSpeaker?.();
      return;
    }
    setSpeakerLocal(!speakerLocal);
  };
  const insets = useSafeAreaInsets();
  const liveRootStyle = [styles.live, { paddingBottom: 10 + insets.bottom }];
  return (
    <SafeAreaView style={styles.liveSafe}>
      <View style={liveRootStyle} testID="live-screen-root">
        <Image source={LIVE_ROOM_ART} style={[styles.liveBackground, { opacity: 0.1 }]} />
        <View pointerEvents="none" style={[styles.liveTint, { backgroundColor: "rgba(4, 29, 27, .76)" }]} />
        <Text style={mediaState.mode === "real" ? styles.liveReal : styles.liveDemo} accessibilityLabel={mediaState.mode === "real" ? "真实语音模式" : "Demo 控制面"}>{mediaState.mode === "real" ? "真实语音模式 · TRTC" : "Demo / Fake RTC · 非真实语音"}</Text>
        <View style={styles.liveTop}>
          <Pressable accessibilityLabel="离开房间" onPress={onEnd} style={styles.liveHeaderButton}><AppIcon color="#FFF" name="arrow-left" size={21} /></Pressable>
          <View>
            <Text style={styles.liveRoom}>雾港疑云</Text>
            <Text style={styles.livePractice}>正在练习</Text>
            <LiveMediaStatus demoReconnecting={reconnecting} mediaState={mediaState} />
          </View>
          <View style={styles.liveHeaderButton}><AppIcon color="#FFF" name="more" size={21} /></View>
        </View>
        <View style={styles.liveBody}>
          <View style={styles.players}>
            {realMode ? (
              <>
                <Player name={localName || "我"} state={muted ? "已静音" : "我"} />
                {remotes.map((remote) => (
                  <Player
                    key={remote.userId}
                    name={remote.userId}
                    speaker={remote.speaking}
                    state={remote.speaking ? "正在发言" : remote.audioAvailable ? "在线" : "已静音"}
                  />
                ))}
                {remotes.length === 0 ? <Player name="远端" state="等待加入" /> : null}
              </>
            ) : (
              <>
                <Player name="林舟" state="我" />
                <Player name="Mia" speaker state="正在发言" />
                <Player name="Alex" state="已静音" />
                <Player name="苏晴" reconnecting={reconnecting} state="连接中" />
              </>
            )}
          </View>
          <View style={styles.clue}>
            <View style={styles.clueKicker}><AppIcon color="#D6B971" name="anchor" size={16} /><Text style={styles.clueKickerText}>第二幕 · 码头</Text></View>
            <Text style={styles.clueRule}>────    你的线索    ────</Text>
            <Text style={styles.clueText}>Ask Mia where she was at 10 PM.</Text>
            <Text style={styles.clueHint}>请使用英语完成对话</Text>
          </View>
          <View style={styles.signalRow}>
            {realMode ? (
              <View style={styles.signal}><AppIcon color="#78E2AE" name="signal" size={14} /><Text>本机 {networkLabel}</Text></View>
            ) : (
              ["林舟 良好", "Mia 良好", "Alex 良好", "苏晴 较弱"].map((signal) => (
                <View key={signal} style={styles.signal}><AppIcon color="#78E2AE" name="signal" size={14} /><Text>{signal}</Text></View>
              ))
            )}
          </View>
        </View>
        <View style={styles.controls} testID="live-controls">
          <Control disabled={realAudioDisabled} label={muted ? "打开麦克风" : "静音"} icon={muted ? "mic-off" : "mic"} onPress={toggleMute} />
          <Control disabled={realAudioDisabled} label={speaker ? "扬声器开" : "扬声器关"} icon={speaker ? "volume" : "volume-off"} onPress={toggleSpeaker} />
          {realMode ? (
            rtcNeedsReconnect ? (
              <Control
                disabled={busy || !onReconnectMedia}
                icon="refresh"
                label={reconnectLabel}
                onPress={() => onReconnectMedia?.()}
                testID="real-reconnect-button"
              />
            ) : (
              <Control disabled icon="more" label="更多" onPress={() => undefined} />
            )
          ) : (
            <Control label="触发重连" icon="more" onPress={() => setDemoReconnecting(!demoReconnecting)} testID="reconnect-button" />
          )}
          <Control danger disabled={busy} label={busy ? "结束中…" : "结束房间"} icon="phone-off" onPress={onEnd} testID="end-room-button" />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Control({ label, icon, danger, onPress, testID, disabled }: { label: string; icon: AppIconName; danger?: boolean; onPress: () => void; testID?: string; disabled?: boolean }) { return <Pressable accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.control, disabled && { opacity: 0.45 }]} testID={testID}><View style={[styles.controlCircle, danger && styles.hangup]}><AppIcon color="#FFF" name={icon} size={19} /></View><Text style={[styles.controlText, danger && styles.dangerText]}>{label === "触发重连" ? "更多" : label}</Text></Pressable>; }

export function ReportScreen({ error, items, onDone, onRefresh, onRetry, mediaState = demoMediaUiState }: { error?: string; items: ReportItem[]; onDone: () => void; onRefresh?: () => void; onRetry: (item: ReportItem) => void; mediaState?: MediaUiState }) {
  const reports = items;
  const friendlyName = (id: string) => ({ demo_mia: "Mia", demo_alex: "Alex", demo_suqing: "苏晴" }[id] ?? (id.startsWith("player_") || id.includes("uuid") ? "林舟" : id));
  const statusText = (status: ReportItem["status"]) => mediaState.mode === "real" ? ({ completed: "评分完成", processing: "评分处理中", waiting: "等待音频生成", failed: "评分失败" }[status]) : ({ completed: "评分完成", processing: "处理中 预计 20 秒", waiting: "等待评分", failed: "评分失败" }[status]);
  const allCompleted =
    mediaState.recording === "ready" &&
    mediaState.report === "ready" &&
    reports.length > 0 &&
    reports.every((item) => item.status === "completed");
  const showSuccess = mediaState.mode === "demo" || (allCompleted && mediaState.recording !== "failed");
  const processingLabels = roomProcessingLabels(mediaState);
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.report}><View style={styles.reportHeader}><AppIcon color="#174638" name="arrow-left" size={24} /><View><Text style={styles.reportTitle}>本局英语报告</Text><Text style={styles.legacyReport}>本局口语报告</Text></View><View /></View><View style={styles.reportSub}><AppIcon color="#778078" name="sparkles" size={15} /><Text style={styles.reportSubText}>雾港疑云 · 25 分钟</Text><AppIcon color="#778078" name="sparkles" size={15} /></View><View style={styles.infoCard}><View style={styles.infoImage}><Image resizeMode="stretch" source={REPORT_ART} style={styles.infoImageArt} /></View><View><Text style={styles.infoName}>雾港疑云</Text><View style={styles.infoMeta}><AppIcon color="#788078" name="users" size={13} /><Text style={styles.infoMetaText}>4 人房间</Text><AppIcon color="#788078" name="clock" size={13} /><Text style={styles.infoMetaText}>25 分钟</Text><AppIcon color="#788078" name="calendar" size={13} /><Text style={styles.infoMetaText}>2025/05/18</Text></View></View></View>
    {processingLabels.length ? <View style={styles.processingStrip}>{processingLabels.map((label) => <Text key={label} style={styles.processingText}>{label}</Text>)}</View> : null}<View style={styles.scoreCard} testID="report-score-card"><View style={styles.scoreCircle}><Text adjustsFontSizeToFit numberOfLines={1} style={styles.scoreNumber}>{reports.find((item) => item.status === "completed")?.score ?? "—"}</Text></View><View style={styles.scoreSummary}><Text style={styles.scoreFor}>本局口语评分</Text><Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={2} style={styles.excellent}>{showSuccess ? "表现优秀" : "等待全员评分完成"}</Text><Text style={styles.scoreDetails}>发言表现与英语表达综合评估</Text></View></View><View style={styles.metrics}>{[["发音", reports[0]?.pronunciation], ["流利度", reports[0]?.fluency], ["完整度", reports[0]?.score], ["词汇", reports[0]?.score]].map(([label, score]) => <View key={label} style={styles.metric}><Text numberOfLines={1} style={styles.metricLabel}>{label}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricScore}>{score ?? "—"}</Text><View style={styles.metricBar}/></View>)}</View><View style={styles.tip}><AppIcon color="#5AA178" name="lightbulb" size={28} /><View><Text style={styles.tipTitle}>改进建议</Text><Text style={styles.tipBody}>减少长停顿，让线索表达更连贯。</Text></View></View>{error ? <><Text accessibilityLabel="报告错误">{error}</Text>{onRefresh ? <Pressable accessibilityLabel="重新获取报告" onPress={onRefresh} style={styles.reportRefresh}><View style={styles.inlineButtonContent}><AppIcon color="#B85036" name="refresh" size={17} /><Text style={styles.reportRefreshText}>重新获取报告</Text></View></Pressable> : null}</> : null}<Text style={styles.resultTitle}>玩家结果</Text>{reports.map((item, index) => <View key={item.scoreJobId} style={styles.reportRow}><View style={styles.resultAvatar}><Text>{index + 1}</Text></View><Text numberOfLines={1} style={styles.resultName}>{friendlyName(item.playerName)}</Text><View style={styles.resultState}><Text numberOfLines={1} style={[styles.resultStateText, item.status === "failed" && styles.failed]}>{statusText(item.status)}</Text>{item.failureReason ? <Text numberOfLines={2} style={styles.failureReason}>{item.failureReason}</Text> : null}</View>{item.status === "failed" ? <Pressable accessibilityLabel="重试评分" onPress={() => onRetry(item)}><View style={styles.inlineButtonContent}><AppIcon color="#B85036" name="refresh" size={15} /><Text style={styles.retry}>重新提交</Text></View></Pressable> : <Text adjustsFontSizeToFit numberOfLines={1} style={styles.resultScore}>{item.status === "completed" ? item.score ?? "—" : "—"}</Text>}</View>)}<Pressable accessibilityLabel="回到大厅" onPress={onDone} style={styles.return}><View style={styles.inlineButtonContent}><AppIcon color="#FFF" name="house" size={19} /><Text style={styles.returnText}>返回大厅</Text></View></Pressable></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{backgroundColor:"#FCFAF4",flex:1}, lobby:{flex:1,padding:16}, header:{alignItems:"center",flexDirection:"row",justifyContent:"space-between",paddingTop:6},logo:{alignItems:"center",flexDirection:"row",gap:7},book:{color:"#174B3B",fontSize:24},logoText:{color:"#174638",fontFamily:"serif",fontSize:23,fontWeight:"700"},profile:{alignItems:"center",backgroundColor:"#D4C7B3",borderRadius:19,height:38,justifyContent:"center",width:38},back:{color:"#174638",fontSize:40,lineHeight:40},demoChip:{alignSelf:"flex-start",backgroundColor:"#E8F2EA",borderColor:"#1C593F",borderRadius:8,borderWidth:1,color:"#1C593F",fontSize:11,fontWeight:"800",marginTop:10,paddingHorizontal:10,paddingVertical:6},realChip:{alignSelf:"flex-start",backgroundColor:"#FFF4D9",borderColor:"#9A6A18",borderRadius:8,borderWidth:1,color:"#7A4E00",fontSize:11,fontWeight:"800",marginTop:10,paddingHorizontal:10,paddingVertical:6},lobbyTitle:{color:"#194535",fontFamily:"serif",fontSize:27,fontWeight:"700",lineHeight:34,marginTop:12},lobbyPrompt:{color:"#748278",fontSize:11,marginTop:2},smallRule:{alignItems:"center",flexDirection:"row",gap:6,marginVertical:7,width:100},portCard:{backgroundColor:"#173C3D",borderRadius:20,height:270,overflow:"hidden",position:"relative"},portArt:{height:"100%",left:0,opacity:.82,position:"absolute",top:0,width:"100%"},portMist:{backgroundColor:"#496365",height:190,opacity:.25,position:"absolute",right:-70,top:70,transform:[{rotate:"-20deg"}],width:390},portFooterShade:{backgroundColor:"rgba(12, 37, 36, .74)",bottom:0,height:92,left:0,position:"absolute",right:0},portName:{alignItems:"center",flexDirection:"row",gap:7,left:18,position:"absolute",top:20},portNameText:{color:"#FFF",fontFamily:"serif",fontSize:24,fontWeight:"700"},roomPill:{backgroundColor:"#263D3C",borderRadius:10,color:"#FFF",fontSize:12,padding:9,position:"absolute",right:12,top:19},avatarGroup:{bottom:38,flexDirection:"row",gap:6,left:18,position:"absolute"},avatar:{alignItems:"center",borderColor:"#FFF",borderWidth:2,justifyContent:"center"},avatarText:{color:"#FFF",fontWeight:"800"},moreAvatar:{alignItems:"center",backgroundColor:"#365951",borderColor:"#B6C8B9",borderRadius:25,borderWidth:1,height:50,justifyContent:"center",width:50},portMeta:{alignItems:"center",bottom:16,flexDirection:"row",gap:6,left:18,position:"absolute"},portMetaText:{color:"#FFF",fontSize:12},portMetaSeparator:{color:"#C6D8CD",fontSize:12,marginHorizontal:2},primaryCta:{backgroundColor:"#1A563E",borderRadius:12,marginTop:11,padding:13},ctaContent:{alignItems:"center",flexDirection:"row",gap:9,justifyContent:"space-between"},ctaText:{color:"#FFF",flex:1,fontSize:16,fontWeight:"800"},ctaDisabled:{opacity:0.45},outlineCta:{borderColor:"#95A498",borderRadius:12,borderWidth:1,marginTop:8,padding:12},codeCta:{alignItems:"center",borderColor:"#95A498",borderRadius:12,borderWidth:1,flexDirection:"row",justifyContent:"space-between",marginTop:8,padding:12},codeCtaEmpty:{borderColor:"#C9B8A2"},outlineText:{color:"#1B513D",fontSize:15,fontWeight:"800"},outlineDisabled:{color:"#9EAEA4"},codeInput:{color:"#174638",flex:1,fontSize:14,marginHorizontal:12},joinHint:{color:"#B85036",fontSize:12,fontWeight:"700",marginTop:8},tabs:{borderTopColor:"#E1DED3",borderTopWidth:1,flexDirection:"row",justifyContent:"space-around",paddingBottom:9,paddingTop:7},tabItem:{alignItems:"center",gap:3},tab:{color:"#98A298",fontSize:11,textAlign:"center"},tabActive:{color:"#1B573F",fontSize:11,fontWeight:"800",textAlign:"center"},
  waiting:{padding:18,paddingBottom:110},waitTitle:{color:"#194535",fontFamily:"serif",fontSize:35,fontWeight:"700",textAlign:"center"},waitRule:{alignItems:"center",flexDirection:"row",gap:10,justifyContent:"center",marginTop:4},waitRuleLine:{backgroundColor:"#CFC4AF",height:1,width:80},waitingHint:{color:"#698075",fontSize:12,textAlign:"center"},legacyLabel:{color:"#768B80",fontSize:10,textAlign:"center"},codeRow:{alignItems:"center",flexDirection:"row",gap:10,justifyContent:"center",marginVertical:10},codeBadge:{borderColor:"#CFC4AF",borderRadius:20,borderWidth:1,color:"#4B594F",paddingHorizontal:18,paddingVertical:7},shareBadge:{alignItems:"center",borderColor:"#CFC4AF",borderRadius:18,borderWidth:1,height:38,justifyContent:"center",width:42},banner:{alignItems:"center",backgroundColor:"#123D34",borderColor:"#D0BE91",borderRadius:13,borderWidth:1,flexDirection:"row",gap:16,height:127,justifyContent:"center",overflow:"hidden"},bannerArt:{left:0,opacity:.74,position:"absolute",top:0,width:"100%"},bannerOverlay:{backgroundColor:"rgba(8, 43, 37, .74)",bottom:0,left:0,position:"absolute",right:0,top:0},bannerLight:{color:"#C8B378",fontSize:42,marginRight:20},bannerText:{color:"#FFF2D0",fontFamily:"serif",fontSize:18},count:{color:"#274F40",fontFamily:"serif",fontSize:17,fontWeight:"700",marginVertical:20,textAlign:"center"},seats:{flexDirection:"row",flexWrap:"wrap",gap:12},seat:{alignItems:"center",borderColor:"#D8CFBC",borderRadius:14,borderWidth:1,flexDirection:"row",gap:10,height:132,padding:12,width:"48%"},seatAvatar:{alignItems:"center",borderRadius:34,height:64,justifyContent:"center",width:64},seatMeta:{flex:1,minWidth:0},avatarInitial:{color:"#FFF",fontSize:20},seatName:{color:"#204A3B",fontFamily:"serif",fontSize:18,fontWeight:"700"},seatId:{color:"#698075",fontSize:10,marginTop:2},seatState:{color:"#5E7569",fontSize:12,marginTop:7},ready:{backgroundColor:"#2E7156",borderRadius:12,color:"#FFF",overflow:"hidden",paddingHorizontal:8,paddingVertical:4},mic:{alignItems:"center",position:"absolute",right:10},micCheck:{alignItems:"center",backgroundColor:"#F8F3E8",borderColor:"#E9DFCC",borderRadius:12,borderWidth:1,flexDirection:"row",gap:12,marginTop:24,padding:18},realMediaNotice:{backgroundColor:"#FFF7E6",borderColor:"#E5C27A"},realMediaText:{color:"#684300",flex:1,fontSize:13,fontWeight:"700"},realMediaDetail:{flex:1,gap:4},realMediaStep:{color:"#7A5A1E",fontSize:11,fontWeight:"600"},mediaRetry:{alignItems:"center",backgroundColor:"#FFF",borderColor:"#C9A34E",borderRadius:12,borderWidth:1,marginTop:12,padding:14},mediaRetryText:{color:"#7A4E00",fontSize:14,fontWeight:"800"},inlineButtonContent:{alignItems:"center",flexDirection:"row",gap:8,justifyContent:"center"},waitFooter:{backgroundColor:"#FCFAF4",borderTopColor:"#EEE6D5",borderTopWidth:1,flexDirection:"row",gap:12,left:0,padding:14,position:"absolute",right:0},testMic:{alignItems:"center",borderColor:"#1E503D",borderRadius:12,borderWidth:1,flex:1,padding:17},start:{alignItems:"center",backgroundColor:"#1C563E",borderRadius:12,flex:1,padding:17},startDisabled:{backgroundColor:"#9EAEA4"},startText:{color:"#FFF",fontSize:16,fontWeight:"800"},
  liveSafe:{backgroundColor:"#061E1D",flex:1},live:{backgroundColor:"#082524",flex:1,justifyContent:"space-between",paddingHorizontal:14,paddingTop:8,paddingBottom:10},liveBackground:{bottom:0,left:0,opacity:.22,position:"absolute",right:0,top:0},liveTint:{backgroundColor:"rgba(4, 29, 27, .58)",bottom:0,left:0,position:"absolute",right:0,top:0},liveBody:{flexShrink:1,minHeight:0},liveDemo:{alignSelf:"flex-start",backgroundColor:"#14352F",borderColor:"#3E9470",borderRadius:8,borderWidth:1,color:"#78E2AE",fontSize:11,fontWeight:"800",marginBottom:6,paddingHorizontal:10,paddingVertical:5},liveReal:{alignSelf:"flex-start",backgroundColor:"#3C2C11",borderColor:"#D6A23A",borderRadius:8,borderWidth:1,color:"#FFE1A1",fontSize:11,fontWeight:"800",marginBottom:6,paddingHorizontal:10,paddingVertical:5},liveTop:{alignItems:"center",flexDirection:"row",justifyContent:"space-between"},liveHeaderButton:{alignItems:"center",borderColor:"#90A7A0",borderRadius:24,borderWidth:1,height:36,justifyContent:"center",width:36},liveRoom:{color:"#FFF6DA",fontFamily:"serif",fontSize:17,textAlign:"center"},livePractice:{color:"#DAE8DD",fontSize:10,textAlign:"center"},liveStatusRow:{alignItems:"center",flexDirection:"row",gap:4,justifyContent:"center"},liveStatus:{color:"#78E2AE",fontSize:12,lineHeight:16,textAlign:"center"},liveStatusSub:{color:"#D8C58F",fontSize:11,lineHeight:15,textAlign:"center"},players:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",marginTop:10},livePlayer:{alignItems:"center",height:118,width:"47%"},liveAvatar:{alignItems:"center",backgroundColor:"#284441",borderColor:"#CFE7DC",borderRadius:40,borderWidth:2,height:72,justifyContent:"center",width:72},speakerAvatar:{borderColor:"#75F6BD",borderWidth:4},reconnectAvatar:{borderColor:"#D9A93F"},liveInitial:{color:"#FFF",fontSize:24},liveName:{color:"#FFF9E8",fontFamily:"serif",fontSize:15,marginTop:3},liveState:{color:"#A9B8B2",fontSize:11},speakingState:{backgroundColor:"#3E9470",borderRadius:12,color:"#FFF",paddingHorizontal:8,paddingVertical:3},reconnectState:{color:"#E8B44B"},clue:{borderColor:"#9A8150",borderWidth:1,marginTop:8,padding:10},clueKicker:{alignItems:"center",flexDirection:"row",gap:6},clueKickerText:{color:"#D6B971",fontFamily:"serif",fontSize:15},clueRule:{color:"#6DD6A1",fontSize:11,marginTop:8,textAlign:"center"},clueText:{color:"#FFF1D2",fontFamily:"serif",fontSize:17,marginTop:8,textAlign:"center"},clueHint:{color:"#B6C5B8",fontSize:12,marginTop:8,textAlign:"center"},signalRow:{flexDirection:"row",gap:6,marginTop:8},signal:{alignItems:"center",backgroundColor:"#173532",borderColor:"#405D55",borderRadius:7,borderWidth:1,flex:1,flexDirection:"row",gap:4,justifyContent:"center",padding:5},controls:{backgroundColor:"#142D2B",borderRadius:24,flexDirection:"row",justifyContent:"space-around",marginTop:10,paddingBottom:8,paddingTop:10},control:{alignItems:"center",width:70},controlCircle:{alignItems:"center",backgroundColor:"#24413D",borderRadius:26,height:48,justifyContent:"center",width:48},hangup:{backgroundColor:"#C84A45"},controlText:{color:"#E8E4D8",fontSize:11,lineHeight:14,marginTop:4,textAlign:"center"},dangerText:{color:"#F18A7C"},
  report:{padding:18,paddingBottom:28,width:"100%"},reportHeader:{alignItems:"center",flexDirection:"row",justifyContent:"space-between"},reportTitle:{color:"#1B4B3C",fontSize:20,fontWeight:"800"},legacyReport:{color:"#65796D",fontSize:10,textAlign:"center"},reportSub:{alignItems:"center",flexDirection:"row",gap:7,justifyContent:"center",marginVertical:10},reportSubText:{color:"#778078"},infoCard:{alignItems:"center",borderColor:"#DBDDD4",borderRadius:15,borderWidth:1,flexDirection:"row",gap:13,overflow:"hidden",padding:10},infoImage:{backgroundColor:"#244D49",borderRadius:9,height:58,overflow:"hidden",width:64},infoImageArt:{height:886,left:-25,position:"absolute",top:-145,width:410},infoName:{color:"#1B4A3B",fontFamily:"serif",fontSize:18,fontWeight:"700"},infoMeta:{alignItems:"center",flexDirection:"row",flexWrap:"wrap",gap:4,marginTop:8},infoMetaText:{color:"#788078",fontSize:11},processingStrip:{backgroundColor:"#FFF7E6",borderColor:"#E7C06B",borderRadius:12,borderWidth:1,gap:4,marginTop:12,padding:10},processingText:{color:"#7A4E00",fontSize:12,fontWeight:"800"},scoreCard:{alignItems:"center",backgroundColor:"#FFFEFA",borderColor:"#EFF0E8",borderRadius:16,borderWidth:1,flexDirection:"row",flexShrink:1,gap:12,marginTop:16,minWidth:0,overflow:"hidden",padding:14,width:"100%"},scoreCircle:{alignItems:"center",borderColor:"#36966C",borderRadius:62,borderWidth:8,flexShrink:0,height:124,justifyContent:"center",width:124},scoreNumber:{color:"#1F654B",fontFamily:"serif",fontSize:48},scoreSummary:{flex:1,flexShrink:1,minWidth:0},scoreFor:{color:"#1B4638",fontSize:15,fontWeight:"700"},excellent:{color:"#299368",flexShrink:1,fontFamily:"serif",fontSize:22,marginTop:7},scoreDetails:{color:"#50665A",fontSize:11,marginTop:12},metrics:{backgroundColor:"#FFF",borderColor:"#E7E8DF",borderRadius:15,borderWidth:1,flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",marginTop:16,minWidth:0,paddingVertical:14,width:"100%"},metric:{alignItems:"center",flexBasis:"24%",flexGrow:1,flexShrink:1,maxWidth:"25%",minWidth:0,paddingHorizontal:2},metricLabel:{color:"#50665A",fontSize:11},metricScore:{color:"#176144",fontFamily:"serif",fontSize:20},metricBar:{backgroundColor:"#3DA275",borderRadius:5,height:6,marginTop:7,maxWidth:56,width:"70%"},reportRefresh:{alignItems:"center",borderColor:"#B85036",borderRadius:10,borderWidth:1,marginTop:10,padding:12},reportRefreshText:{color:"#B85036",fontSize:13,fontWeight:"800"},tip:{alignItems:"center",backgroundColor:"#F5F9F0",borderColor:"#E2EAD9",borderRadius:13,borderWidth:1,flexDirection:"row",gap:15,marginTop:14,padding:16},tipTitle:{color:"#24523E",fontSize:15,fontWeight:"800"},tipBody:{color:"#486052",fontSize:13,marginTop:5},resultTitle:{color:"#28523F",fontSize:16,fontWeight:"800",marginTop:18},reportRow:{alignItems:"center",backgroundColor:"#FFF",borderColor:"#E8E8DF",borderRadius:14,borderWidth:1,flexDirection:"row",gap:10,marginTop:10,minWidth:0,padding:11,width:"100%"},resultAvatar:{alignItems:"center",backgroundColor:"#305D4B",borderRadius:20,flexShrink:0,height:40,justifyContent:"center",width:40},resultName:{color:"#1C4335",flex:1,flexShrink:1,fontFamily:"serif",fontSize:16,fontWeight:"700",minWidth:0},resultState:{flex:1,flexShrink:1,minWidth:0},resultStateText:{color:"#417D60",fontSize:11},failureReason:{color:"#DA5B3D",fontSize:10,marginTop:3},failed:{color:"#DA5B3D"},resultScore:{color:"#1D7654",flexShrink:0,fontFamily:"serif",fontSize:20,minWidth:28,textAlign:"right"},retry:{color:"#B85036",flexShrink:0,fontSize:11},return:{alignItems:"center",backgroundColor:"#195F45",borderRadius:10,marginTop:14,padding:17},returnText:{color:"#FFF",fontSize:18,fontWeight:"800"},
});
