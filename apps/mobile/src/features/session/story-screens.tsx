import { useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
  localVoiceActive?: boolean;
  localVoiceLevel?: number;
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

const WAITING_ROOM_CAPACITY = 6;
const LOBBY_BOTTOM_TAB_CONTENT_PADDING = 80;
const WAITING_FOOTER_CONTENT_PADDING = 110;
const REPORT_CONTENT_BOTTOM_PADDING = 28;
const LIVE_SCROLL_CONTENT_PADDING = 24;
const HARBOR_CARD_ART = require("../../../assets/design/harbor-card-art.png") as number;
const STORY_COVER_ART = require("../../../assets/design/story-cover-art.png") as number;
const AVATAR_ART = [
  require("../../../assets/design/avatar-harbor-woman.png"),
  require("../../../assets/design/avatar-harbor-man.png"),
  require("../../../assets/design/avatar-harbor-curly.png"),
  require("../../../assets/design/avatar-harbor-elder.png"),
  require("../../../assets/design/avatar-harbor-scarf.png"),
] as const;

function memberReadyLabel(ready: boolean) {
  return ready ? "Ready" : "Not ready";
}

function memberSeatTone(index: number) {
  return ["#213C38", "#765B4D", "#584A37", "#3B4C55", "#2F4A44", "#3B4C55"][index % 6];
}

function DesignPortrait({ index, size }: { index: number; size: number }) {
  return (
    <View pointerEvents="none" style={{ borderRadius: size / 2, height: size, overflow: "hidden", width: size }}>
      <Image
        resizeMode="cover"
        source={AVATAR_ART[index % AVATAR_ART.length]}
        style={{ height: size, width: size }}
      />
    </View>
  );
}

function Avatar({ index, size = 50 }: { index: number; size?: number }) {
  return <View style={[styles.avatar, { borderRadius: size / 2, height: size, overflow: "hidden", width: size }]}><Image resizeMode="cover" source={AVATAR_ART[index % AVATAR_ART.length]} style={{ height: size, width: size }} /></View>;
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
            <Text style={styles.seatName}>Waiting to join</Text>
            <Text style={styles.seatState}>No members yet</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.seats}>
      {members.map((member, index) => (
        <View key={member.playerId} style={[styles.seat, fidelityStyles.seat]} testID={`waiting-seat-${index}`}>
          <View style={[styles.seatAvatar, { backgroundColor: memberSeatTone(index) }]}>
            {member.nickname ? <DesignPortrait index={index} size={60} /> : <AppIcon color="#FFF" name="user" size={24} />}
          </View>
          <View style={styles.seatMeta}>
            <Text ellipsizeMode="tail" numberOfLines={1} style={styles.seatName}>{member.nickname}</Text>
            <Text style={[styles.memberRole, member.isLocal ? styles.localRole : styles.guestRole]} testID={`waiting-seat-role-${index}`}>{member.isLocal ? "You" : "Guest"}</Text>
            <Text ellipsizeMode="tail" numberOfLines={1} style={[styles.seatState, member.ready && styles.ready]} testID={`waiting-seat-state-${index}`}>{memberReadyLabel(member.ready)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function DemoWaitingSeats({ localName = "You", ready }: { localName?: string; ready: boolean }) {
  return (
    <View style={styles.seats}>
      <View style={[styles.seat, fidelityStyles.seat]} testID="waiting-seat-0">
        <View style={[styles.seatAvatar, { backgroundColor: "#213C38" }]}>
          <DesignPortrait index={0} size={60} />
        </View>
        <View style={styles.seatMeta}>
          <Text style={styles.seatName}>{localName}</Text>
          <Text ellipsizeMode="tail" numberOfLines={1} style={[styles.seatState, ready && styles.ready]} testID="waiting-seat-state-0">{ready ? "Ready" : "Not ready"}</Text>
        </View>
      </View>
      {Array.from({ length: WAITING_ROOM_CAPACITY - 1 }, (_, index) => index + 1).map((index) => (
        <View key={`empty-seat-${index}`} style={[styles.seat, fidelityStyles.seat]} testID={`waiting-seat-${index}`}>
          <View style={[styles.seatAvatar, { backgroundColor: "#DDD7C7" }]}>
            <AppIcon color="#FFF" name="user" size={24} />
          </View>
          <View style={styles.seatMeta}>
            <Text style={styles.seatName}>Waiting to join</Text>
            <Text ellipsizeMode="tail" numberOfLines={1} style={styles.seatState} testID={`waiting-seat-state-${index}`}>Open seat</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function mediaReady(mediaState: MediaUiState) {
  return mediaState.permission === "granted" && mediaState.grant === "ready" && mediaState.rtc === "joined";
}

function realMediaPermissionStep(permission: MediaUiState["permission"]) {
  if (permission === "granted") return "Microphone: Allowed";
  if (permission === "denied") return "Microphone: Denied";
  if (permission === "requesting") return "Microphone: Requesting…";
  return "Microphone: Pending";
}

function realMediaGrantStep(grant: MediaUiState["grant"]) {
  if (grant === "ready") return "Voice token: Ready";
  if (grant === "loading") return "Voice token: Loading…";
  if (grant === "failed") return "Voice token: Failed";
  return "Voice token: Pending";
}

function realMediaRtcStep(rtc: MediaUiState["rtc"]) {
  if (rtc === "joined") return "TRTC: Joined";
  if (rtc === "joining") return "TRTC: Joining…";
  if (rtc === "joinFailed") return "TRTC: Join failed";
  if (rtc === "reconnecting") return "TRTC: Reconnecting…";
  if (rtc === "disconnected") return "TRTC: Disconnected";
  if (rtc === "kicked") return "TRTC: Removed from room";
  return "TRTC: Waiting for connection";
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

function waitingVoiceMeterBars(mediaState: MediaUiState) {
  if (mediaState.localVoiceActive !== true) return 0;
  const level = Math.max(0, Math.min(100, mediaState.localVoiceLevel ?? 0));
  return Math.max(1, Math.min(5, Math.floor(level / 20)));
}

function WaitingVoiceFeedback({ mediaState }: { mediaState: MediaUiState }) {
  const activeBars = waitingVoiceMeterBars(mediaState);
  const voiceDetected = mediaState.localVoiceActive === true;
  return (
    <View style={styles.waitingVoiceFeedback} testID="waiting-voice-feedback">
      <View style={[styles.waitingVoiceIcon, voiceDetected && styles.waitingVoiceIconActive]}>
        <AppIcon color={voiceDetected ? "#FFF" : "#1C6048"} name="mic" size={22} />
      </View>
      <View style={styles.waitingVoiceCopy}>
        <Text style={styles.waitingVoiceTitle}>{voiceDetected ? "Voice detected" : "Microphone is listening"}</Text>
        <Text style={styles.waitingVoiceDetail}>{voiceDetected ? "TRTC is receiving your voice" : "Speak a sentence to test your input"}</Text>
        <View accessibilityLabel={`${activeBars} of 5 voice levels`} style={styles.waitingVoiceMeter}>
          {Array.from({ length: 5 }, (_, index) => (
            <View
              key={`voice-meter-${index}`}
              style={[styles.waitingVoiceMeterBar, index < activeBars && styles.waitingVoiceMeterBarActive]}
              testID={`waiting-voice-meter-bar-${index}`}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function WaitingMediaNotice({ mediaState }: { mediaState: MediaUiState }) {
  if (mediaState.mode === "demo") {
    return <View style={styles.micCheck}><AppIcon color="#215943" name="mic" size={28} /><Text>Check that your microphone is ready</Text></View>;
  }
  const message =
    mediaState.permission === "denied"
      ? "Microphone permission was denied. Enable it in Settings and try again."
      : mediaState.grant === "failed"
        ? "Could not get a voice token. Check the network or server and try again."
        : mediaState.rtc === "joinFailed"
          ? "Could not join the voice room. Use the button below to try again."
          : mediaState.rtc === "disconnected"
            ? "Voice connection lost. Check your network and try again."
            : mediaState.rtc === "kicked"
              ? "You have left the voice room."
              : mediaReady(mediaState)
              ? undefined
            : mediaState.grant === "loading" || mediaState.rtc === "joining"
              ? "Preparing your voice connection…"
              : "Waiting for microphone access and room connection.";
  return (
    <View style={[styles.micCheck, styles.realMediaNotice, mediaReady(mediaState) && styles.realMediaNoticeReady]}>
      {mediaReady(mediaState) ? <WaitingVoiceFeedback mediaState={mediaState} /> : <AppIcon color="#215943" name="mic" size={28} />}
      <View style={styles.realMediaDetail}>
        {message ? <Text style={styles.realMediaText}>{message}</Text> : null}
        <Text style={styles.realMediaStep}>{realMediaPermissionStep(mediaState.permission)}</Text>
        <Text style={styles.realMediaStep}>{realMediaGrantStep(mediaState.grant)}</Text>
        <Text style={styles.realMediaStep}>{realMediaRtcStep(mediaState.rtc)}</Text>
      </View>
    </View>
  );
}

function LiveMediaStatus({ mediaState, ending = false }: { mediaState: MediaUiState; ending?: boolean }) {
  if (mediaState.mode === "demo") {
    return <View style={styles.liveStatusRow}><AppIcon color="#78E2AE" name="signal" size={15} /><Text style={styles.liveStatus}>Voice in progress{"\n"}18:42</Text></View>;
  }
  const status =
    ending
      ? ["Uploading recording", "Preparing your speaking report"]
      : mediaState.permission === "denied"
      ? ["Microphone permission denied", "Enable it in Settings and try again"]
      : mediaState.grant === "loading"
        ? ["Getting voice token", "Joining the voice room"]
        : mediaState.grant === "failed"
          ? ["Voice token failed", "Try again in a moment"]
          : mediaState.rtc === "joining"
          ? ["Joining the voice room", "Voice starts after you connect"]
          : mediaState.rtc === "reconnecting"
              ? ["Reconnecting", "Others may not hear you for a moment"]
                : mediaState.rtc === "kicked"
                  ? ["You left the voice room", "Return to the room to join again"]
                  : mediaState.rtc === "disconnected"
                    ? ["Voice connection lost", "Check your network and try again"]
                    : mediaState.rtc === "joinFailed"
                      ? ["Could not join the voice room", "Try again in a moment"]
                      : mediaReady(mediaState)
                      ? mediaState.localVoiceActive === true
                        ? ["Your voice is being received", "Voice connected · TRTC microphone activity"]
                        : mediaState.localVoiceActive === false
                          ? ["Listening", "Voice connected · Speak when you are ready"]
                          : ["Voice in progress", mediaState.network === "weak" ? "Weak network. Move closer to Wi-Fi" : mediaState.network === "bad" ? "Very weak network. Voice may drop" : "18:42"]
                      : ["Waiting to join the voice room", "Voice starts after you connect"];
  return <View><Text style={styles.liveStatus}>{status[0]}</Text><Text style={styles.liveStatusSub}>{status[1]}</Text></View>;
}

function roomProcessingLabels(mediaState: MediaUiState) {
  if (mediaState.mode === "demo") return [];
  const labels: string[] = [];
  if (mediaState.recording === "processing") labels.push("Uploading recording");
  if (mediaState.recording === "failed") labels.push("Recording upload failed");
  if (mediaState.report === "waiting") labels.push("Waiting for report");
  if (mediaState.report === "processing") labels.push("Generating report");
  if (mediaState.report === "failed") labels.push("Report generation failed");
  return labels;
}

export function ReportLoadingScreen({ onDone }: { onDone: () => void }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.reportLoading, fidelityStyles.report]} testID="report-loading-screen">
        <View style={styles.reportHeader}>
          <Pressable accessibilityLabel="Back from report loading" onPress={onDone} style={fidelityStyles.reportHeaderBack} testID="report-loading-back">
            <AppIcon color="#174638" name="arrow-left" size={24} />
          </Pressable>
          <Text style={styles.reportTitle}>Speaking report</Text>
          <View style={styles.reportLoadingHeaderSpacer} />
        </View>
        <View style={styles.reportLoadingBody}>
          <View style={styles.reportLoadingIcon}>
            <AppIcon color="#2A8B67" name="sparkles" size={30} />
          </View>
          <Text style={styles.reportLoadingTitle}>Generating your speaking report</Text>
          <Text style={styles.reportLoadingBodyText}>We&apos;re analyzing your voice and preparing your feedback.</Text>
          <ActivityIndicator color="#2A8B67" size="large" />
          <Text style={styles.reportLoadingHint}>Your score will appear here when analysis is complete</Text>
        </View>
        <Pressable accessibilityLabel="Back to lobby" onPress={onDone} style={styles.return}>
          <View style={styles.inlineButtonContent}>
            <AppIcon color="#FFF" name="house" size={19} />
            <Text style={styles.returnText}>Back to lobby</Text>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Header({ title, back }: { title: string; back?: () => void }) {
  return <View style={[styles.header, fidelityStyles.header]}>{back ? <Pressable accessibilityLabel="Leave room" onPress={back} style={fidelityStyles.headerBack}><AppIcon color="#174638" name="arrow-left" size={26} /></Pressable> : <View accessibilityLabel="English Room" style={styles.logo}><AppIcon color="#174B3B" name="book-open" size={28} /><Text style={styles.logoText}>English Room</Text></View>}{title ? <Text style={fidelityStyles.headerTitle} adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} testID="waiting-title">{title}</Text> : null}<View style={styles.profile}><DesignPortrait index={1} size={38} /></View></View>;
}

function BottomTabs() { return <View style={styles.tabs} testID="lobby-bottom-tabs"><View style={styles.tabItem}><AppIcon color="#1B573F" name="house" size={19} /><Text style={styles.tabActive}>Home</Text></View><View style={styles.tabItem}><AppIcon color="#98A298" name="door-open" size={19} /><Text style={styles.tab}>Rooms</Text></View><View style={styles.tabItem}><AppIcon color="#98A298" name="user" size={19} /><Text style={styles.tab}>Profile</Text></View></View>; }

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
  const insets = useSafeAreaInsets();
  const trimmed = code.trim();
  const canJoin = trimmed.length > 0 && !busy;
  const submitJoin = () => {
    if (!trimmed) {
      setJoinHint("Enter a room code before joining");
      return;
    }
    if (busy) return;
    setJoinHint(undefined);
    onJoin(trimmed);
  };
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={[styles.lobby, fidelityStyles.lobby, { paddingBottom: LOBBY_BOTTOM_TAB_CONTENT_PADDING + insets.bottom }]} showsVerticalScrollIndicator={false} style={styles.lobbyScroll} testID="lobby-scroll"><Header title="" /><Text style={[styles.lobbyTitle, fidelityStyles.lobbyTitle]}>Step into tonight&apos;s story in English</Text><Text style={styles.lobbyPrompt}>What would you like to practice tonight?</Text><View style={styles.smallRule}><View /><AppIcon color="#174638" name="sparkles" size={15} /><View /></View>
    <View style={[styles.portCard, fidelityStyles.portCard]} testID="lobby-story-card"><Image resizeMode="cover" source={HARBOR_CARD_ART} style={styles.portArt} /><View style={styles.portMist} /><View pointerEvents="none" style={styles.portFooterShade} /><View style={styles.portName}><AppIcon color="#FFF" name="anchor" size={18} /><Text style={styles.portNameText}>Harbor Mystery</Text></View><Text style={styles.roomPill}>ROOM LIVE</Text>
    {mediaState.mode === "demo" ? (
      <>
        <View style={styles.avatarGroup}><Avatar index={0} /><View style={styles.openSeatsPill}><AppIcon color="#E4F3E7" name="users" size={14} /><Text style={styles.openSeatsText}>5 open seats</Text></View></View>
        <View style={styles.portMeta}><AppIcon color="#FFF" name="users" size={15} /><Text style={styles.portMetaText}>1 player</Text><Text style={styles.portMetaSeparator}>|</Text><AppIcon color="#FFF" name="clock" size={15} /><Text style={styles.portMetaText}>About 25 minutes</Text></View>
      </>
    ) : (
      <View style={styles.portMeta}><AppIcon color="#FFF" name="users" size={15} /><Text style={styles.portMetaText}>Live room · members sync after you join</Text></View>
    )}
    </View>
    <Pressable accessibilityLabel="Join voice room" disabled={!canJoin} onPress={submitJoin} style={[styles.primaryCta, fidelityStyles.primaryCta, busy && styles.ctaDisabled]} testID="join-room-button"><View style={styles.ctaContent}>{busy ? <Text style={styles.ctaText}>Joining…</Text> : <><AppIcon color="#FFF" name="mic" size={22} /><Text style={styles.ctaText}>Join voice room</Text><AppIcon color="#FFF" name="chevron-right" size={22} /></>}</View></Pressable>
    <Pressable accessibilityLabel="Create new room" disabled={busy} onPress={onCreate} style={[styles.outlineCta, fidelityStyles.outlineCta, busy && styles.ctaDisabled]} testID="create-room-button"><View style={styles.ctaContent}>{busy ? <Text style={styles.outlineText}>Creating…</Text> : <><AppIcon color="#1B513D" name="house" size={22} /><Text style={styles.outlineText}>Create new room</Text><AppIcon color="#1B513D" name="chevron-right" size={22} /></>}</View></Pressable>
    <View style={[styles.codeCta, fidelityStyles.codeCta, !trimmed && styles.codeCtaEmpty]}><AppIcon color="#1B513D" name="grid" size={22} /><TextInput accessibilityLabel="Room code" autoCapitalize="characters" editable={!busy} onChangeText={(value) => { setCode(value); if (value.trim()) setJoinHint(undefined); }} placeholder="Enter room code" placeholderTextColor="#63756B" style={styles.codeInput} testID="room-code-input" value={code}/><Pressable accessibilityLabel="Enter room code" disabled={!canJoin} onPress={submitJoin} testID="submit-room-code-button"><AppIcon color={canJoin ? "#1B513D" : "#9EAEA4"} name="chevron-right" size={22} /></Pressable></View>
    {joinHint ? <Text accessibilityLabel="Join hint" style={styles.joinHint}>{joinHint}</Text> : null}
    {!trimmed ? <Text accessibilityLabel="Empty room code hint" style={[styles.joinHint, fidelityStyles.hiddenHint]}>Enter a room code to join</Text> : null}
  </ScrollView><BottomTabs /></SafeAreaView>;
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
  isOwner = true,
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
  isOwner?: boolean;
}) {
  const canStart = isOwner && ready && !busy && (mediaState.mode === "demo" || mediaReady(mediaState));
  const realMode = mediaState.mode === "real";
  const webControlMode = Platform.OS === "web";
  const authoritativeMembers = realMode || webControlMode;
  const memberCount = authoritativeMembers ? members.length : 1;
  const showMediaRetry = realMode && realMediaRecoverable(mediaState) && Boolean(onReconnectMedia);
  const insets = useSafeAreaInsets();
  const waitingScrollStyle = [styles.waiting, { paddingBottom: WAITING_FOOTER_CONTENT_PADDING + insets.bottom }];
  const waitingFooterStyle = [styles.waitFooter, { bottom: insets.bottom }];
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={[waitingScrollStyle, fidelityStyles.waiting]} testID="waiting-scroll"><Header back={onLeave} title="Harbor Mystery"/><View style={styles.waitRule}><View style={styles.waitRuleLine} /><AppIcon color="#6D5A3A" name="sparkles" size={15} /><View style={styles.waitRuleLine} /></View><Text accessibilityLabel="Waiting for everyone to take a seat" style={[styles.waitingHint, fidelityStyles.hiddenHint]}>Waiting for everyone to take a seat</Text><View style={styles.codeRow}><Text style={styles.codeBadge} accessibilityLabel={`Room code ${roomCode ?? "not assigned"}`}>Room {roomCode ?? "—"}</Text><View accessible={false} style={styles.shareBadge}><AppIcon color="#1C4C3B" name="share" size={18} /></View></View><View style={[styles.banner, fidelityStyles.banner]} testID="waiting-story-banner"><Image resizeMode="cover" source={HARBOR_CARD_ART} style={[styles.bannerArt, fidelityStyles.bannerArt]} /><View style={[styles.bannerOverlay, { backgroundColor: "rgba(8, 43, 37, .72)" }]} /><AppIcon color="#C8B378" name="anchor" size={30} /><Text ellipsizeMode="tail" numberOfLines={2} style={styles.bannerText} testID="waiting-banner-text">The prologue begins when everyone is ready</Text></View><Text style={[styles.count, fidelityStyles.count]}>────  Players {memberCount} / {WAITING_ROOM_CAPACITY}  ────</Text>{authoritativeMembers ? <RealWaitingSeats members={members} /> : <DemoWaitingSeats ready={ready} />}<WaitingMediaNotice mediaState={mediaState} />{showMediaRetry ? <Pressable accessibilityLabel="Retry voice connection" disabled={busy} onPress={() => onReconnectMedia?.()} style={[styles.mediaRetry, busy && styles.ctaDisabled]} testID="waiting-reconnect-media-button"><View style={styles.inlineButtonContent}><AppIcon color="#7A4E00" name="refresh" size={18} /><Text style={styles.mediaRetryText}>Retry voice connection</Text></View></Pressable> : null}</ScrollView><View style={[waitingFooterStyle, fidelityStyles.waitFooter]} testID="waiting-footer"><Pressable accessibilityLabel="Ready" disabled={busy} onPress={onReady} style={[styles.testMic, busy && styles.ctaDisabled]} testID="ready-button"><View style={styles.inlineButtonContent}>{busy ? <Text>Submitting…</Text> : ready ? <><AppIcon color="#1E503D" name="check" size={18} /><Text>Ready</Text></> : <><AppIcon color="#1E503D" name="mic" size={18} /><Text>Ready</Text></>}</View></Pressable><Pressable accessibilityLabel="Start room" disabled={!canStart} onPress={onStart} style={[styles.start, !canStart && styles.startDisabled]} testID="start-room-button"><View style={styles.inlineButtonContent}>{busy ? <Text style={styles.startText}>Starting…</Text> : <><AppIcon color="#FFF" name="book-open" size={18} /><Text style={styles.startText}>Start story</Text></>}</View></Pressable></View></SafeAreaView>;
}

function Player({ index, name, role, state, speaker, reconnecting, single }: { index: number; name: string; role: string; state: string; speaker?: boolean; reconnecting?: boolean; single?: boolean }) {
  return <View style={[styles.livePlayer, fidelityStyles.livePlayer, single && fidelityStyles.livePlayerSingle]}><View style={[styles.liveAvatar, fidelityStyles.liveAvatar, single && fidelityStyles.liveAvatarSingle, speaker && styles.speakerAvatar, reconnecting && styles.reconnectAvatar]} testID={`live-player-avatar-${index}`}><DesignPortrait index={index} size={single ? 112 : 80} /></View><Text ellipsizeMode="tail" numberOfLines={1} style={styles.liveName}>{name}</Text><Text style={styles.liveRole} testID={`live-player-role-${index}`}>{role}</Text><Text style={[styles.liveState, speaker && styles.speakingState, reconnecting && styles.reconnectState]}>{reconnecting ? "Reconnecting" : state}</Text></View>;
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
  localName = "Me",
  canEnd = true,
  members = [],
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
  canEnd?: boolean;
  members?: RoomMemberView[];
}) {
  const [mutedLocal, setMutedLocal] = useState(false);
  const [speakerLocal, setSpeakerLocal] = useState(true);
  const realMode = mediaState.mode === "real";
  const webControlMode = Platform.OS === "web";
  const muted = realMode ? Boolean(mutedProp) : mutedLocal;
  const speaker = realMode ? speakerProp !== false : speakerLocal;
  const realAudioDisabled = realMode && !mediaReady(mediaState);
  const realMembers = members.length > 0 ? members : [{ playerId: "local", nickname: localName || "You", isLocal: true, ready: true }];
  const playerCount = webControlMode ? members.length : realMode ? Math.max(realMembers.length, 1) : 1;
  const rtcNeedsReconnect =
    realMode && !busy && (mediaState.rtc === "disconnected" || mediaState.rtc === "joinFailed" || mediaState.rtc === "kicked");
  const reconnectLabel = mediaState.rtc === "disconnected" ? "Reconnect" : "Rejoin room";
  const networkLabel =
    mediaState.network === "weak" ? "Weak" : mediaState.network === "bad" ? "Poor" : "Good";
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
  const liveRootStyle = [styles.live, fidelityStyles.live, { paddingBottom: 10 + insets.bottom }];
  return (
    <SafeAreaView style={styles.liveSafe}>
      <View style={liveRootStyle} testID="live-screen-root">
        <Image resizeMode="cover" source={STORY_COVER_ART} style={[styles.liveBackground, fidelityStyles.liveBackground]} />
        <View pointerEvents="none" style={[styles.liveTint, { backgroundColor: "rgba(4, 29, 27, .72)" }]} />
        <View style={styles.liveTop}>
          <Pressable accessibilityLabel="Leave room" disabled={!canEnd || busy} onPress={onEnd} style={[styles.liveHeaderButton, (!canEnd || busy) && styles.ctaDisabled]}><AppIcon color="#FFF" name="arrow-left" size={21} /></Pressable>
          <View>
            <Text style={styles.liveRoom}>Harbor Mystery</Text>
            <Text style={styles.livePractice}>In progress</Text>
            <LiveMediaStatus ending={busy} mediaState={mediaState} />
          </View>
          <View style={styles.liveHeaderSpacer} />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: LIVE_SCROLL_CONTENT_PADDING }} showsVerticalScrollIndicator={false} style={[styles.liveBody, fidelityStyles.liveBody]} testID="live-scroll">
          <View style={[styles.players, playerCount === 1 && styles.playersSingle]}>
            {webControlMode ? (
              members.map((member, index) => (
                <Player
                  index={index}
                  key={member.playerId}
                  name={member.nickname}
                  role={member.isLocal ? "You" : "Guest"}
                  state={member.ready ? "Ready" : "Not ready"}
                  single={playerCount === 1}
                />
              ))
            ) : realMode ? (
              <>
                <Player index={0} name={realMembers.find((member) => member.isLocal)?.nickname ?? (localName || "You")} role="You" state={muted ? "Muted" : "Online"} single={playerCount === 1} />
                {remotes.map((remote, index) => (
                  <Player
                    index={index + 1}
                    key={remote.userId}
                    name={realMembers.find((member) => member.playerId === remote.userId)?.nickname ?? "Guest"}
                    role="Guest"
                    speaker={remote.speaking}
                    state={remote.speaking ? "Speaking" : remote.audioAvailable ? "Online" : "Muted"}
                    single={false}
                  />
                ))}
              </>
            ) : <Player index={0} name={localName} role="You" state={muted ? "Muted" : "Online"} single />}
          </View>
          <View style={[styles.clue, fidelityStyles.clue]}>
            <View style={styles.clueKicker}><AppIcon color="#D6B971" name="anchor" size={16} /><Text style={styles.clueKickerText}>Act II · The Pier</Text></View>
            <Text style={styles.clueRule}>────    Your clue    ────</Text>
            <Text style={styles.clueText}>Describe where the ship was at 10 PM.</Text>
            <Text style={styles.clueHint}>Complete the conversation in English</Text>
          </View>
          <View style={styles.signalRow}>
            {realMode ? (
              <View style={styles.signal}><AppIcon color="#78E2AE" name="signal" size={14} /><Text ellipsizeMode="tail" numberOfLines={1} style={styles.signalText} testID="live-signal-0">This device · {networkLabel}</Text></View>
            ) : <View style={styles.signal}><AppIcon color="#78E2AE" name="signal" size={14} /><Text ellipsizeMode="tail" numberOfLines={1} style={styles.signalText} testID="live-signal-0">This device · Good</Text></View>}
          </View>
          {realMode && rtcNeedsReconnect ? <Pressable accessibilityLabel={reconnectLabel} disabled={busy || !onReconnectMedia} onPress={() => onReconnectMedia?.()} style={styles.reconnectAction}><View style={styles.inlineButtonContent}><AppIcon color="#E8B44B" name="refresh" size={16} /><Text style={styles.reconnectActionText}>{reconnectLabel}</Text></View></Pressable> : null}
        </ScrollView>
        <View style={[styles.controls, fidelityStyles.controls]} testID="live-controls">
          <Control disabled={realAudioDisabled} label={muted ? "Unmute" : "Mute"} icon={muted ? "mic-off" : "mic"} onPress={toggleMute} />
          <Control disabled={realAudioDisabled} label={speaker ? "Speaker on" : "Speaker off"} icon={speaker ? "volume" : "volume-off"} onPress={toggleSpeaker} />
          <Control danger disabled={busy || !canEnd} label={busy ? "Ending…" : "End room"} icon="phone-off" onPress={onEnd} testID="end-room-button" />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Control({ label, icon, danger, onPress, testID, disabled }: { label: string; icon: AppIconName; danger?: boolean; onPress: () => void; testID?: string; disabled?: boolean }) { return <Pressable accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.control, disabled && { opacity: 0.45 }]} testID={testID}><View style={[styles.controlCircle, danger && styles.hangup]}><AppIcon color="#FFF" name={icon} size={19} /></View><Text style={[styles.controlText, danger && styles.dangerText]}>{label}</Text></Pressable>; }

const SCORE_RATIO_MAX = 1;
const SCORE_PERCENT_MULTIPLIER = 100;

function formatReportScore(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return "—";
  // Tencent SOE reports fluency as a 0–1 ratio while other score fields use 0–100.
  const displayScore = score > 0 && score <= SCORE_RATIO_MAX ? score * SCORE_PERCENT_MULTIPLIER : score;
  return String(Math.round(displayScore));
}

export function ReportScreen({ error, items, onDone, onRefresh, onRetry, mediaState = demoMediaUiState }: { error?: string; items: ReportItem[]; onDone: () => void; onRefresh?: () => void; onRetry: (item: ReportItem) => void; mediaState?: MediaUiState }) {
  const insets = useSafeAreaInsets();
  const reports = items;
  const friendlyName = (id: string) => ({ demo_mia: "Mia", demo_alex: "Alex", demo_suqing: "Suki" }[id] ?? (id.startsWith("player_") || id.includes("uuid") ? "Liam" : id));
  const statusText = (status: ReportItem["status"]) => mediaState.mode === "real" ? ({ completed: "Scoring complete", processing: "Scoring in progress", waiting: "Waiting for audio", failed: "Scoring failed" }[status]) : ({ completed: "Scoring complete", processing: "Processing · about 20 sec", waiting: "Waiting for score", failed: "Scoring failed" }[status]);
  const allCompleted =
    mediaState.recording === "ready" &&
    mediaState.report === "ready" &&
    reports.length > 0 &&
    reports.every((item) => item.status === "completed");
  const showSuccess = mediaState.mode === "demo" || (allCompleted && mediaState.recording !== "failed");
  const processingLabels = [
    ...roomProcessingLabels(mediaState),
    ...reports.filter((item) => item.recognizedText?.trim()).map((item) => `Recognized text: ${item.recognizedText}`),
  ];
  const reportMetrics: [string, number | undefined][] = [["Pronunciation", reports[0]?.pronunciation], ["Fluency", reports[0]?.fluency], ["Completeness", undefined], ["Vocabulary", undefined]];
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={[styles.report, fidelityStyles.report, { paddingBottom: REPORT_CONTENT_BOTTOM_PADDING + insets.bottom }]} testID="report-scroll"><View style={styles.reportHeader}><Pressable accessibilityLabel="Back from report" onPress={onDone} style={fidelityStyles.reportHeaderBack} testID="report-header-back"><AppIcon color="#174638" name="arrow-left" size={24} /></Pressable><View><Text style={styles.reportTitle}>Speaking report</Text></View><View /></View><View style={styles.reportSub}><AppIcon color="#778078" name="sparkles" size={15} /><Text style={styles.reportSubText}>Harbor Mystery · 25 min</Text><AppIcon color="#778078" name="sparkles" size={15} /></View><View style={styles.infoCard}><View style={styles.infoImage}><Image resizeMode="cover" source={HARBOR_CARD_ART} style={styles.infoImageArt} testID="report-story-thumbnail" /></View><View><Text style={styles.infoName}>Harbor Mystery</Text><View style={styles.infoMeta}><AppIcon color="#788078" name="users" size={13} /><Text style={styles.infoMetaText}>Multiplayer room</Text><AppIcon color="#788078" name="clock" size={13} /><Text style={styles.infoMetaText}>25 min</Text><AppIcon color="#788078" name="calendar" size={13} /><Text style={styles.infoMetaText}>May 18, 2025</Text></View></View></View>
    {processingLabels.length ? <View style={styles.processingStrip}>{processingLabels.map((label) => <Text key={label} style={styles.processingText}>{label}</Text>)}</View> : null}<View style={[styles.scoreCard, fidelityStyles.scoreCard]} testID="report-score-card"><View style={styles.scoreCircle}><Text adjustsFontSizeToFit numberOfLines={1} style={styles.scoreNumber} testID="report-score-number">{formatReportScore(reports.find((item) => item.status === "completed")?.score)}</Text></View><View style={styles.scoreSummary}><Text style={styles.scoreFor}>Session score</Text><Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={2} style={styles.excellent}>{showSuccess ? "Great performance" : "Waiting for all scores"}</Text><Text style={styles.scoreDetails}>A combined assessment of speaking and English expression</Text></View></View><View style={styles.metrics}>{reportMetrics.map(([label, score]) => <View key={label} style={styles.metric}><Text numberOfLines={1} style={styles.metricLabel}>{label}</Text><Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricScore} testID={`report-metric-${label}`}>{formatReportScore(score)}</Text><View style={[styles.metricBar, score == null && styles.metricBarMissing]}/></View>)}</View><View style={styles.tip}><AppIcon color="#5AA178" name="lightbulb" size={28} /><View style={styles.tipContent} testID="report-tip-content"><Text style={styles.tipTitle}>Suggestions</Text><Text style={styles.tipBody}>Reduce long pauses to make your clues flow more naturally.</Text></View></View>{error ? <><Text accessibilityLabel="Report error">{error}</Text>{onRefresh ? <Pressable accessibilityLabel="Refresh report" onPress={onRefresh} style={styles.reportRefresh}><View style={styles.inlineButtonContent}><AppIcon color="#B85036" name="refresh" size={17} /><Text style={styles.reportRefreshText}>Refresh report</Text></View></Pressable> : null}</> : null}<Text style={styles.resultTitle}>Player results</Text>{reports.map((item, index) => <View key={item.scoreJobId} style={styles.reportRow}><View style={styles.resultAvatar}><Text>{index + 1}</Text></View><Text numberOfLines={1} style={styles.resultName}>{friendlyName(item.playerName)}</Text><View style={styles.resultState}><Text numberOfLines={1} style={[styles.resultStateText, item.status === "failed" && styles.failed]}>{statusText(item.status)}</Text>{item.failureReason ? <Text numberOfLines={2} style={styles.failureReason}>{item.failureReason}</Text> : null}</View>{item.status === "failed" ? <Pressable accessibilityLabel="Retry scoring" onPress={() => onRetry(item)}><View style={styles.inlineButtonContent}><AppIcon color="#B85036" name="refresh" size={15} /><Text style={styles.retry}>Submit again</Text></View></Pressable> : <Text adjustsFontSizeToFit numberOfLines={1} style={styles.resultScore} testID={`report-result-score-${item.scoreJobId}`}>{formatReportScore(item.status === "completed" ? item.score : null)}</Text>}</View>)}<Pressable accessibilityLabel="Back to lobby" onPress={onDone} style={styles.return}><View style={styles.inlineButtonContent}><AppIcon color="#FFF" name="house" size={19} /><Text style={styles.returnText}>Back to lobby</Text></View></Pressable></ScrollView></SafeAreaView>;
}

const fidelityStyles = StyleSheet.create({
  banner: {
    height: 105,
  },
  bannerArt: {
    bottom: 0,
    height: 105,
    right: 0,
  },
  clue: {
    justifyContent: "center",
    minHeight: 180,
    padding: 18,
  },
  codeCta: {
    height: 52,
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 0,
  },
  controls: {
    alignItems: "center",
    borderColor: "rgba(205, 183, 130, 0.22)",
    borderWidth: 1,
    minHeight: 112,
    paddingBottom: 12,
    paddingTop: 14,
  },
  count: {
    marginVertical: 14,
  },
  header: {
    minHeight: 42,
    position: "relative",
  },
  headerBack: {
    alignItems: "center",
    borderColor: "#D2C5AA",
    borderRadius: 22,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  headerTitle: {
    color: "#194535",
    fontFamily: "serif",
    fontSize: 30,
    fontWeight: "700",
    left: 52,
    lineHeight: 36,
    position: "absolute",
    right: 52,
    textAlign: "center",
    top: 2,
  },
  hiddenHint: {
    height: 1,
    marginTop: 0,
    opacity: 0,
  },
  live: {
    justifyContent: "flex-start",
    paddingTop: Platform.OS === "web" ? 28 : 8,
  },
  liveAvatar: {
    borderRadius: 44,
    height: 88,
    width: 88,
  },
  liveBackground: {
    opacity: 0.24,
  },
  liveBody: {
    flex: 1,
    marginTop: 28,
  },
  livePlayer: {
    height: 142,
  },
  livePlayerSingle: {
    width: "100%",
  },
  liveAvatarSingle: {
    height: 112,
    width: 112,
  },
  lobby: {
    paddingTop: Platform.OS === "web" ? 44 : 16,
  },
  lobbyTitle: {
    marginTop: 29,
  },
  outlineCta: {
    height: 52,
    justifyContent: "center",
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 0,
  },
  portCard: {
    height: 316,
  },
  primaryCta: {
    height: 56,
    justifyContent: "center",
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 0,
  },
  report: {
    paddingTop: Platform.OS === "web" ? 30 : 18,
  },
  reportHeaderBack: {
    alignItems: "center",
    borderColor: "#D2C5AA",
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  scoreCard: {
    minHeight: 156,
  },
  seat: {
    height: 110,
    padding: 10,
  },
  waiting: {
    paddingTop: Platform.OS === "web" ? 40 : 18,
  },
  waitFooter: {
    minHeight: 84,
  },
});

const styles = StyleSheet.create({
  memberRole: { fontSize: 10, fontWeight: "800", marginTop: 2 },
  localRole: { color: "#2E7156" },
  guestRole: { color: "#927255" },
  liveRole: { color: "#B8D2C3", fontSize: 10, fontWeight: "800" },
  safe:{backgroundColor:"#FCFAF4",flex:1}, lobby:{padding:16}, lobbyScroll:{flex:1}, header:{alignItems:"center",flexDirection:"row",justifyContent:"space-between",paddingTop:6},logo:{alignItems:"center",flexDirection:"row",gap:7},book:{color:"#174B3B",fontSize:24},logoText:{color:"#174638",fontFamily:"serif",fontSize:23,fontWeight:"700"},profile:{alignItems:"center",backgroundColor:"#D4C7B3",borderRadius:19,height:38,justifyContent:"center",width:38},back:{color:"#174638",fontSize:40,lineHeight:40},demoChip:{alignSelf:"flex-start",backgroundColor:"#E8F2EA",borderColor:"#1C593F",borderRadius:8,borderWidth:1,color:"#1C593F",fontSize:11,fontWeight:"800",marginTop:10,paddingHorizontal:10,paddingVertical:6},realChip:{alignSelf:"flex-start",backgroundColor:"#FFF4D9",borderColor:"#9A6A18",borderRadius:8,borderWidth:1,color:"#7A4E00",fontSize:11,fontWeight:"800",marginTop:10,paddingHorizontal:10,paddingVertical:6},lobbyTitle:{color:"#194535",fontFamily:"serif",fontSize:27,fontWeight:"700",lineHeight:34,marginTop:12},lobbyPrompt:{color:"#748278",fontSize:11,marginTop:2},smallRule:{alignItems:"center",flexDirection:"row",gap:6,marginVertical:7,width:100},portCard:{backgroundColor:"#173C3D",borderRadius:20,height:270,overflow:"hidden",position:"relative"},portArt:{height:"100%",left:0,opacity:.82,position:"absolute",top:0,width:"100%"},portMist:{backgroundColor:"#496365",height:190,opacity:.25,position:"absolute",right:-70,top:70,transform:[{rotate:"-20deg"}],width:390},portFooterShade:{backgroundColor:"rgba(12, 37, 36, .74)",bottom:0,height:92,left:0,position:"absolute",right:0},portName:{alignItems:"center",flexDirection:"row",gap:7,left:18,position:"absolute",top:20},portNameText:{color:"#FFF",fontFamily:"serif",fontSize:24,fontWeight:"700"},roomPill:{backgroundColor:"#263D3C",borderRadius:10,color:"#FFF",fontSize:12,padding:9,position:"absolute",right:12,top:19},avatarGroup:{bottom:38,flexDirection:"row",gap:6,left:18,position:"absolute"},avatar:{alignItems:"center",borderColor:"#FFF",borderWidth:2,justifyContent:"center"},avatarText:{color:"#FFF",fontWeight:"800"},openSeatsPill:{alignItems:"center",backgroundColor:"rgba(34, 73, 67, .86)",borderColor:"#A8C8B3",borderRadius:16,borderWidth:1,flexDirection:"row",gap:5,height:34,paddingHorizontal:10},openSeatsText:{color:"#E4F3E7",fontSize:12,fontWeight:"800"},moreAvatar:{alignItems:"center",backgroundColor:"#365951",borderColor:"#B6C8B9",borderRadius:25,borderWidth:1,height:50,justifyContent:"center",width:50},portMeta:{alignItems:"center",bottom:16,flexDirection:"row",gap:6,left:18,position:"absolute"},portMetaText:{color:"#FFF",fontSize:12},portMetaSeparator:{color:"#C6D8CD",fontSize:12,marginHorizontal:2},primaryCta:{backgroundColor:"#1A563E",borderRadius:12,marginTop:11,padding:13},ctaContent:{alignItems:"center",flexDirection:"row",gap:9,justifyContent:"space-between"},ctaText:{color:"#FFF",flex:1,fontSize:16,fontWeight:"800"},ctaDisabled:{opacity:0.45},outlineCta:{borderColor:"#95A498",borderRadius:12,borderWidth:1,marginTop:8,padding:12},codeCta:{alignItems:"center",borderColor:"#95A498",borderRadius:12,borderWidth:1,flexDirection:"row",justifyContent:"space-between",marginTop:8,padding:12},codeCtaEmpty:{borderColor:"#C9B8A2"},outlineText:{color:"#1B513D",fontSize:15,fontWeight:"800"},outlineDisabled:{color:"#9EAEA4"},codeInput:{color:"#174638",flex:1,fontSize:14,marginHorizontal:12},joinHint:{color:"#B85036",fontSize:12,fontWeight:"700",marginTop:8},tabs:{borderTopColor:"#E1DED3",borderTopWidth:1,flexDirection:"row",justifyContent:"space-around",paddingBottom:9,paddingTop:7},tabItem:{alignItems:"center",gap:3},tab:{color:"#98A298",fontSize:11,textAlign:"center"},tabActive:{color:"#1B573F",fontSize:11,fontWeight:"800",textAlign:"center"},
  waiting:{padding:18,paddingBottom:110},waitTitle:{color:"#194535",fontFamily:"serif",fontSize:35,fontWeight:"700",textAlign:"center"},waitRule:{alignItems:"center",flexDirection:"row",gap:10,justifyContent:"center",marginTop:4},waitRuleLine:{backgroundColor:"#CFC4AF",height:1,width:80},waitingHint:{color:"#698075",fontSize:12,textAlign:"center"},legacyLabel:{color:"#768B80",fontSize:10,textAlign:"center"},codeRow:{alignItems:"center",flexDirection:"row",gap:10,justifyContent:"center",marginVertical:10},codeBadge:{borderColor:"#CFC4AF",borderRadius:20,borderWidth:1,color:"#4B594F",paddingHorizontal:18,paddingVertical:7},shareBadge:{alignItems:"center",borderColor:"#CFC4AF",borderRadius:18,borderWidth:1,height:38,justifyContent:"center",width:42},banner:{alignItems:"center",backgroundColor:"#123D34",borderColor:"#D0BE91",borderRadius:13,borderWidth:1,flexDirection:"row",gap:16,height:127,justifyContent:"center",overflow:"hidden"},bannerArt:{left:0,opacity:.74,position:"absolute",top:0,width:"100%"},bannerOverlay:{backgroundColor:"rgba(8, 43, 37, .74)",bottom:0,left:0,position:"absolute",right:0,top:0},bannerLight:{color:"#C8B378",fontSize:42,marginRight:20},bannerText:{color:"#FFF2D0",flex:1,flexShrink:1,fontFamily:"serif",fontSize:16,lineHeight:22,minWidth:0,textAlign:"center"},count:{color:"#274F40",fontFamily:"serif",fontSize:17,fontWeight:"700",marginVertical:20,textAlign:"center"},seats:{flexDirection:"row",flexWrap:"wrap",gap:12},seat:{alignItems:"center",borderColor:"#D8CFBC",borderRadius:14,borderWidth:1,flexDirection:"row",gap:10,height:132,padding:12,width:"48%"},seatAvatarWrap:{height:64,position:"relative",width:64},seatAvatar:{alignItems:"center",borderRadius:34,height:64,justifyContent:"center",width:64},seatMeta:{flex:1,minWidth:0},avatarInitial:{color:"#FFF",fontSize:20},seatName:{color:"#204A3B",fontFamily:"serif",fontSize:18,fontWeight:"700"},seatId:{color:"#698075",fontSize:10,marginTop:2},seatState:{color:"#5E7569",fontSize:12,marginTop:7},ready:{color:"#2E7156",fontWeight:"700"},mic:{alignItems:"center",backgroundColor:"#FCFAF4",borderColor:"#1C6048",borderRadius:12,borderWidth:1,bottom:-2,height:24,justifyContent:"center",position:"absolute",right:-3,width:24,zIndex:2},micCheck:{alignItems:"center",backgroundColor:"#F8F3E8",borderColor:"#E9DFCC",borderRadius:12,borderWidth:1,flexDirection:"row",gap:12,marginTop:18,padding:12},realMediaNotice:{backgroundColor:"#FFF7E6",borderColor:"#E5C27A"},realMediaNoticeReady:{alignItems:"stretch",flexDirection:"column",gap:10},realMediaText:{color:"#684300",flex:1,fontSize:13,fontWeight:"700",lineHeight:18},realMediaDetail:{flex:1,gap:4,minWidth:0},realMediaStep:{color:"#7A5A1E",fontSize:11,fontWeight:"600"},waitingVoiceFeedback:{alignItems:"center",flex:1,flexDirection:"row",gap:10,minWidth:0},waitingVoiceIcon:{alignItems:"center",backgroundColor:"#E7F2EA",borderRadius:20,height:40,justifyContent:"center",width:40},waitingVoiceIconActive:{backgroundColor:"#4AA879"},waitingVoiceCopy:{flex:1,minWidth:0},waitingVoiceTitle:{color:"#2B634B",fontSize:13,fontWeight:"800"},waitingVoiceDetail:{color:"#7A5A1E",fontSize:11,marginTop:2},waitingVoiceMeter:{alignItems:"flex-end",flexDirection:"row",gap:3,height:18,marginTop:5},waitingVoiceMeterBar:{backgroundColor:"#D7E3D8",borderRadius:2,height:7,width:5},waitingVoiceMeterBarActive:{backgroundColor:"#4AA879"},mediaRetry:{alignItems:"center",backgroundColor:"#FFF",borderColor:"#C9A34E",borderRadius:12,borderWidth:1,marginTop:12,padding:14},mediaRetryText:{color:"#7A4E00",fontSize:14,fontWeight:"800"},inlineButtonContent:{alignItems:"center",flexDirection:"row",gap:8,justifyContent:"center"},waitFooter:{backgroundColor:"#FCFAF4",borderTopColor:"#EEE6D5",borderTopWidth:1,flexDirection:"row",gap:12,left:0,padding:14,position:"absolute",right:0},testMic:{alignItems:"center",borderColor:"#1E503D",borderRadius:12,borderWidth:1,flex:1,padding:17},start:{alignItems:"center",backgroundColor:"#1C563E",borderRadius:12,flex:1,padding:17},startDisabled:{backgroundColor:"#9EAEA4"},startText:{color:"#FFF",fontSize:16,fontWeight:"800"},
  liveSafe:{backgroundColor:"#061E1D",flex:1},live:{backgroundColor:"#082524",flex:1,justifyContent:"space-between",paddingHorizontal:14,paddingTop:8,paddingBottom:10},liveBackground:{bottom:0,left:0,opacity:.22,position:"absolute",right:0,top:0},liveTint:{backgroundColor:"rgba(4, 29, 27, .58)",bottom:0,left:0,position:"absolute",right:0,top:0},liveBody:{flexShrink:1,minHeight:0},liveTop:{alignItems:"center",flexDirection:"row",justifyContent:"space-between"},liveHeaderButton:{alignItems:"center",borderColor:"#90A7A0",borderRadius:24,borderWidth:1,height:36,justifyContent:"center",width:36},liveHeaderSpacer:{height:36,width:36},liveRoom:{color:"#FFF6DA",fontFamily:"serif",fontSize:17,textAlign:"center"},livePractice:{color:"#DAE8DD",fontSize:10,textAlign:"center"},liveStatusRow:{alignItems:"center",flexDirection:"row",gap:4,justifyContent:"center"},liveStatus:{color:"#78E2AE",fontSize:12,lineHeight:16,textAlign:"center"},liveStatusSub:{color:"#D8C58F",fontSize:11,lineHeight:15,textAlign:"center"},players:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",marginTop:10},playersSingle:{justifyContent:"center"},livePlayer:{alignItems:"center",height:118,width:"47%"},liveAvatar:{alignItems:"center",backgroundColor:"#284441",borderColor:"#CFE7DC",borderRadius:40,borderWidth:2,height:72,justifyContent:"center",width:72},speakerAvatar:{borderColor:"#75F6BD",borderWidth:4},reconnectAvatar:{borderColor:"#D9A93F"},liveInitial:{color:"#FFF",fontSize:24},liveName:{color:"#FFF9E8",fontFamily:"serif",fontSize:15,marginTop:3},liveState:{color:"#A9B8B2",fontSize:11},speakingState:{backgroundColor:"#3E9470",borderRadius:12,color:"#FFF",paddingHorizontal:8,paddingVertical:3},reconnectState:{color:"#E8B44B"},reconnectAction:{alignSelf:"center",borderColor:"#9A8150",borderRadius:14,borderWidth:1,marginTop:8,paddingHorizontal:14,paddingVertical:8},reconnectActionText:{color:"#E8B44B",fontSize:12,fontWeight:"800"},clue:{borderColor:"#9A8150",borderWidth:1,marginTop:8,padding:10},clueKicker:{alignItems:"center",flexDirection:"row",gap:6},clueKickerText:{color:"#D6B971",fontFamily:"serif",fontSize:15},clueRule:{color:"#6DD6A1",fontSize:11,marginTop:8,textAlign:"center"},clueText:{color:"#FFF1D2",fontFamily:"serif",fontSize:17,marginTop:8,textAlign:"center"},clueHint:{color:"#B6C5B8",fontSize:12,marginTop:8,textAlign:"center"},signalRow:{flexDirection:"row",gap:6,marginTop:8},signal:{alignItems:"center",backgroundColor:"#173532",borderColor:"#405D55",borderRadius:7,borderWidth:1,flex:1,flexDirection:"row",gap:4,justifyContent:"center",minWidth:0,padding:5},signalText:{color:"#D8E5DB",flexShrink:1,fontSize:11},controls:{backgroundColor:"#142D2B",borderRadius:24,flexDirection:"row",justifyContent:"space-around",marginTop:10,paddingBottom:8,paddingTop:10},control:{alignItems:"center",width:70},controlCircle:{alignItems:"center",backgroundColor:"#24413D",borderRadius:26,height:48,justifyContent:"center",width:48},hangup:{backgroundColor:"#C84A45"},controlText:{color:"#E8E4D8",fontSize:11,lineHeight:14,marginTop:4,textAlign:"center"},dangerText:{color:"#F18A7C"},
  report:{padding:18,paddingBottom:28,width:"100%"},reportHeader:{alignItems:"center",flexDirection:"row",justifyContent:"space-between"},reportTitle:{color:"#1B4B3C",fontSize:20,fontWeight:"800"},reportLoading:{flex:1,justifyContent:"space-between"},reportLoadingHeaderSpacer:{height:40,width:40},reportLoadingBody:{alignItems:"center",flex:1,justifyContent:"center",paddingHorizontal:24},reportLoadingIcon:{alignItems:"center",backgroundColor:"#E8F3EA",borderRadius:32,height:64,justifyContent:"center",marginBottom:18,width:64},reportLoadingTitle:{color:"#1B4B3C",fontFamily:"serif",fontSize:25,fontWeight:"700",textAlign:"center"},reportLoadingBodyText:{color:"#6B7C71",fontSize:14,lineHeight:21,marginTop:10,maxWidth:300,textAlign:"center"},reportLoadingHint:{color:"#8A978E",fontSize:12,lineHeight:18,marginTop:18,maxWidth:280,textAlign:"center"},legacyReport:{color:"#65796D",fontSize:10,textAlign:"center"},reportSub:{alignItems:"center",flexDirection:"row",gap:7,justifyContent:"center",marginVertical:10},reportSubText:{color:"#778078"},infoCard:{alignItems:"center",borderColor:"#DBDDD4",borderRadius:15,borderWidth:1,flexDirection:"row",gap:13,overflow:"hidden",padding:10},infoImage:{backgroundColor:"#244D49",borderRadius:9,height:58,overflow:"hidden",width:64},infoImageArt:{bottom:0,height:"100%",left:0,position:"absolute",right:0,top:0,width:"100%"},infoName:{color:"#1B4A3B",fontFamily:"serif",fontSize:18,fontWeight:"700"},infoMeta:{alignItems:"center",flexDirection:"row",flexWrap:"wrap",gap:4,marginTop:8},infoMetaText:{color:"#788078",fontSize:11},processingStrip:{backgroundColor:"#FFF7E6",borderColor:"#E7C06B",borderRadius:12,borderWidth:1,gap:4,marginTop:12,padding:10},processingText:{color:"#7A4E00",fontSize:12,fontWeight:"800"},scoreCard:{alignItems:"center",backgroundColor:"#FFFEFA",borderColor:"#EFF0E8",borderRadius:16,borderWidth:1,flexDirection:"row",flexShrink:1,gap:12,marginTop:16,minWidth:0,overflow:"hidden",padding:14,width:"100%"},scoreCircle:{alignItems:"center",borderColor:"#36966C",borderRadius:62,borderWidth:8,flexShrink:0,height:124,justifyContent:"center",width:124},scoreNumber:{color:"#1F654B",fontFamily:"serif",fontSize:48},scoreSummary:{flex:1,flexShrink:1,minWidth:0},scoreFor:{color:"#1B4638",fontSize:15,fontWeight:"700"},excellent:{color:"#299368",flexShrink:1,fontFamily:"serif",fontSize:22,marginTop:7},scoreDetails:{color:"#50665A",fontSize:11,marginTop:12},metrics:{backgroundColor:"#FFF",borderColor:"#E7E8DF",borderRadius:15,borderWidth:1,flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",marginTop:16,minWidth:0,paddingVertical:14,width:"100%"},metric:{alignItems:"center",flexBasis:"24%",flexGrow:1,flexShrink:1,maxWidth:"25%",minWidth:0,paddingHorizontal:2},metricLabel:{color:"#50665A",fontSize:11},metricScore:{color:"#176144",fontFamily:"serif",fontSize:20},metricBar:{backgroundColor:"#3DA275",borderRadius:5,height:6,marginTop:7,maxWidth:56,width:"70%"},metricBarMissing:{backgroundColor:"#D7DDD8"},reportRefresh:{alignItems:"center",borderColor:"#B85036",borderRadius:10,borderWidth:1,marginTop:10,padding:12},reportRefreshText:{color:"#B85036",fontSize:13,fontWeight:"800"},tip:{alignItems:"center",backgroundColor:"#F5F9F0",borderColor:"#E2EAD9",borderRadius:13,borderWidth:1,flexDirection:"row",gap:15,marginTop:14,padding:16},tipContent:{flex:1,minWidth:0},tipTitle:{color:"#24523E",fontSize:15,fontWeight:"800"},tipBody:{color:"#486052",flexShrink:1,fontSize:13,marginTop:5},resultTitle:{color:"#28523F",fontSize:16,fontWeight:"800",marginTop:18},reportRow:{alignItems:"center",backgroundColor:"#FFF",borderColor:"#E8E8DF",borderRadius:14,borderWidth:1,flexDirection:"row",gap:10,marginTop:10,minWidth:0,padding:11,width:"100%"},resultAvatar:{alignItems:"center",backgroundColor:"#305D4B",borderRadius:20,flexShrink:0,height:40,justifyContent:"center",width:40},resultName:{color:"#1C4335",flex:1,flexShrink:1,fontFamily:"serif",fontSize:16,fontWeight:"700",minWidth:0},resultState:{flex:1,flexShrink:1,minWidth:0},resultStateText:{color:"#417D60",fontSize:11},failureReason:{color:"#DA5B3D",fontSize:10,marginTop:3},failed:{color:"#DA5B3D"},resultScore:{color:"#1D7654",flexShrink:0,fontFamily:"serif",fontSize:20,minWidth:28,textAlign:"right"},retry:{color:"#B85036",flexShrink:0,fontSize:11},return:{alignItems:"center",backgroundColor:"#195F45",borderRadius:10,marginTop:14,padding:17},returnText:{color:"#FFF",fontSize:18,fontWeight:"800"},
});
