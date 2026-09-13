const encoder = new TextEncoder();

export const SESSION_COOKIE = "artivox-session";
export const SESSION_MAX_AGE = 60 * 60 * 8;

export type SessionUser = {
  username: string;
  role: string;
  campusId?: string | null;
  judgeSlot?: 1 | 2 | 3 | null;
  categories?: unknown;
  name?: string;
  jamiaNo?: string;
};

type SessionPayload = SessionUser & { exp: number };

function bytesToBase64Url(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const decoded = atob(base64);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be configured with at least 32 characters");
  return secret;
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(getSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export async function createSessionToken(user: SessionUser) {
  const payload: SessionPayload = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE };
  const encoded = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${encoded}.${await sign(encoded)}`;
}

export async function verifySessionToken(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return null;
  try {
    const expected = await sign(encoded);
    const left = encoder.encode(signature);
    const right = encoder.encode(expected);
    if (left.length !== right.length) return null;
    let mismatch = 0;
    for (let index = 0; index < left.length; index += 1) mismatch |= left[index] ^ right[index];
    if (mismatch !== 0) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded))) as SessionPayload;
    if (!payload.username || !payload.role || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
