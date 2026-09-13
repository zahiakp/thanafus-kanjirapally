import { ROOT_URL } from "../../data/func";

export type ProgramStatus = "pending" | "reporting" | "ongoing" | "finished" | "judged" | "resulted" | "announced";
export type ResetOperations = {
  clearOrder: boolean;
  clearCodes: boolean;
  participantStatus: boolean;
  clearMarks: boolean;
  clearTopics: boolean;
  clearResults: boolean;
  clearResultStatuses: boolean;
};
export type OptionalResetOperations = Partial<ResetOperations>;
export type ResetProgram = { id: number; name: string; category: string; status: ProgramStatus };
export type ResetHistory = {
  id: number; program_id: number; program_name: string; actor_id: string; source_status: ProgramStatus; target_status: ProgramStatus;
  operations: ResetOperations & { participantStatusValue?: string }; summary: Record<string, number>; created_at: string;
  undone_at: string | null; undone_by: string | null; undoAvailable: boolean;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${ROOT_URL}programs/action.php?action=${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) throw new Error(body.message || "Request failed");
  return body as T;
}

function mutation(body: object): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body),
  };
}

export async function getResetPrograms(search = "") {
  return request<{ data: ResetProgram[]; total: number }>(`resetCandidates&limit=100&search=${encodeURIComponent(search)}`);
}
export async function getResetHistory() { return request<{ data: ResetHistory[] }>("resetHistory&limit=100"); }
export async function resetProgram(programId: number, targetStatus: ProgramStatus, operations: OptionalResetOperations = {}) {
  return request<{ summary: Record<string, number> }>("reset", mutation({ programId, targetStatus, operations }));
}
export async function undoProgramReset(historyId: number) { return request("undoReset", mutation({ historyId })); }