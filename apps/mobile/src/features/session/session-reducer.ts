export type Player = {
  id: string;
  nickname: string;
};

export type RoomMemberView = {
  playerId: string;
  nickname: string;
  ready: boolean;
};

export type RoomSummary = {
  id: string;
  code: string;
  title: string;
};

export type Screen = "login" | "register" | "lobby" | "waiting" | "live" | "report";

export type SessionState = {
  player?: Player;
  ready: boolean;
  room?: RoomSummary;
  members: RoomMemberView[];
  screen: Screen;
};

export type SessionAction =
  | { type: "authenticated"; player: Player }
  | { type: "roomJoined"; room: RoomSummary; members?: RoomMemberView[] }
  | { type: "readyChanged"; ready: boolean; members?: RoomMemberView[] }
  | { type: "roomMembersUpdated"; members: RoomMemberView[] }
  | { type: "roomStarted" }
  | { type: "roomEnded" }
  | { type: "showRegister" }
  | { type: "showLogin" }
  | { type: "leaveRoom" };

export const initialSessionState: SessionState = {
  ready: false,
  members: [],
  screen: "login",
};

export function sessionReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case "authenticated":
      return { ...state, player: action.player, screen: "lobby" };
    case "roomJoined":
      return { ...state, ready: false, room: action.room, members: action.members ?? [], screen: "waiting" };
    case "readyChanged":
      return {
        ...state,
        ready: action.ready,
        members: action.members ?? (state.members ?? []).map((member) =>
          member.playerId === state.player?.id ? { ...member, ready: action.ready } : member,
        ),
      };
    case "roomMembersUpdated":
      return { ...state, members: action.members };
    case "roomStarted":
      return { ...state, screen: "live" };
    case "roomEnded":
      return { ...state, screen: "report" };
    case "showRegister":
      return { ...state, screen: "register" };
    case "showLogin":
      return { ...state, screen: "login" };
    case "leaveRoom":
      return { ...state, ready: false, room: undefined, members: [], screen: "lobby" };
  }
}
