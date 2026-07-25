export type RtcConnectionState = "connected" | "reconnecting" | "disconnected";

export type RtcState = {
  joined: boolean;
  muted: boolean;
  connection: RtcConnectionState;
};

export interface RtcClient {
  join(input: { roomId: string; userId: string }): Promise<void>;
  leave(): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  setConnectionState(state: RtcConnectionState): Promise<void>;
  getState(): RtcState;
}

export class FakeRtcClient implements RtcClient {
  private state: RtcState = {
    joined: false,
    muted: false,
    connection: "disconnected",
  };

  async join(_input: { roomId: string; userId: string }): Promise<void> {
    this.state = { ...this.state, joined: true, connection: "connected" };
  }

  async leave(): Promise<void> {
    this.state = { ...this.state, joined: false, connection: "disconnected" };
  }

  async setMuted(muted: boolean): Promise<void> {
    this.state = { ...this.state, muted };
  }

  async setConnectionState(connection: RtcConnectionState): Promise<void> {
    this.state = { ...this.state, connection };
  }

  getState(): RtcState {
    return this.state;
  }
}
