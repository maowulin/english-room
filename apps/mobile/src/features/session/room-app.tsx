import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { sessionReducer, initialSessionState, type Screen, type RoomMemberView } from "./session-reducer";
import { AuthScreen as VisualAuthScreen } from "./auth-screen";
import {
  demoMediaUiState,
  LiveScreen,
  LobbyScreen,
  type LiveRemoteSeat,
  type MediaUiState,
  ReportLoadingScreen,
  ReportScreen,
  WaitingScreen,
} from "./story-screens";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import {
  canSendAuthenticatedAnalytics,
  createAppSessionId,
  defaultAnalyticsEventsFactory,
  type AnalyticsEventsFactory,
} from "@/services/analytics-factory";
import type { RecordingStatusChangedPayload, ScoreReportViewedPayload } from "@/services/analytics-client";
import { AnalyticsEvents } from "@/services/analytics-events";
import { HttpRoomClient, type Room, type RoomClient, type RoomMember, type RoomReport, type ReportItem } from "@/services/room-client";
import { resolveApiBaseUrl } from "@/services/api-base-url";
import { RoomRealtimeClient, type RoomRealtimeClientFactory } from "@/services/realtime-client";
import { createRtcClient } from "@/services/rtc-factory";
import { resolveAppMediaMode, type RtcClient } from "@/services/rtc-client";

function mapRtcToMedia(rtc: string): MediaUiState["rtc"] {
  if (rtc === "connected") return "joined";
  if (rtc === "joining") return "joining";
  if (rtc === "reconnecting") return "reconnecting";
  if (rtc === "kicked") return "kicked";
  if (rtc === "joinFailed") return "joinFailed";
  if (rtc === "disconnected") return "disconnected";
  return "idle";
}

function mapRoomMembers(members: RoomMember[], player?: { id: string; nickname: string }): RoomMemberView[] {
  const seen = new Set<string>();
  return members.flatMap((member) => {
    if (seen.has(member.playerId)) return [];
    seen.add(member.playerId);
    const isLocal = member.playerId === player?.id;
    return [{
      playerId: member.playerId,
      nickname: isLocal ? player?.nickname ?? "You" : member.displayName?.trim() || "Guest",
      isLocal,
      ready: member.ready,
    }];
  });
}

function readRoomAccessToken(client: RoomClient): string | undefined {
  const reader = client.getAccessToken;
  if (typeof reader !== "function") return undefined;
  return reader.call(client);
}

const defaultRealtimeClientFactory: RoomRealtimeClientFactory = () => new RoomRealtimeClient();
const ACTIVE_VOICE_VOLUME_THRESHOLD = 10;
const VOICE_VOLUME_MIN = 0;
const VOICE_VOLUME_MAX = 100;

function rtcTerminalFailure(rtc: MediaUiState["rtc"]) {
  return rtc === "disconnected" || rtc === "kicked" || rtc === "joinFailed";
}

function mediaReady(mediaState: MediaUiState) {
  return mediaState.permission === "granted" && mediaState.grant === "ready" && mediaState.rtc === "joined";
}

function initialRealMedia(): MediaUiState {
  return {
    mode: "real",
    network: "good",
    permission: "unknown",
    grant: "idle",
    rtc: "idle",
    recording: "idle",
    report: "waiting",
    localVoiceActive: false,
    localVoiceLevel: 0,
  };
}

function clampVoiceVolume(volume: number): number {
  if (!Number.isFinite(volume)) return VOICE_VOLUME_MIN;
  return Math.min(VOICE_VOLUME_MAX, Math.max(VOICE_VOLUME_MIN, volume));
}

function scoreJobsTerminal(items: ReportItem[]): boolean {
  return items.length > 0 && items.every((item) => item.status === "completed" || item.status === "failed");
}

function scoreJobsReady(items: ReportItem[]): boolean {
  return items.length > 0 && items.every((item) => item.status === "completed");
}

function visibleReportItems(items: ReportItem[], mediaMode: MediaUiState["mode"]): ReportItem[] {
  if (mediaMode !== "demo") return items;
  const localItem = items[0];
  return localItem ? [{ ...localItem, playerName: "You" }] : [];
}

export const REAL_REPORT_POLL_INTERVAL_MS = 1_000;
const REAL_REPORT_MAX_POLLS = 60;
export const REPORT_GENERATION_TIMEOUT_MESSAGE = "Report generation timed out. Please try again.";

type ReportSleep = (milliseconds: number) => Promise<void>;

function waitForReportPoll(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function reportReachedTerminalState(report: RoomReport): boolean {
  return (
    report.roomStatus === "ended" ||
    report.roomStatus === "recording_failed" ||
    scoreJobsTerminal(report.items)
  );
}

function reportPollingTimedOut(report: RoomReport): boolean {
  return report.roomStatus === "processing" && !reportReachedTerminalState(report);
}

export async function pollRoomReport(
  client: RoomClient,
  roomId: string,
  sleep: ReportSleep = waitForReportPoll,
): Promise<RoomReport> {
  let report = await client.getRoomReport(roomId);
  for (let poll = 1; poll < REAL_REPORT_MAX_POLLS; poll += 1) {
    if (reportReachedTerminalState(report)) return report;
    await sleep(REAL_REPORT_POLL_INTERVAL_MS);
    report = await client.getRoomReport(roomId);
  }
  return report;
}

function clampLatencyMs(startedAt: number): number {
  return Math.min(600_000, Math.max(0, Date.now() - startedAt));
}

function mapScoreReportState(
  report: MediaUiState["report"],
): ScoreReportViewedPayload["report_state"] {
  if (report === "ready") return "success";
  if (report === "failed") return "failed";
  if (report === "processing") return "processing";
  return "waiting";
}

function mapRecordingAnalyticsPayload(
  endedStatus: Room["status"],
  media: Pick<MediaUiState, "recording" | "report">,
  statusSequence: number,
): Pick<RecordingStatusChangedPayload, "recording_status" | "status_sequence"> {
  if (endedStatus === "recording_failed" || media.recording === "failed") {
    return { recording_status: "failed", status_sequence: statusSequence };
  }
  if (media.recording === "ready" && media.report === "ready") {
    return { recording_status: "ready", status_sequence: statusSequence };
  }
  if (media.report === "failed") {
    return { recording_status: "failed", status_sequence: statusSequence };
  }
  return { recording_status: "stopping", status_sequence: statusSequence };
}

function trackAnalytics(action: () => void): void {
  try {
    action();
  } catch {
    // Analytics must never block UI or session state transitions.
  }
}

const GENERIC_ACTION_ERROR = "We couldn't complete that action. Please try again.";
const CONFLICT_ACTION_ERROR = "This room changed while you were here. Please try again.";

function userFacingApiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if ((error as { status?: number } | undefined)?.status === 401 || /HTTP 401/.test(message)) {
    return "Your guest session expired. Please enter as a Demo guest again.";
  }
  return /HTTP 409/.test(message) ? CONFLICT_ACTION_ERROR : GENERIC_ACTION_ERROR;
}

const seats = [
  { name: "MINT", status: "Seated", tone: "mint" },
  { name: "AVA", status: "Waiting", tone: "warm" },
  { name: "NOAH", status: "Waiting", tone: "dark" },
  { name: "LUNA", status: "Waiting", tone: "soft" },
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
      testID={`${label === "Log in" ? "login" : label === "Create new room" ? "create-room" : label === "Ready" ? "ready" : label === "Start room" ? "start-room" : label === "End room" ? "end-room" : label.toLowerCase()}-button`}
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
          <Text style={styles.display}>{register ? "Start speaking English tonight." : "Practice real English with real people."}</Text>
          <Text style={styles.muted}>{register ? "Create your English Room identity" : "Every conversation moves you forward."}</Text>
        </View>
        <View style={styles.authCard}>
          <Text style={styles.cardTitle}>{register ? "Create account" : "Welcome back"}</Text>
          {register && <Field label="Name" placeholder="What should we call you?" />}
          <Field label="Email" placeholder="name@example.com" value={email} onChangeText={setEmail} testID="email-input" />
          {register && <Field label="Verification code" placeholder="Enter your email code" />}
          <Field label="Password" placeholder="At least 8 characters" secureTextEntry />
          {register && <Text style={styles.terms}>By signing up, you agree to the Terms and Privacy Policy</Text>}
          <Button label={register ? "Create and start" : "Log in"} onPress={onLogin} />
          {!register && <Text style={styles.forgot}>Forgot password?</Text>}
          <View style={styles.divider}><View style={styles.line} /><Text style={styles.dividerText}>or</Text><View style={styles.line} /></View>
          <View style={styles.socialRow}><Button label=" Apple" onPress={onLogin} secondary /><Button label="WeChat" onPress={onLogin} secondary /></View>
        </View>
        <Pressable accessibilityLabel={register ? "Go to login" : "Go to sign up"} onPress={onToggle}>
          <Text style={styles.switchText}>{register ? "Already have an account? Log in" : "Don't have an account? Sign up"}</Text>
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
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}><Brand /><Text style={styles.eyebrow}>TONIGHT’S ENGLISH SESSION</Text><Text style={styles.display}>What would you like to practice tonight?</Text><Text style={styles.muted}>Choose a language card and join a 20-minute conversation with your friends.</Text>
    <View style={styles.topicCard}><Text style={styles.topicBadge}>Recommended</Text><Text style={styles.topicTitle}>Midnight Café</Text><Text style={styles.topicBody}>Talk in English about your city, travel, and how you feel right now.</Text><View style={styles.topicFooter}><Text style={styles.accentText}>20 MIN · 2–4 PLAYERS</Text><Text style={styles.topicNumber}>01</Text></View></View>
    <Button label="Create new room" onPress={onCreate} />
    <View style={styles.joinCard}><Text style={styles.cardTitle}>Join a friend&apos;s room</Text><TextInput accessibilityLabel="Room code" autoCapitalize="characters" onChangeText={setCode} placeholder="Enter 6-character room code" placeholderTextColor="#91A29F" style={styles.input} value={code} /><Button label="Join room" onPress={onJoin} secondary /></View>
  </ScrollView></SafeAreaView>;
}

export function LegacyWaiting({ ready, onReady, onStart, onLeave }: { ready: boolean; onReady: () => void; onStart: () => void; onLeave: () => void }) {
  const avatarStyles = [styles.avatar0, styles.avatar1, styles.avatar2, styles.avatar3];
  return <SafeAreaView style={styles.darkSafe}><ScrollView contentContainerStyle={styles.darkPage}><View style={styles.topbar}><Text style={styles.darkBrand}>ENGLISH ROOM</Text><Pressable accessibilityLabel="Leave room" onPress={onLeave}><Text style={styles.leave}>Leave</Text></Pressable></View><Text style={styles.roomCode}>ROOM · MINT 02</Text><Text style={styles.darkDisplay}>Waiting for everyone to take a seat</Text><Text style={styles.darkMuted}>The conversation starts when everyone is ready.</Text>
    <View style={styles.seatGrid}>{seats.map((seat, index) => <View key={seat.name} style={[styles.seat, index === 0 && styles.occupiedSeat]}><View style={[styles.avatar, avatarStyles[index]]}><Text style={styles.avatarText}>{seat.name.slice(0, 1)}</Text></View><Text style={styles.seatName}>{seat.name}</Text><Text style={styles.seatStatus}>{index === 0 && ready ? "Ready" : seat.status}</Text></View>)}</View>
    <View style={styles.micCheck}><View style={styles.pulseDot} /><View><Text style={styles.micTitle}>Microphone check passed</Text><Text style={styles.micBody}>Your voice will only be heard in this room</Text></View></View>
    <Button label={ready ? "Ready" : "Get ready"} onPress={onReady} secondary={ready} /><Button label="Start room" disabled={!ready} onPress={onStart} />
  </ScrollView></SafeAreaView>;
}

export function LegacyLive({ onEnd }: { onEnd: () => void }) {
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  return <SafeAreaView style={styles.darkSafe}><View style={styles.livePage}><View style={styles.topbar}><Text style={styles.darkBrand}>ENGLISH ROOM</Text><View style={styles.network}><View style={styles.networkDot} /><Text style={styles.networkText}>Good connection</Text></View></View><Text style={styles.roomCode}>Midnight Café · 08:42</Text><Text style={styles.darkDisplay}>In progress</Text><Text style={styles.darkMuted}>It&apos;s Mint&apos;s turn to share a moment that made you smile.</Text>
    <View style={styles.liveStage}><View style={styles.speakerRing}><View style={styles.speakerAvatar}><Text style={styles.speakerInitial}>M</Text></View></View><Text style={styles.liveName}>MINT</Text><Text style={styles.speaking}>Speaking · 00:42</Text><View style={styles.wave}>{[1,2,3,4,5,6,7].map((bar) => <View key={bar} style={[styles.waveBar, { height: 12 + (bar % 3) * 12 }]} />)}</View></View>
    <View style={styles.controlBar}><Control label={muted ? "Unmute" : "Mute"} icon={muted ? "⌁" : "◉"} onPress={() => setMuted(!muted)} /><Control label={speaker ? "Speaker on" : "Speaker off"} icon="◌" onPress={() => setSpeaker(!speaker)} /><Control label="End room" icon="×" danger onPress={onEnd} /></View>
  </View></SafeAreaView>;
}

function Control({ label, icon, danger, onPress }: { label: string; icon: string; danger?: boolean; onPress: () => void }) { return <Pressable accessibilityLabel={label} onPress={onPress} style={styles.control} testID={label === "End room" ? "end-room-button" : undefined}><View style={[styles.controlIcon, danger && styles.dangerIcon]}><Text style={styles.controlIconText}>{icon}</Text></View><Text style={styles.controlLabel}>{label}</Text></Pressable>; }

export function LegacyReport({ onRetry, onDone }: { onRetry: () => void; onDone: () => void }) {
  const [retried, setRetried] = useState(false);
  const rows = [["MINT", "Fluent expression", "88", "done"], ["AVA", "Analyzing speech", "Processing", "processing"], ["NOAH", "Waiting for audio upload", "Waiting", "waiting"], ["LUNA", retried ? "Submitted again" : "Scoring temporarily failed", retried ? "Processing" : "Retry", retried ? "processing" : "failed"]] as const;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}><Brand /><Text style={styles.eyebrow}>SESSION COMPLETE · MINT 02</Text><Text style={styles.display}>Speaking report</Text><Text style={styles.muted}>Every conversation helps you express yourself more naturally.</Text><View style={styles.scoreHero}><Text style={styles.scoreLabel}>Your overall score</Text><Text style={styles.score}>88</Text><Text style={styles.scoreCaption}>Great · Confident speaker</Text><View style={styles.scorePills}><Text style={styles.scorePill}>Fluency 90</Text><Text style={styles.scorePill}>Pronunciation 86</Text><Text style={styles.scorePill}>Vocabulary 88</Text></View></View><Text style={styles.sectionTitle}>Room member reports</Text>{rows.map(([name, body, status, tone]) => <View key={name} style={styles.reportRow}><View style={styles.reportAvatar}><Text style={styles.reportAvatarText}>{name[0]}</Text></View><View style={styles.reportInfo}><Text style={styles.reportName}>{name}</Text><Text style={styles.reportBody}>{body}</Text></View>{tone === "failed" ? <Pressable accessibilityLabel="Retry scoring" onPress={() => { setRetried(true); onRetry(); }}><Text style={styles.retry}>Retry</Text></Pressable> : <Text style={[styles.reportStatus, tone === "done" && styles.successStatus]}>{status}</Text>}</View>)}<Button label="Back to lobby" onPress={onDone} /></ScrollView></SafeAreaView>;
}

export function RoomApp({
  client: injectedClient,
  mediaState: injectedMediaState,
  realtimeClientFactory = defaultRealtimeClientFactory,
  analyticsEvents: injectedAnalyticsEvents,
  analyticsEventsFactory = defaultAnalyticsEventsFactory,
}: {
  client?: RoomClient;
  mediaState?: MediaUiState;
  realtimeClientFactory?: RoomRealtimeClientFactory;
  analyticsEvents?: AnalyticsEvents;
  analyticsEventsFactory?: AnalyticsEventsFactory;
}) {
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);
  const appSessionId = useMemo(() => createAppSessionId(), []);
  const appOpenedSentRef = useRef(false);
  const recordingSequenceRef = useRef(0);
  const scoreRetryAttemptsRef = useRef(new Map<string, number>());
  const client = useMemo(
    () => injectedClient ?? new HttpRoomClient({ baseUrl: resolveApiBaseUrl() }),
    [injectedClient],
  );
  const analyticsEvents = useMemo(
    () =>
      injectedAnalyticsEvents ??
      analyticsEventsFactory(client, appSessionId, state.player?.id),
    [injectedAnalyticsEvents, analyticsEventsFactory, client, appSessionId, state.player?.id],
  );
  const mediaMode = resolveAppMediaMode(
    { ...process.env, EXPO_PUBLIC_MEDIA_MODE: process.env.EXPO_PUBLIC_MEDIA_MODE },
    Platform.OS,
    __DEV__,
  );
  const rtcRef = useRef<RtcClient | null>(null);
  const [liveMedia, setLiveMedia] = useState<MediaUiState>(
    injectedMediaState ?? (mediaMode === "real" ? initialRealMedia() : demoMediaUiState),
  );
  const mediaState = injectedMediaState ?? liveMedia;
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [remoteSeats, setRemoteSeats] = useState<LiveRemoteSeat[]>([]);
  const [apiError, setApiError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [reportItems, setReportItems] = useState<ReportItem[]>([]);
  const [reportError, setReportError] = useState<string>();
  const playerRef = useRef(state.player);
  const realtimeRef = useRef<ReturnType<RoomRealtimeClientFactory> | null>(null);
  const reportLoadStartedRef = useRef<string | undefined>(undefined);
  const maybeEmitAppOpened = useCallback(() => {
    if (appOpenedSentRef.current || !canSendAuthenticatedAnalytics(client)) {
      return;
    }
    appOpenedSentRef.current = true;
    trackAnalytics(() => analyticsEvents.appOpened({ entry_point: "cold_start" }));
  }, [analyticsEvents, client]);
  useEffect(() => {
    playerRef.current = state.player;
  }, [state.player]);
  useEffect(() => {
    maybeEmitAppOpened();
  }, [maybeEmitAppOpened]);
  const roomId = state.room?.id;
  useEffect(() => {
    if (!roomId) return;
    const accessToken = readRoomAccessToken(client);
    if (!accessToken) return;

    const realtime = realtimeClientFactory();
    realtimeRef.current = realtime;
    const unsubscribeUpdates = realtime.subscribe((update) => {
      if (update.type !== "room.snapshot" && update.type !== "room.updated") return;
      dispatch({
        type: "roomMembersUpdated",
        members: mapRoomMembers(update.room.members, playerRef.current),
        room: {
          id: update.room.id,
          code: update.room.code,
          title: update.room.title,
          ownerPlayerId: update.room.ownerPlayerId,
          turnIndex: update.room.turnIndex,
          completedTurnCount: update.room.completedTurnCount,
          currentSpeakerPlayerId: update.room.currentSpeakerPlayerId,
          allTurnsCompleted: update.room.allTurnsCompleted,
        },
      });
      if (update.room.status === "live") {
        dispatch({ type: "roomStarted", room: { currentSpeakerPlayerId: update.room.currentSpeakerPlayerId, completedTurnCount: update.room.completedTurnCount, allTurnsCompleted: update.room.allTurnsCompleted, turnIndex: update.room.turnIndex } });
      } else if (update.room.status === "ended" || update.room.status === "recording_failed") {
        dispatch({ type: "roomEnded" });
      }
    });
    const unsubscribeProtocolErrors = realtime.subscribeProtocolErrors(() => {
      // Protocol / transport errors stay inside RoomRealtimeClient; do not block REST or fake TRTC state.
    });
    realtime.connect({ roomId, accessToken });

    return () => {
      unsubscribeUpdates();
      unsubscribeProtocolErrors();
      realtime.close();
      if (realtimeRef.current === realtime) {
        realtimeRef.current = null;
      }
    };
  }, [roomId, client, realtimeClientFactory]);
  useEffect(() => {
    if (state.screen !== "report" || !roomId || reportLoadStartedRef.current === roomId) return;
    reportLoadStartedRef.current = roomId;
    let active = true;
    void client
      .getRoomReport(roomId)
      .then((report) => {
        if (!active) return;
        const items = visibleReportItems(report.items, mediaState.mode);
        setReportItems(items);
        setLiveMedia((current) => ({ ...current, recording: "processing", report: "processing" }));
      })
      .catch(() => {
        if (active) setReportError("Could not load the report. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [client, mediaState.mode, roomId, state.screen]);
  useEffect(() => {
    if (injectedMediaState || mediaMode !== "real") return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    // Defer client creation so fail-closed setState is not synchronous in the effect body.
    queueMicrotask(() => {
      if (!active) return;
      try {
        const rtc = createRtcClient("real");
        if (!active) {
          rtc.dispose();
          return;
        }
        rtcRef.current = rtc;
        unsubscribe = rtc.subscribe({
          onState: (next) => {
            const rtc = mapRtcToMedia(next.connection);
            setMuted(next.muted);
            setSpeakerOn(next.speakerOn);
            setLiveMedia((current) => ({
              ...current,
              localVoiceActive: next.muted || rtc !== "joined" ? false : current.localVoiceActive,
              localVoiceLevel: next.muted || rtc !== "joined" ? VOICE_VOLUME_MIN : current.localVoiceLevel,
              rtc,
            }));
            if (rtcTerminalFailure(rtc)) {
              setRemoteSeats([]);
            }
          },
          onNetwork: (quality) => setLiveMedia((current) => ({ ...current, network: quality })),
          onRemoteUserEnter: (userId) => {
            setRemoteSeats((current) =>
              current.some((seat) => seat.userId === userId)
                ? current
                : [...current, { userId, speaking: false, audioAvailable: true }],
            );
          },
          onRemoteUserLeave: (userId) => {
            setRemoteSeats((current) => current.filter((seat) => seat.userId !== userId));
          },
          onUserAudioAvailable: (userId, available) => {
            setRemoteSeats((current) =>
              current.map((seat) => (seat.userId === userId ? { ...seat, audioAvailable: available } : seat)),
            );
          },
          onUserVoiceVolume: (userId, volume) => {
            setRemoteSeats((current) =>
              current.map((seat) => (seat.userId === userId ? { ...seat, speaking: volume > ACTIVE_VOICE_VOLUME_THRESHOLD } : seat)),
            );
          },
          onLocalVoiceVolume: (volume) => {
            const level = clampVoiceVolume(volume);
            setLiveMedia((current) => {
              const connected = current.permission === "granted" && current.rtc === "joined";
              return {
                ...current,
                localVoiceActive: level > ACTIVE_VOICE_VOLUME_THRESHOLD && connected,
                localVoiceLevel: connected ? level : VOICE_VOLUME_MIN,
              };
            });
          },
        });
      } catch {
        if (!active) return;
        // Fail closed into media UI state; do not surface a status-bar "API:" line.
        setLiveMedia((current) => ({ ...current, grant: "failed", rtc: "joinFailed" }));
      }
    });
    return () => {
      active = false;
      unsubscribe?.();
      const rtc = rtcRef.current;
      rtcRef.current = null;
      if (rtc) {
        void rtc
          .leave()
          .catch(() => undefined)
          .finally(() => rtc.dispose());
      }
    };
  }, [injectedMediaState, mediaMode]);
  useEffect(() => {
    if (mediaMode !== "real" || injectedMediaState || state.screen !== "live") return;
    const rtc = rtcRef.current;
    const playerId = playerRef.current?.id;
    if (!rtc || !playerId || !mediaReady(mediaState)) return;
    const shouldMute = state.room?.currentSpeakerPlayerId !== playerId;
    if (rtc.getState().muted !== shouldMute) {
      void rtc.setMuted(shouldMute).catch(() => undefined);
    }
  }, [injectedMediaState, mediaMode, mediaState, state.room?.currentSpeakerPlayerId, state.screen]);
  const ensureMicPermission = async () => {
    if (Platform.OS === "android") {
      setLiveMedia((current) => ({ ...current, permission: "requesting" }));
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      const granted = result === PermissionsAndroid.RESULTS.GRANTED;
      setLiveMedia((current) => ({ ...current, permission: granted ? "granted" : "denied" }));
      return granted;
    }
    if (Platform.OS === "web") {
      setLiveMedia((current) => ({ ...current, permission: "requesting" }));
      try {
        const media = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
        if (!media?.getUserMedia) {
          // Cannot claim granted without a query surface.
          setLiveMedia((current) => ({ ...current, permission: "unknown" }));
          return false;
        }
        const stream = await media.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setLiveMedia((current) => ({ ...current, permission: "granted" }));
        return true;
      } catch {
        setLiveMedia((current) => ({ ...current, permission: "denied" }));
        return false;
      }
    }
    // iOS/native: never mark granted before a real system prompt / join evidence.
    setLiveMedia((current) => ({ ...current, permission: "requesting" }));
    return true;
  };
  const prepareRealMedia = async (roomId: string): Promise<boolean> => {
    // Media failures must surface inside waiting/live via MediaUiState, never block
    // roomJoined or rely on a top-of-screen "API:" status-bar error.
    if (mediaMode !== "real" || injectedMediaState) return false;
    const rtc = rtcRef.current;
    if (!rtc) {
      setLiveMedia((current) => ({ ...current, grant: "failed", rtc: "joinFailed" }));
      return false;
    }
    const permitted = await ensureMicPermission();
    if (!permitted) {
      // permission already set to denied; keep rtc/grant idle so WaitingMediaNotice shows.
      setLiveMedia((current) => ({ ...current, grant: "idle", rtc: "idle" }));
      return false;
    }
    setLiveMedia((current) => ({ ...current, grant: "loading", rtc: "joining" }));
    try {
      const grant = await client.issueRtcGrant(roomId);
      setLiveMedia((current) => ({ ...current, grant: "ready" }));
      try {
        await rtc.join(grant);
        // Every player joins muted; the authoritative room turn decides who may speak.
        await rtc.setMuted(true);
        setLiveMedia((current) => ({
          ...current,
          permission: current.permission === "denied" ? "denied" : "granted",
          grant: "ready",
          rtc: "joined",
        }));
        return true;
      } catch {
        setLiveMedia((current) => ({ ...current, rtc: "joinFailed" }));
        await rtc.leave().catch(() => undefined);
        return false;
      }
    } catch {
      setLiveMedia((current) => ({ ...current, grant: "failed", rtc: "idle" }));
      return false;
    }
  };
  const leaveSession = () => {
    const rtc = rtcRef.current;
    realtimeRef.current?.close();
    realtimeRef.current = null;
    dispatch({ type: "leaveRoom" });
    setRemoteSeats([]);
    if (!injectedMediaState) {
      setLiveMedia(mediaMode === "real" ? initialRealMedia() : demoMediaUiState);
    }
    // Media teardown must not block returning to lobby; join is gated inside TrtcNativeClient until leave settles.
    if (mediaMode === "real" && rtc) {
      void rtc.leave().catch(() => undefined);
    }
  };
  const enterRoomFlow = async (
    room: Room,
    joinMethod: "room_code" | "recent_room" | "deep_link" | "invite",
    roomRole: "host" | "member",
  ) => {
    const player = playerRef.current;
    let joinedRoom = room;
    let joinedMembers: RoomMember[] = [];
    let roomVersion = room.version ?? 1;
    if (player?.id) {
      const joined = await client.joinRoom(room.id, { playerId: player.id });
      joinedRoom = joined;
      joinedMembers = joined.members;
      roomVersion = joined.version ?? roomVersion;
      const seatIndex = joinedMembers.findIndex((member) => member.playerId === player.id);
      trackAnalytics(() =>
        analyticsEvents.roomJoined({
          room_id: room.id,
          player_id: player.id,
          room_version: roomVersion,
          join_method: joinMethod,
          room_role: roomRole,
          ...(seatIndex >= 0 ? { seat_index: seatIndex } : {}),
        }),
      );
    } else {
      const snapshot = await client.getRoom(room.id);
      joinedRoom = snapshot;
      joinedMembers = snapshot.members;
      roomVersion = snapshot.version ?? roomVersion;
    }
    dispatch({
      type: "roomJoined",
      room: {
        id: room.id,
        code: room.code,
        title: room.title,
        ownerPlayerId: joinedRoom.ownerPlayerId,
        turnIndex: joinedRoom.turnIndex,
        completedTurnCount: joinedRoom.completedTurnCount,
        currentSpeakerPlayerId: joinedRoom.currentSpeakerPlayerId,
        allTurnsCompleted: joinedRoom.allTurnsCompleted,
      },
      members: mapRoomMembers(joinedMembers, player),
    });
    await prepareRealMedia(room.id);
  };
  const reconnectMedia = async () => {
    if (!roomId || busy || mediaMode !== "real" || injectedMediaState) return;
    setRemoteSeats([]);
    const rtc = rtcRef.current;
    if (rtc) {
      await rtc.leave().catch(() => undefined);
    }
    await prepareRealMedia(roomId);
  };
  const fail = (error: unknown) => {
    setApiError(userFacingApiError(error));
  };
  const isRoomOwner =
    !state.room?.ownerPlayerId || state.room.ownerPlayerId === state.player?.id;
  const isMyTurn = Boolean(
    state.room?.currentSpeakerPlayerId && state.room.currentSpeakerPlayerId === state.player?.id,
  );
  const canEndRoom = isRoomOwner && state.room?.allTurnsCompleted === true;
  const auth = (nickname: string) => {
    if (busy) return;
    setApiError(undefined);
    setBusy(true);
    const startedAt = Date.now();
    void client
      .createGuestSession({ nickname: nickname.trim() || "Mint" })
      .then((player) => {
        trackAnalytics(() =>
          analyticsEvents.guestSessionCreated({
            guest_session_id: player.playerId,
            session_type: "guest",
            player_id: player.playerId,
            entry_point: "app_open",
            latency_ms: clampLatencyMs(startedAt),
          }),
        );
        maybeEmitAppOpened();
        dispatch({ type: "authenticated", player: { id: player.playerId, nickname: player.nickname } });
      })
      .catch((error: unknown) => {
        console.error("English Room API login failed:", error instanceof Error ? error.message : String(error));
        fail(error);
      })
      .finally(() => setBusy(false));
  };
  const create = () => {
    if (busy) return;
    setApiError(undefined);
    setBusy(true);
    const startedAt = Date.now();
    void client
      .createRoom({ title: "Harbor Mystery" })
      .then(async (room) => {
        const playerId = playerRef.current?.id;
        if (playerId) {
          trackAnalytics(() =>
            analyticsEvents.roomCreated({
              room_id: room.id,
              player_id: playerId,
              room_version: room.version ?? 1,
              room_role: "host",
              creation_mode: "quick_create",
              latency_ms: clampLatencyMs(startedAt),
            }),
          );
        }
        await enterRoomFlow(room, "invite", "host");
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };
  const joinByCode = (code: string) => {
    const playerId = state.player?.id;
    if (!playerId) {
        setApiError("Please enter as a guest first.");
      return;
    }
    if (typeof client.getAccessToken === "function" && !readRoomAccessToken(client)) {
      setApiError("Your guest session expired. Please enter as a Demo guest again.");
      return;
    }
    if (busy) return;
    setApiError(undefined);
    setBusy(true);
    void client
      .getRoomByCode(code)
      .then((room) => enterRoomFlow(room, "room_code", "member"))
      .catch(fail)
      .finally(() => setBusy(false));
  };
  const ready = () => {
    if (!roomId || busy) return;
    setApiError(undefined);
    setBusy(true);
    const nextReady = !state.ready;
    void (async () => {
      if (nextReady && mediaMode === "real" && !mediaReady(mediaState)) {
        if (injectedMediaState || !(await prepareRealMedia(roomId))) {
          return;
        }
      }
      const room = await client.setReady(roomId, nextReady);
        const playerId = playerRef.current?.id;
        if (playerId) {
          trackAnalytics(() =>
            analyticsEvents.roomReadyChanged({
              room_id: roomId,
              player_id: playerId,
              ready_state: nextReady ? "ready" : "not_ready",
              room_version: room.version ?? 1,
              change_source: "user",
            }),
          );
        }
        dispatch({
          type: "readyChanged",
          ready: nextReady,
          members: mapRoomMembers(room.members, playerRef.current),
        });
    })()
      .catch(fail)
      .finally(() => setBusy(false));
  };
  const start = () => {
    if (!roomId || busy || !isRoomOwner) return;
    setApiError(undefined);
    setBusy(true);
    const startedAt = Date.now();
    void client
      .startRoom(roomId)
      .then((room) => {
        trackAnalytics(() =>
          analyticsEvents.roomStarted({
            room_id: roomId,
            room_version: room.version ?? 1,
            member_count: room.members.length,
            ready_member_count: room.members.filter((member) => member.ready).length,
            started_by_player_id: playerRef.current?.id ?? room.members[0]?.playerId ?? "",
            start_mode: "host_action",
            latency_ms: clampLatencyMs(startedAt),
          }),
        );
        dispatch({
          type: "roomStarted",
          room: {
            turnIndex: room.turnIndex,
            completedTurnCount: room.completedTurnCount,
            currentSpeakerPlayerId: room.currentSpeakerPlayerId,
            allTurnsCompleted: room.allTurnsCompleted,
          },
        });
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };
  const completeTurn = () => {
    if (!roomId || busy || !isMyTurn) return;
    setApiError(undefined);
    setBusy(true);
    void (async () => {
      try {
        if (mediaMode === "real" && rtcRef.current) {
          await rtcRef.current.setMuted(true);
        }
        const next = await client.completeTurn(roomId);
        dispatch({
          type: "roomMembersUpdated",
          members: mapRoomMembers(next.members, playerRef.current),
          room: {
            turnIndex: next.turnIndex,
            completedTurnCount: next.completedTurnCount,
            currentSpeakerPlayerId: next.currentSpeakerPlayerId,
            allTurnsCompleted: next.allTurnsCompleted,
          },
        });
      } catch (error) {
        fail(error);
      } finally {
        setBusy(false);
      }
    })();
  };
  const end = () => {
    if (!roomId || busy || !canEndRoom) return;
    setApiError(undefined);
    setReportError(undefined);
    setBusy(true);
    void (async () => {
      try {
        // Backend end is the control-plane source of truth; media leave must not block it.
        if (mediaMode === "real" && rtcRef.current) {
          void rtcRef.current.leave().catch(() => undefined);
        }
        const ended = await client.endRoom(roomId);
        let nextRecording: MediaUiState["recording"] = "processing";
        let nextReport: MediaUiState["report"] = "processing";
        if (ended.status === "recording_failed") {
          nextRecording = "failed";
          nextReport = "failed";
          setLiveMedia((current) => ({ ...current, recording: nextRecording, report: nextReport }));
        } else {
          setLiveMedia((current) => ({ ...current, recording: nextRecording, report: nextReport }));
        }
        setReportItems([]);
        const playerId = playerRef.current?.id;
        if (playerId) {
          recordingSequenceRef.current += 1;
          trackAnalytics(() =>
            analyticsEvents.roomEnded({
              room_id: roomId,
              room_version: ended.version ?? 1,
              ended_by_player_id: playerId,
              end_reason: "host_action",
              member_count: ended.members.length,
            }),
          );
        }
        // Switch to the report immediately. The recording callback and score job are asynchronous;
        // polling continues in the background so a slow evaluator cannot make End feel stuck.
        reportLoadStartedRef.current = roomId;
        dispatch({ type: "roomEnded" });
        const report = await pollRoomReport(client, roomId);
        const items = visibleReportItems(report.items, mediaState.mode);
        setReportItems(items);
        if (reportPollingTimedOut(report)) {
          // The recording artifact is still considered available; only report generation timed out.
          nextRecording = "ready";
          nextReport = "failed";
          setReportError(REPORT_GENERATION_TIMEOUT_MESSAGE);
          setLiveMedia((current) => ({ ...current, recording: nextRecording, report: nextReport }));
        } else if (ended.status === "recording_failed") {
          // already failed above
        } else if (scoreJobsReady(items)) {
          nextRecording = "ready";
          nextReport = "ready";
          setLiveMedia((current) => ({ ...current, recording: nextRecording, report: nextReport }));
        } else if (scoreJobsTerminal(items)) {
          nextRecording = "ready";
          nextReport = "failed";
          setLiveMedia((current) => ({ ...current, recording: nextRecording, report: nextReport }));
        } else {
          nextRecording = "processing";
          nextReport = "processing";
          setLiveMedia((current) => ({ ...current, recording: nextRecording, report: nextReport }));
        }
        if (playerId) {
          trackAnalytics(() =>
            analyticsEvents.recordingStatusChanged({
              room_id: roomId,
              ...mapRecordingAnalyticsPayload(
                ended.status,
                { recording: nextRecording, report: nextReport },
                recordingSequenceRef.current,
              ),
            }),
          );
          trackAnalytics(() =>
            analyticsEvents.scoreReportViewed({
              room_id: roomId,
              player_id: playerId,
              report_state: mapScoreReportState(nextReport),
              entry_point: "room_end",
            }),
          );
        }
      } catch (error) {
        fail(error);
        setReportError("Could not load the report. Please try again.");
      } finally {
        setBusy(false);
      }
    })();
  };
  const refreshReport = () => {
    if (!roomId || busy) return;
    setBusy(true);
    setReportError(undefined);
    void pollRoomReport(client, roomId)
      .then((report) => {
        const items = visibleReportItems(report.items, mediaState.mode);
        setReportItems(items);
        if (reportPollingTimedOut(report)) {
          setLiveMedia((current) => ({ ...current, recording: "ready", report: "failed" }));
          setReportError(REPORT_GENERATION_TIMEOUT_MESSAGE);
          return;
        }
        if (scoreJobsReady(items)) {
          setLiveMedia((current) => ({ ...current, recording: "ready", report: "ready" }));
        } else if (scoreJobsTerminal(items)) {
          setLiveMedia((current) => ({ ...current, recording: "ready", report: "failed" }));
        } else {
          setLiveMedia((current) => ({ ...current, recording: "processing", report: "processing" }));
        }
      })
      .catch(() => setReportError("Could not load the report. Please try again."))
      .finally(() => setBusy(false));
  };
  const retry = (item: ReportItem) => {
    const startedAt = Date.now();
    void client
      .retryScoreJob(item.scoreJobId)
      .then((next) => {
        const playerId = playerRef.current?.id;
        if (playerId && roomId) {
          const attempt = (scoreRetryAttemptsRef.current.get(item.scoreJobId) ?? 0) + 1;
          scoreRetryAttemptsRef.current.set(item.scoreJobId, attempt);
          trackAnalytics(() =>
            analyticsEvents.scoreRetryRequested({
              room_id: roomId,
              player_id: playerId,
              score_job_id: item.scoreJobId,
              attempt_number: attempt,
              retry_reason: "user_action",
              latency_ms: clampLatencyMs(startedAt),
            }),
          );
        }
        setReportItems((items) =>
          items.map((current) => (current.scoreJobId === next.scoreJobId ? next : current)),
        );
      })
      .catch(() => setReportError("Could not load the report. Please try again."));
  };
  const pages: Record<Screen, React.ReactNode> = {
    login: <VisualAuthScreen busy={busy} mode="login" onLogin={auth} onToggle={() => dispatch({ type: "showRegister" })} />,
    register: <VisualAuthScreen busy={busy} mode="register" onLogin={auth} onToggle={() => dispatch({ type: "showLogin" })} />,
    lobby: <LobbyScreen busy={busy} mediaState={mediaState} onCreate={create} onJoin={joinByCode} />,
    waiting: (
      <WaitingScreen
        busy={busy}
        mediaState={mediaState}
        members={state.members}
        ready={state.ready}
        roomCode={state.room?.code}
        onLeave={leaveSession}
        onReady={ready}
        onReconnectMedia={() => {
          void reconnectMedia();
        }}
        onStart={start}
        isOwner={isRoomOwner}
      />
    ),
    live: (
      <LiveScreen
        busy={busy}
        localName={state.player?.nickname ?? "Me"}
        mediaState={mediaState}
        muted={muted}
        remotes={remoteSeats}
        speakerOn={speakerOn}
        onToggleMute={() => {
          void rtcRef.current?.setMuted(!muted);
        }}
        onToggleSpeaker={() => {
          void rtcRef.current?.setSpeaker(!speakerOn);
        }}
        onReconnectMedia={() => {
          void reconnectMedia();
        }}
        onEnd={end}
        allTurnsCompleted={state.room?.allTurnsCompleted === true}
        completedTurnCount={state.room?.completedTurnCount ?? 0}
        currentSpeakerPlayerId={state.room?.currentSpeakerPlayerId}
        localPlayerId={state.player?.id}
        onCompleteTurn={completeTurn}
        canEnd={canEndRoom}
        members={state.members}
      />
    ),
    report:
      mediaState.mode === "real" && mediaState.report === "processing" ? (
        <ReportLoadingScreen onDone={leaveSession} />
      ) : (
        <ReportScreen error={reportError} items={reportItems} mediaState={mediaState} onDone={leaveSession} onRefresh={refreshReport} onRetry={retry} />
      ),
  };
  const apiErrorPlacement = state.screen === "waiting" ? styles.apiErrorWaiting : state.screen === "live" ? styles.apiErrorLive : state.screen === "lobby" ? styles.apiErrorLobby : undefined;
  return <View style={styles.appRoot}>{pages[state.screen]}{apiError ? <View accessibilityLabel="API error" style={[styles.apiError, apiErrorPlacement]}><Text style={styles.apiErrorText}>{apiError}</Text></View> : null}</View>;
}

const styles = StyleSheet.create({
  appRoot: { flex: 1 },
  apiError: { backgroundColor: "#FFF7E6", borderColor: "#E5C27A", borderRadius: 12, borderWidth: 1, left: 16, paddingHorizontal: 14, paddingVertical: 9, position: "absolute", right: 16, zIndex: 10 },
  apiErrorLobby: { bottom: 78 },
  apiErrorLive: { bottom: 150 },
  apiErrorText: { color: "#684300", fontSize: 12, fontWeight: "700", textAlign: "center" },
  apiErrorWaiting: { bottom: 96 },
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
