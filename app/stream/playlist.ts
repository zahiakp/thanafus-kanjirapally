import { resultDuration } from "./resultReveal";
import type { StreamPublicState, StreamScenePayload } from "./types";
export const RESULT_REFRESH_MS = 300_000;
export type ResultPlaylist = {
  success: true; version: string; enabled: boolean; eventTitle: string;
  results: { id: number; payload: Extract<StreamScenePayload, { type: "result" }> }[];
};
export function playlistState(list: ResultPlaylist, tick: number, startedAt: string): StreamPublicState {
  const index = Math.floor(tick / 2) % Math.max(1, list.results.length);
  const result = list.enabled && list.results.length && tick % 2 === 0 ? list.results[index] : null;
  const payload: StreamScenePayload = result ? result.payload : {
    type: "idle", eventTitle: list.eventTitle, message: "Celebrating knowledge, talent and excellence",
  };
  return {
    success: true, changed: true, version: list.version, serverTime: startedAt, nextPollMs: RESULT_REFRESH_MS,
    enabled: list.enabled, scene: { key: String(tick) + "-" + (result?.id ?? "brand"), type: payload.type,
      startedAt, durationSeconds: result ? resultDuration(result.payload.winners) : 10, pinned: false, payload },
  };
}
