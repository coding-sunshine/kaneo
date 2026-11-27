import { create } from "zustand";

export type CallTarget = {
  workspaceId: string;
  channelId: string;
  channelName: string;
};

export type CallSession = CallTarget & {
  serverUrl: string;
  roomName: string;
  token: string;
};

type CallStore = {
  session: CallSession | null;
  setSession: (session: CallSession | null) => void;
};

/** The call this tab is in; one at a time. */
export const useCallStore = create<CallStore>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}));
