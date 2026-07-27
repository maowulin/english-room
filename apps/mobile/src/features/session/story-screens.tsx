import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReportItem } from "@/services/room-client";

export type MediaUiState = {
  mode: "demo" | "real";
  network: "good" | "weak" | "bad";
  permission: "unknown" | "requesting" | "granted" | "denied";
  grant: "idle" | "loading" | "ready" | "failed";
  rtc: "idle" | "joining" | "joined" | "reconnecting" | "disconnected" | "kicked" | "joinFailed";
  recording: "idle" | "processing" | "ready" | "failed";
  report: "waiting" | "processing" | "ready" | "failed";
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

const players = [
  ["林舟", "已准备", "#213C38"],
  ["Mia", "已准备", "#765B4D"],
  ["Alex", "检查麦克风", "#584A37"],
  ["苏晴", "连接中", "#3B4C55"],
];

function mediaReady(mediaState: MediaUiState) {
  return mediaState.permission === "granted" && mediaState.grant === "ready" && mediaState.rtc === "joined";
}

function WaitingMediaNotice({ mediaState }: { mediaState: MediaUiState }) {
  if (mediaState.mode === "demo") {
    return <View style={styles.micCheck}><Text style={styles.micLarge}>♩</Text><Text>请先确认麦克风可用</Text></View>;
  }
  const message =
    mediaState.permission === "denied"
      ? "麦克风权限被拒绝，请在系统设置中开启后重试"
      : mediaState.grant === "loading"
        ? "正在获取语音凭证"
        : mediaState.rtc === "joining"
          ? "正在连接语音房间"
          : mediaReady(mediaState)
            ? "麦克风与语音房间已就绪"
            : "等待麦克风授权与语音入房";
  return <View style={[styles.micCheck, styles.realMediaNotice]}><Text style={styles.micLarge}>♩</Text><Text style={styles.realMediaText}>{message}</Text></View>;
}

function LiveMediaStatus({ mediaState, demoReconnecting }: { mediaState: MediaUiState; demoReconnecting: boolean }) {
  if (mediaState.mode === "demo") {
    return <Text style={styles.liveStatus}>▥  语音进行中{"\n"}{demoReconnecting ? "Fake 重连中" : "18:42"}</Text>;
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
  return <View style={styles.header}>{back ? <Pressable accessibilityLabel="离开房间" onPress={back}><Text style={styles.back}>‹</Text></Pressable> : <View style={styles.logo}><Text style={styles.book}>▰</Text><Text style={styles.logoText}>English Room</Text></View>}<View style={styles.profile}><Text>●</Text></View></View>;
}

function BottomTabs() { return <View style={styles.tabs} testID="lobby-bottom-tabs"><Text style={styles.tabActive}>⌂{"\n"}大厅</Text><Text style={styles.tab}>▣{"\n"}房间</Text><Text style={styles.tab}>♙{"\n"}我的</Text></View>; }

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
  return <SafeAreaView style={styles.safe}><View style={styles.lobby}><Header title="" /><Text style={mediaState.mode === "real" ? styles.realChip : styles.demoChip} accessibilityLabel={mediaState.mode === "real" ? "真实语音模式" : "Demo 控制面"}>{mediaState.mode === "real" ? "真实语音模式 · TRTC/SOE" : "Demo / Fake 控制面 · 非真实 TRTC/SOE"}</Text><Text style={styles.lobbyTitle}>用英语进入今晚的故事</Text><Text style={styles.lobbyPrompt}>今晚想练哪一句？</Text><View style={styles.smallRule}><View /><Text>✦</Text><View /></View>
    <View style={styles.portCard}><View style={styles.portMist} /><Text style={styles.portName}>●  雾港疑云</Text><Text style={styles.roomPill}>ROOM DEMO</Text><View style={styles.ship}><View style={styles.mast}/><View style={styles.hull}/></View><View style={styles.avatarGroup}><Text>林</Text><Text>M</Text><Text>A</Text><Text>苏</Text><Text>+2</Text></View><Text style={styles.portMeta}>♧  4 / 6 位玩家   |   ◷ 预计 25 分钟</Text></View>
    <Pressable accessibilityLabel="加入语音房间" disabled={!canJoin} onPress={submitJoin} style={[styles.primaryCta, !canJoin && styles.ctaDisabled]} testID="join-room-button"><Text style={styles.ctaText}>{busy ? "加入中…" : "♩          加入语音房间                         ›"}</Text></Pressable>
    <Pressable accessibilityLabel="创建新房间" disabled={busy} onPress={onCreate} style={[styles.outlineCta, busy && styles.ctaDisabled]} testID="create-room-button"><Text style={styles.outlineText}>{busy ? "创建中…" : "⌂          创建新房间                         ›"}</Text></Pressable>
    <View style={[styles.codeCta, !trimmed && styles.codeCtaEmpty]}><Text style={styles.outlineText}>▦</Text><TextInput accessibilityLabel="房间码" autoCapitalize="characters" editable={!busy} onChangeText={(value) => { setCode(value); if (value.trim()) setJoinHint(undefined); }} placeholder="输入房间码" placeholderTextColor="#63756B" style={styles.codeInput} testID="room-code-input" value={code}/><Pressable accessibilityLabel="输入房间码" disabled={!canJoin} onPress={submitJoin} testID="submit-room-code-button"><Text style={[styles.outlineText, !canJoin && styles.outlineDisabled]}>›</Text></Pressable></View>
    {joinHint ? <Text accessibilityLabel="加入提示" style={styles.joinHint}>{joinHint}</Text> : null}
    {!trimmed ? <Text accessibilityLabel="房间码空提示" style={styles.joinHint}>房间码为空时无法加入</Text> : null}
  </View><BottomTabs /></SafeAreaView>;
}

export function WaitingScreen({
  ready,
  onReady,
  onStart,
  onLeave,
  roomCode,
  busy = false,
  mediaState = demoMediaUiState,
}: {
  ready: boolean;
  onReady: () => void;
  onStart: () => void;
  onLeave: () => void;
  roomCode?: string;
  busy?: boolean;
  mediaState?: MediaUiState;
}) {
  const canStart = ready && !busy && (mediaState.mode === "demo" || mediaReady(mediaState));
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.waiting}><Header back={onLeave} title=""/><Text style={mediaState.mode === "real" ? styles.realChip : styles.demoChip} accessibilityLabel={mediaState.mode === "real" ? "真实语音模式" : "Demo 控制面"}>{mediaState.mode === "real" ? "真实语音模式 · 等待媒体就绪" : "Demo / Fake 控制面 · 语音为 Fake"}</Text><Text style={styles.waitTitle}>雾港疑云</Text><Text style={styles.waitingHint}>等待同伴入座</Text><Text style={styles.legacyLabel}>MINT</Text><Text style={styles.codeBadge} accessibilityLabel="真实房间码">房间 {roomCode ?? "—"}    ⇧</Text><View style={styles.banner}><Text style={styles.bannerLight}>♜</Text><Text style={styles.bannerText}>序章将在所有玩家准备后开始</Text></View><Text style={styles.count}>────  玩家 4 / 6  ────</Text><View style={styles.seats}>{players.concat([["", "等待加入", "#DDD7C7"], ["", "等待加入", "#DDD7C7"]]).map(([name, state, tone], index) => <View key={`${name}-${index}`} style={styles.seat}><View style={[styles.seatAvatar, { backgroundColor: tone }]}><Text style={styles.avatarInitial}>{name || "♙"}</Text></View><View><Text style={styles.seatName}>{name || "等待加入"}</Text><Text style={[styles.seatState, index === 0 && ready && styles.ready]}>{index === 0 && ready ? "已准备" : state}</Text></View>{name ? <Text style={styles.mic}>♩</Text> : null}</View>)}</View><WaitingMediaNotice mediaState={mediaState} /></ScrollView><View style={styles.waitFooter}><Pressable accessibilityLabel="准备好了" disabled={busy} onPress={onReady} style={[styles.testMic, busy && styles.ctaDisabled]} testID="ready-button"><Text>{busy ? "提交中…" : ready ? "✓ 已准备" : "♩ 测试麦克风"}</Text></Pressable><Pressable accessibilityLabel="开始房间" disabled={!canStart} onPress={onStart} style={[styles.start, !canStart && styles.startDisabled]} testID="start-room-button"><Text style={styles.startText}>{busy ? "开始中…" : "⌑  开始故事"}</Text></Pressable></View></SafeAreaView>;
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
}: {
  onEnd: () => void;
  busy?: boolean;
  mediaState?: MediaUiState;
  muted?: boolean;
  speakerOn?: boolean;
  onToggleMute?: () => void;
  onToggleSpeaker?: () => void;
}) {
  const [mutedLocal, setMutedLocal] = useState(false);
  const [speakerLocal, setSpeakerLocal] = useState(true);
  const [demoReconnecting, setDemoReconnecting] = useState(false);
  const realMode = mediaState.mode === "real";
  const muted = realMode ? Boolean(mutedProp) : mutedLocal;
  const speaker = realMode ? speakerProp !== false : speakerLocal;
  const reconnecting = realMode ? mediaState.rtc === "reconnecting" : demoReconnecting;
  const realAudioDisabled = realMode && !mediaReady(mediaState);
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
  return (
    <SafeAreaView style={styles.liveSafe}>
      <View style={styles.live}>
        <Text style={mediaState.mode === "real" ? styles.liveReal : styles.liveDemo} accessibilityLabel={mediaState.mode === "real" ? "真实语音模式" : "Demo 控制面"}>{mediaState.mode === "real" ? "真实语音模式 · TRTC" : "Demo / Fake RTC · 非真实语音"}</Text>
        <View style={styles.liveTop}>
          <Text style={styles.liveBack}>‹</Text>
          <View>
            <Text style={styles.liveRoom}>雾港疑云</Text>
            <Text style={styles.livePractice}>正在练习</Text>
            <LiveMediaStatus demoReconnecting={reconnecting} mediaState={mediaState} />
          </View>
          <Text style={styles.liveMore}>⌄</Text>
        </View>
        <View style={styles.liveBody}>
          <View style={styles.players}>
            <Player name="林舟" state="我" />
            <Player name="Mia" speaker state="正在发言" />
            <Player name="Alex" state="已静音" />
            <Player name="苏晴" reconnecting={reconnecting} state="连接中" />
          </View>
          <View style={styles.clue}>
            <Text style={styles.clueKicker}>⚓   第二幕 · 码头</Text>
            <Text style={styles.clueRule}>────    你的线索    ────</Text>
            <Text style={styles.clueText}>Ask Mia where she was at 10 PM.</Text>
            <Text style={styles.clueHint}>请使用英语完成对话</Text>
          </View>
          <View style={styles.signalRow}>
            {["林舟 良好", "Mia 良好", "Alex 良好", "苏晴 较弱"].map((signal) => (
              <View key={signal} style={styles.signal}><Text>▥</Text><Text>{signal}</Text></View>
            ))}
          </View>
        </View>
        <View style={styles.controls} testID="live-controls">
          <Control disabled={realAudioDisabled} label={muted ? "打开麦克风" : "静音"} icon="♩" onPress={toggleMute} />
          <Control disabled={realAudioDisabled} label={speaker ? "扬声器开" : "扬声器关"} icon="◖" onPress={toggleSpeaker} />
          <Control disabled={realMode} label="触发重连" icon="•••" onPress={() => setDemoReconnecting(!demoReconnecting)} testID="reconnect-button" />
          <Control danger disabled={busy} label={busy ? "结束中…" : "结束房间"} icon="⌕" onPress={onEnd} testID="end-room-button" />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Control({ label, icon, danger, onPress, testID, disabled }: { label: string; icon: string; danger?: boolean; onPress: () => void; testID?: string; disabled?: boolean }) { return <Pressable accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.control, disabled && { opacity: 0.45 }]} testID={testID}><View style={[styles.controlCircle, danger && styles.hangup]}><Text style={styles.controlIcon}>{icon}</Text></View><Text style={[styles.controlText, danger && styles.dangerText]}>{label === "触发重连" ? "更多" : label}</Text></Pressable>; }

export function ReportScreen({ error, items, onDone, onRetry, mediaState = demoMediaUiState }: { error?: string; items: ReportItem[]; onDone: () => void; onRetry: (item: ReportItem) => void; mediaState?: MediaUiState }) {
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
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.report}><View style={styles.reportHeader}><Text style={styles.back}>‹</Text><View><Text style={styles.reportTitle}>本局英语报告</Text><Text style={styles.legacyReport}>本局口语报告</Text></View><View /></View><Text style={styles.reportSub}>⌁  雾港疑云 · 25 分钟  ⌁</Text><View style={styles.infoCard}><View style={styles.infoImage}/><View><Text style={styles.infoName}>雾港疑云</Text><Text style={styles.infoMeta}>♧ 4 人房间　◷ 25 分钟　▣ 2025/05/18</Text></View></View>
    {processingLabels.length ? <View style={styles.processingStrip}>{processingLabels.map((label) => <Text key={label} style={styles.processingText}>{label}</Text>)}</View> : null}<View style={styles.scoreCard}><View style={styles.scoreCircle}><Text style={styles.scoreNumber}>{reports.find((item) => item.status === "completed")?.score ?? "—"}</Text></View><View><Text style={styles.scoreFor}>本局口语评分</Text><Text style={styles.excellent}>{showSuccess ? "表现优秀" : "等待全员评分完成"}</Text></View></View><View style={styles.metrics}>{[["发音", reports[0]?.pronunciation], ["流利度", reports[0]?.fluency], ["完整度", reports[0]?.score], ["词汇", reports[0]?.score]].map(([label, score]) => <View key={label} style={styles.metric}><Text>{label}</Text><Text style={styles.metricScore}>{score ?? "—"}</Text><View style={styles.metricBar}/></View>)}</View>{error ? <Text accessibilityLabel="报告错误">{error}</Text> : null}<Text style={styles.resultTitle}>玩家结果</Text>{reports.map((item, index) => <View key={item.scoreJobId} style={styles.reportRow}><View style={styles.resultAvatar}><Text>{index + 1}</Text></View><Text style={styles.resultName}>{friendlyName(item.playerName)}</Text><Text style={[styles.resultState, item.status === "failed" && styles.failed]}>{statusText(item.status)}</Text>{item.status === "failed" ? <Pressable accessibilityLabel="重试评分" onPress={() => onRetry(item)}><Text style={styles.retry}>重新提交</Text></Pressable> : <Text style={styles.resultScore}>{item.status === "completed" ? item.score ?? "—" : "—"}</Text>}</View>)}<Pressable accessibilityLabel="回到大厅" onPress={onDone} style={styles.return}><Text style={styles.returnText}>返回大厅</Text></Pressable></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{backgroundColor:"#FCFAF4",flex:1}, lobby:{flex:1,padding:16}, header:{alignItems:"center",flexDirection:"row",justifyContent:"space-between",paddingTop:6},logo:{alignItems:"center",flexDirection:"row",gap:7},book:{color:"#174B3B",fontSize:24},logoText:{color:"#174638",fontFamily:"serif",fontSize:23,fontWeight:"700"},profile:{alignItems:"center",backgroundColor:"#D4C7B3",borderRadius:19,height:38,justifyContent:"center",width:38},back:{color:"#174638",fontSize:40,lineHeight:40},demoChip:{alignSelf:"flex-start",backgroundColor:"#E8F2EA",borderColor:"#1C593F",borderRadius:8,borderWidth:1,color:"#1C593F",fontSize:11,fontWeight:"800",marginTop:10,paddingHorizontal:10,paddingVertical:6},realChip:{alignSelf:"flex-start",backgroundColor:"#FFF4D9",borderColor:"#9A6A18",borderRadius:8,borderWidth:1,color:"#7A4E00",fontSize:11,fontWeight:"800",marginTop:10,paddingHorizontal:10,paddingVertical:6},lobbyTitle:{color:"#194535",fontFamily:"serif",fontSize:27,fontWeight:"700",lineHeight:34,marginTop:12},lobbyPrompt:{color:"#748278",fontSize:11,marginTop:2},smallRule:{alignItems:"center",flexDirection:"row",gap:6,marginVertical:7,width:100},portCard:{backgroundColor:"#173C3D",borderRadius:20,height:270,overflow:"hidden",position:"relative"},portMist:{backgroundColor:"#496365",height:190,opacity:.5,position:"absolute",right:-70,top:70,transform:[{rotate:"-20deg"}],width:390},portName:{color:"#FFF",fontFamily:"serif",fontSize:24,fontWeight:"700",left:18,position:"absolute",top:20},roomPill:{backgroundColor:"#263D3C",borderRadius:10,color:"#FFF",fontSize:12,padding:9,position:"absolute",right:12,top:19},ship:{bottom:76,left:63,position:"absolute"},mast:{backgroundColor:"#1D2E30",height:104,width:3},hull:{backgroundColor:"#172A2B",height:24,marginLeft:-36,width:105},avatarGroup:{bottom:42,flexDirection:"row",left:18,position:"absolute"},portMeta:{bottom:16,color:"#FFF",fontSize:12,left:18,position:"absolute"},primaryCta:{backgroundColor:"#1A563E",borderRadius:12,marginTop:11,padding:13},ctaText:{color:"#FFF",fontSize:16,fontWeight:"800"},ctaDisabled:{opacity:0.45},outlineCta:{alignItems:"center",borderColor:"#95A498",borderRadius:12,borderWidth:1,flexDirection:"row",justifyContent:"space-between",marginTop:8,padding:12},codeCta:{alignItems:"center",borderColor:"#95A498",borderRadius:12,borderWidth:1,flexDirection:"row",justifyContent:"space-between",marginTop:8,padding:12},codeCtaEmpty:{borderColor:"#C9B8A2"},outlineText:{color:"#1B513D",fontSize:15,fontWeight:"800"},outlineDisabled:{color:"#9EAEA4"},codeInput:{color:"#174638",flex:1,fontSize:14,marginHorizontal:12},joinHint:{color:"#B85036",fontSize:12,fontWeight:"700",marginTop:8},tabs:{borderTopColor:"#E1DED3",borderTopWidth:1,flexDirection:"row",justifyContent:"space-around",paddingBottom:9,paddingTop:7},tab:{color:"#98A298",fontSize:11,textAlign:"center"},tabActive:{color:"#1B573F",fontSize:11,fontWeight:"800",textAlign:"center"},
  waiting:{padding:18,paddingBottom:110},waitTitle:{color:"#194535",fontFamily:"serif",fontSize:35,fontWeight:"700",textAlign:"center"},waitingHint:{color:"#698075",fontSize:12,textAlign:"center"},legacyLabel:{color:"#768B80",fontSize:10,textAlign:"center"},codeBadge:{alignSelf:"center",borderColor:"#CFC4AF",borderRadius:20,borderWidth:1,color:"#4B594F",marginVertical:10,paddingHorizontal:16,paddingVertical:7},banner:{alignItems:"center",backgroundColor:"#123D34",borderRadius:13,flexDirection:"row",height:127,justifyContent:"center",overflow:"hidden"},bannerLight:{color:"#C8B378",fontSize:42,marginRight:20},bannerText:{color:"#FFF2D0",fontFamily:"serif",fontSize:18},count:{color:"#274F40",fontFamily:"serif",fontSize:17,fontWeight:"700",marginVertical:20,textAlign:"center"},seats:{flexDirection:"row",flexWrap:"wrap",gap:12},seat:{alignItems:"center",borderColor:"#D8CFBC",borderRadius:14,borderWidth:1,flexDirection:"row",gap:10,height:132,padding:12,width:"48%"},seatAvatar:{alignItems:"center",borderRadius:34,height:64,justifyContent:"center",width:64},avatarInitial:{color:"#FFF",fontSize:20},seatName:{color:"#204A3B",fontFamily:"serif",fontSize:18,fontWeight:"700"},seatState:{color:"#5E7569",fontSize:12,marginTop:7},ready:{backgroundColor:"#2E7156",borderRadius:12,color:"#FFF",overflow:"hidden",paddingHorizontal:8,paddingVertical:4},mic:{color:"#1C6048",fontSize:18,position:"absolute",right:10},micCheck:{alignItems:"center",backgroundColor:"#F8F3E8",borderColor:"#E9DFCC",borderRadius:12,borderWidth:1,flexDirection:"row",gap:12,marginTop:24,padding:18},realMediaNotice:{backgroundColor:"#FFF7E6",borderColor:"#E5C27A"},realMediaText:{color:"#684300",flex:1,fontSize:13,fontWeight:"700"},micLarge:{color:"#215943",fontSize:28},waitFooter:{backgroundColor:"#FCFAF4",borderTopColor:"#EEE6D5",borderTopWidth:1,bottom:0,flexDirection:"row",gap:12,left:0,padding:14,position:"absolute",right:0},testMic:{alignItems:"center",borderColor:"#1E503D",borderRadius:12,borderWidth:1,flex:1,padding:17},start:{alignItems:"center",backgroundColor:"#1C563E",borderRadius:12,flex:1,padding:17},startDisabled:{backgroundColor:"#9EAEA4"},startText:{color:"#FFF",fontSize:16,fontWeight:"800"},
  liveSafe:{backgroundColor:"#061E1D",flex:1},live:{backgroundColor:"#082524",flex:1,justifyContent:"space-between",paddingHorizontal:14,paddingTop:8,paddingBottom:10},liveBody:{flexShrink:1,minHeight:0},liveDemo:{alignSelf:"flex-start",backgroundColor:"#14352F",borderColor:"#3E9470",borderRadius:8,borderWidth:1,color:"#78E2AE",fontSize:11,fontWeight:"800",marginBottom:6,paddingHorizontal:10,paddingVertical:5},liveReal:{alignSelf:"flex-start",backgroundColor:"#3C2C11",borderColor:"#D6A23A",borderRadius:8,borderWidth:1,color:"#FFE1A1",fontSize:11,fontWeight:"800",marginBottom:6,paddingHorizontal:10,paddingVertical:5},liveTop:{alignItems:"center",flexDirection:"row",justifyContent:"space-between"},liveBack:{borderColor:"#90A7A0",borderRadius:24,borderWidth:1,color:"#FFF",fontSize:28,height:36,textAlign:"center",width:36},liveMore:{borderColor:"#90A7A0",borderRadius:24,borderWidth:1,color:"#FFF",fontSize:28,height:36,textAlign:"center",width:36},liveRoom:{color:"#FFF6DA",fontFamily:"serif",fontSize:17,textAlign:"center"},livePractice:{color:"#DAE8DD",fontSize:10,textAlign:"center"},liveStatus:{color:"#78E2AE",fontSize:12,lineHeight:16,textAlign:"center"},liveStatusSub:{color:"#D8C58F",fontSize:11,lineHeight:15,textAlign:"center"},players:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",marginTop:10},livePlayer:{alignItems:"center",height:118,width:"47%"},liveAvatar:{alignItems:"center",backgroundColor:"#284441",borderColor:"#CFE7DC",borderRadius:40,borderWidth:2,height:72,justifyContent:"center",width:72},speakerAvatar:{borderColor:"#75F6BD",borderWidth:4},reconnectAvatar:{borderColor:"#D9A93F"},liveInitial:{color:"#FFF",fontSize:24},liveName:{color:"#FFF9E8",fontFamily:"serif",fontSize:15,marginTop:3},liveState:{color:"#A9B8B2",fontSize:11},speakingState:{backgroundColor:"#3E9470",borderRadius:12,color:"#FFF",paddingHorizontal:8,paddingVertical:3},reconnectState:{color:"#E8B44B"},clue:{borderColor:"#9A8150",borderWidth:1,marginTop:8,padding:10},clueKicker:{color:"#D6B971",fontFamily:"serif",fontSize:15},clueRule:{color:"#6DD6A1",fontSize:11,marginTop:8,textAlign:"center"},clueText:{color:"#FFF1D2",fontFamily:"serif",fontSize:17,marginTop:8,textAlign:"center"},clueHint:{color:"#B6C5B8",fontSize:12,marginTop:8,textAlign:"center"},signalRow:{flexDirection:"row",gap:6,marginTop:8},signal:{alignItems:"center",backgroundColor:"#173532",borderColor:"#405D55",borderRadius:7,borderWidth:1,flex:1,padding:5},controls:{backgroundColor:"#142D2B",borderRadius:24,flexDirection:"row",justifyContent:"space-around",marginTop:10,paddingBottom:8,paddingTop:10},control:{alignItems:"center",width:70},controlCircle:{alignItems:"center",backgroundColor:"#24413D",borderRadius:26,height:48,justifyContent:"center",width:48},hangup:{backgroundColor:"#C84A45"},controlIcon:{color:"#FFF",fontSize:18},controlText:{color:"#E8E4D8",fontSize:11,lineHeight:14,marginTop:4,textAlign:"center"},dangerText:{color:"#F18A7C"},
  report:{padding:18,paddingBottom:28},reportHeader:{alignItems:"center",flexDirection:"row",justifyContent:"space-between"},reportTitle:{color:"#1B4B3C",fontSize:20,fontWeight:"800"},legacyReport:{color:"#65796D",fontSize:10,textAlign:"center"},reportSub:{color:"#778078",marginVertical:10,textAlign:"center"},infoCard:{alignItems:"center",borderColor:"#DBDDD4",borderRadius:15,borderWidth:1,flexDirection:"row",gap:13,padding:10},infoImage:{backgroundColor:"#244D49",borderRadius:9,height:58,width:64},infoName:{color:"#1B4A3B",fontFamily:"serif",fontSize:18,fontWeight:"700"},infoMeta:{color:"#788078",fontSize:11,marginTop:8},processingStrip:{backgroundColor:"#FFF7E6",borderColor:"#E7C06B",borderRadius:12,borderWidth:1,gap:4,marginTop:12,padding:10},processingText:{color:"#7A4E00",fontSize:12,fontWeight:"800"},scoreCard:{alignItems:"center",backgroundColor:"#FFFEFA",borderColor:"#EFF0E8",borderRadius:16,borderWidth:1,flexDirection:"row",gap:18,marginTop:16,padding:18},scoreCircle:{alignItems:"center",borderColor:"#36966C",borderRadius:62,borderWidth:8,height:124,justifyContent:"center",width:124},scoreNumber:{color:"#1F654B",fontFamily:"serif",fontSize:54},scoreFor:{color:"#1B4638",fontSize:15,fontWeight:"700"},excellent:{color:"#299368",fontFamily:"serif",fontSize:28,marginTop:7},scoreDetails:{color:"#50665A",fontSize:11,marginTop:12},metrics:{backgroundColor:"#FFF",borderColor:"#E7E8DF",borderRadius:15,borderWidth:1,flexDirection:"row",justifyContent:"space-around",marginTop:16,paddingVertical:14},metric:{alignItems:"center",width:"24%"},metricScore:{color:"#176144",fontFamily:"serif",fontSize:24},metricBar:{backgroundColor:"#3DA275",borderRadius:5,height:6,marginTop:7,width:"70%"},tip:{alignItems:"center",backgroundColor:"#F5F9F0",borderColor:"#E2EAD9",borderRadius:13,borderWidth:1,flexDirection:"row",gap:15,marginTop:14,padding:16},tipIcon:{color:"#5AA178",fontSize:32},tipTitle:{color:"#24523E",fontSize:15,fontWeight:"800"},resultTitle:{color:"#28523F",fontSize:16,fontWeight:"800",marginTop:18},reportRow:{alignItems:"center",backgroundColor:"#FFF",borderColor:"#E8E8DF",borderRadius:14,borderWidth:1,flexDirection:"row",gap:10,marginTop:10,padding:11},resultAvatar:{alignItems:"center",backgroundColor:"#305D4B",borderRadius:20,height:40,justifyContent:"center",width:40},resultName:{color:"#1C4335",fontFamily:"serif",fontSize:17,fontWeight:"700",width:50},resultState:{color:"#417D60",flex:1,fontSize:12},failed:{color:"#DA5B3D"},resultScore:{color:"#1D7654",fontFamily:"serif",fontSize:24},retry:{color:"#B85036",fontSize:11},return:{alignItems:"center",backgroundColor:"#195F45",borderRadius:10,marginTop:14,padding:17},returnText:{color:"#FFF",fontSize:18,fontWeight:"800"},
});
