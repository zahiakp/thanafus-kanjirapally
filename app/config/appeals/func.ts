import { ROOT_URL } from "../../data/func";

export type AppealStatus = "pending" | "approved" | "rejected";
export type BondStatus = "unpaid" | "paid" | "refunded" | "forfeited";

export type Appeal = {
  id: number;
  participantId: number;
  participantCode: string | null;
  participantName: string;
  studentReference: string;
  programId: number;
  programName: string;
  programCategory: string;
  programStatus: string;
  targetCampusId: string;
  targetCampusName: string;
  appellantCampusId: string;
  appellantCampusName: string;
  comment: string;
  status: AppealStatus;
  bondStatus: BondStatus;
  remarks: string | null;
  createdAt: string;
  paidAt: string | null;
  decidedAt: string | null;
  bondSettledAt: string | null;
  decidedBy: string | null;
  updatedAt: string;
};

export type AppealProgram = { id: number; name: string; category: string; status: string };
export type AppealParticipant = {
  id: number;
  code: string | null;
  studentReference: string;
  participantName: string;
  campusId: string;
  campusName: string;
};

export type AppealListResponse = {
  data: Appeal[];
  total: number;
  page: number;
  limit: number;
  bondAmount: number;
  summary: { pending: number; unpaid: number; approved: number; rejected: number };
  filters: {
    programs: Array<{ id: number; name: string }>;
    campuses: Array<{ id: string; name: string }>;
  };
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${ROOT_URL}appeals/action.php${url}`, {
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) throw new Error(payload?.message || "Unable to complete the appeal request.");
  return payload as T;
}

export function getAppeals(params: URLSearchParams) {
  return request<AppealListResponse & { success: true }>(`?action=list&${params.toString()}`);
}

export function getEligiblePrograms() {
  return request<{ success: true; data: AppealProgram[]; bondAmount: number }>("?action=eligiblePrograms");
}

export async function getEligibleParticipants(programId: number) {
  const result = await request<{ success: true; data: AppealParticipant[] }>(`?action=eligibleParticipants&programId=${programId}`);
  return result.data;
}

export function createAppeal(participantId: number, comment: string) {
  return request<{ success: true; message: string }>("?action=create", {
    method: "POST",
    body: JSON.stringify({ participantId, comment }),
  });
}

export function updateAppeal(action: "markPaid" | "decide" | "settleBond", body: Record<string, unknown>) {
  return request<{ success: true; message: string }>(`?action=${action}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
