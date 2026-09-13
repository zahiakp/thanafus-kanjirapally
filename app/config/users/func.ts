import { ROOT_URL } from "../../data/func";

export type AccessUser = {
  id: number;
  campusId: string | null;
  username: string;
  role: string;
  judgeSlot: 1 | 2 | 3 | null;
  isPrimary: boolean;
  isTeamManaged: boolean;
};

type AccessResponse<T> = {
  success: boolean;
  data?: T;
  total?: number;
  message?: string;
};

async function readResponse<T>(response: Response): Promise<AccessResponse<T>> {
  const result = (await response.json().catch(() => null)) as AccessResponse<T> | null;
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || "The user request could not be completed.");
  }
  return result;
}

export async function getAccessUsers(): Promise<AccessUser[]> {
  const response = await fetch(`${ROOT_URL}access/action.php`, {
    method: "GET",
    cache: "no-store",
  });
  const result = await readResponse<AccessUser[]>(response);
  return result.data || [];
}

export async function createAccessUser(values: { username: string; password: string; role: string; judgeSlot?: number | null }) {
  const response = await fetch(`${ROOT_URL}access/action.php?action=create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: values.username.trim(),
      password: values.password,
      role: values.role,
      campusId: values.judgeSlot ? String(values.judgeSlot) : "",
      judgeSlot: values.judgeSlot || null,
    }),
  });
  return readResponse<never>(response);
}

export async function updateAccessUser(
  user: AccessUser,
  values: { username: string; password?: string }
) {
  const payload: Record<string, string | number> = {
    id: user.id,
    username: values.username.trim(),
  };
  if (values.password) payload.password = values.password;

  const response = await fetch(`${ROOT_URL}access/action.php?action=update`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readResponse<never>(response);
}

export async function deleteAccessUser(user: AccessUser) {
  const response = await fetch(`${ROOT_URL}access/action.php`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: user.id }),
  });
  return readResponse<never>(response);
}
