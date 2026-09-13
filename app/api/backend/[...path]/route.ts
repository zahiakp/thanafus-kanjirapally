import { createHash, createHmac, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse, requireApiSession } from "../../../utils/apiAuth";
import { isRegistrationClosed } from "../../../utils/registration";
import { applyJudgeMarkPrivacy, judgeMarkVisibility } from "../../../utils/judgeMarkPrivacy";

const publicReadRoots = new Set(["programs", "results", "participants", "zoneprograms"]);
// Most program reads power public participant pages, but reset data contains
// audit history and must always carry the signed administrator session.
const privateProgramReadActions = new Set(["resetcandidates", "resethistory"]);

// Resources that stay private except for the named public actions. The public
// participant portal reads a single profile without a session.
const publicReadActions = new Map([["students", new Set(["profiledetails"])]]);

async function handleProxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const parts = (await context.params).path || [];
  if (!parts.length || parts.some((part) => !/^[a-zA-Z0-9._-]+$/.test(part))) return NextResponse.json({ success: false, message: "Invalid backend path" }, { status: 400 });
  const resource = parts[0].toLowerCase();
  const action = request.nextUrl.searchParams.get("action")?.toLowerCase() || "";
  if (resource === "participants" && action === "markupdate") {
    return NextResponse.json({ success: false, message: "Use the column-restricted mark API" }, { status: 410 });
  }

  const isJudgementRead = request.method === "GET" &&
    resource === "programs" &&
    request.nextUrl.searchParams.get("view") === "judgement";
  const isPublicRead = !isJudgementRead && request.method === "GET" &&
    !(resource === "programs" && privateProgramReadActions.has(action)) &&
    (publicReadRoots.has(resource) || Boolean(action && publicReadActions.get(resource)?.has(action)));
  const isCacheablePublicRead = isPublicRead && resource === "results";
  const session = isPublicRead ? null : await requireApiSession(isJudgementRead ? ["admin", "judge"] : undefined);
  const registrationResource = resource;
  const isRegistrationMutation =
    session?.role === "campus" &&
    ["students", "participants"].includes(registrationResource) &&
    (request.method === "DELETE" ||
      (["POST", "PUT", "PATCH"].includes(request.method) &&
        ["upload", "update", "bulkupload"].includes(action)));

  if (isRegistrationMutation && isRegistrationClosed()) {
    return NextResponse.json({ success: false, message: "Registration is closed" }, { status: 409 });
  }

  const base = process.env.BACKEND_URL;
  const apiKey = process.env.BACKEND_API_KEY;
  const signingSecret = process.env.BACKEND_SIGNING_SECRET;
  if (!base || !apiKey || !signingSecret) return NextResponse.json({ success: false, message: "Backend proxy is not configured" }, { status: 503 });

  const target = new URL(parts.join("/"), base.endsWith("/") ? base : `${base}/`);
  request.nextUrl.searchParams.forEach((value, key) => { if (key !== "api" && key !== "view") target.searchParams.append(key, value); });
  target.searchParams.set("api", apiKey);
  const body = ["GET", "HEAD"].includes(request.method) ? new Uint8Array() : new Uint8Array(await request.arrayBuffer());
  const timestamp = String(Math.floor(Date.now() / 1000));
  const actor = Buffer.from(JSON.stringify(session || { role: "public" })).toString("base64url");
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const canonical = [request.method, target.pathname, bodyHash, timestamp, actor].join("\n");
  const signature = createHmac("sha256", signingSecret).update(canonical).digest("base64url");

  const headers = new Headers({
    accept: request.headers.get("accept") || "application/json",
    "x-api-key": apiKey,
    "x-artivox-timestamp": timestamp,
    "x-artivox-actor": actor,
    "x-artivox-signature": signature,
  });
  if (!["GET", "HEAD"].includes(request.method)) {
    headers.set("idempotency-key", request.headers.get("idempotency-key") || randomUUID());
  }
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const upstream = await fetch(target, { method: request.method, headers, body: body.length ? body : undefined, redirect: "error", cache: "no-store" });
  const responseHeaders = new Headers({
    "content-type": upstream.headers.get("content-type") || "application/json",
    "Cache-Control": isCacheablePublicRead
      ? "public, max-age=15, stale-while-revalidate=60"
      : "private, no-store, max-age=0",
  });
  const requestId = upstream.headers.get("x-request-id");
  if (requestId) responseHeaders.set("x-request-id", requestId);
  const shouldRedactMarks = request.method === "GET" &&
    ["programs", "participants", "zoneprograms"].includes(resource) &&
    (upstream.headers.get("content-type") || "").includes("application/json");
  if (shouldRedactMarks) {
    const payload = await upstream.json();
    const visibility = isJudgementRead ? judgeMarkVisibility(session) : "hidden";
    return NextResponse.json(applyJudgeMarkPrivacy(payload, visibility), {
      status: upstream.status,
      headers: responseHeaders,
    });
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}

// Authentication, validation and upstream failures are translated into a JSON
// status here. Without this an ApiError surfaced as an opaque 500.
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    return await handleProxy(request, context);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
