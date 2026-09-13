export type StreamSceneType = "idle" | "announcement" | "live" | "result" | "scoreboard" | "next";
export type StreamCueStatus = "queued" | "playing" | "completed" | "skipped";
export type StreamPriority = 10 | 30 | 40 | 50 | 70 | 80 | 90 | 100;

export type StreamProgramSummary = { id: number; name: string; category: string; status: string; order: number | null };
export type StreamEntrySummary = { id: number; chestNo: string; participantName: string; teamName: string; status: string };
export type StreamWinner = { name: string; team: string; rank: number; grade: string; points: number };
export type StreamTeamStanding = { name: string; shortName: string; points: number; rank: number };

export type StreamScenePayload =
  | { type: "idle"; eventTitle: string; message: string }
  | { type: "announcement"; eventTitle: string; title: string; message: string; urgent: boolean }
  | { type: "live"; eventTitle: string; program: string; category: string; participantName: string; chestNo: string; teamName: string; finished: number; total: number }
  | { type: "result"; eventTitle: string; program: string; category: string; winners: StreamWinner[] }
  | { type: "scoreboard"; eventTitle: string; teams: StreamTeamStanding[] }
  | { type: "next"; eventTitle: string; program: string; category: string };

export type StreamCue = {
  id: number; type: StreamSceneType; priority: number; durationSeconds: number;
  status: StreamCueStatus; programId: number | null; sourceKey: string | null;
  createdBy: string; createdAt: string; startsAt: string | null; endsAt: string | null;
};

export type StreamChannelState = {
  id: number; slug: string; name: string; enabled: boolean; automatic: boolean;
  version: number; eventTitle: string; liveProgramId: number | null; liveEntryId: number | null;
  nextProgramId: number | null; pinnedScene: StreamSceneType | null; tokenReady: boolean; updatedAt: string;
};

export type StreamPublicState = {
  success: true; changed: true; version: string; serverTime: string; nextPollMs: number;
  enabled: boolean; scene: { key: string; type: StreamSceneType; startedAt: string; durationSeconds: number; pinned: boolean; payload: StreamScenePayload };
};

export type StreamUnchangedState = { success: true; changed: false; version: string; serverTime: string; nextPollMs: number };

export type StreamAdminSnapshot = {
  success: true; channel: StreamChannelState; programs: StreamProgramSummary[]; entries: StreamEntrySummary[];
  resultPrograms: StreamProgramSummary[]; queue: StreamCue[]; history: StreamCue[]; preview: StreamPublicState;
};

export type StreamControlCommand =
  | { action: "toggle_enabled"; enabled: boolean }
  | { action: "toggle_automatic"; automatic: boolean }
  | { action: "set_event_title"; eventTitle: string }
  | { action: "set_live"; programId: number | null; entryId: number | null }
  | { action: "set_next"; programId: number | null }
  | { action: "queue_announcement"; title: string; message: string; urgent: boolean; duration: number; showNow: boolean; pin: boolean }
  | { action: "show_scene"; sceneType: "idle" | "live" | "scoreboard" | "next"; duration: number; pin: boolean }
  | { action: "show_result"; programId: number; duration: number; showNow: boolean }
  | { action: "skip" | "unpin" | "clear_queue" | "regenerate_token" };

