import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { accessCookieName, brandName } from "./app/data/branding";
import { SESSION_COOKIE, verifySessionToken } from "./app/utils/session";

const pagePermissions: Record<string, string[]> = {
  "/config/appeals": ["admin", "campus"],
  "/campus": ["admin"],
  "/judgement": ["admin", "judge"],
  "/topics": ["admin", "judge"],
  "/results": ["admin", "announce"],
  "/students": ["campus"],
  "/manage": ["admin", "report"],
  "/award": ["admin", "award", "result"],
  "/programs": ["admin", "campus"],
  "/published": ["admin", "announce"],
  "/config": ["admin"],
  "/config/stream": ["admin"],
};

const apiPermissions: Record<string, string[]> = {
  "/api/campus": ["admin"],
  "/api/students": ["admin", "campus"],
  "/api/topics": ["admin", "judge"],
  "/api/programs": ["admin", "campus", "judge", "report", "announce", "award", "result"],
  "/api/programList/addMark": ["admin", "judge"],
  "/api/programList/assignCode": ["admin", "report"],
  "/api/programList/assignTopic": ["admin", "judge"],
  "/api/programList": ["admin", "campus", "judge", "report", "announce", "award", "result"],
  "/api/delete": ["admin", "campus"],
  "/api/updateCount": ["admin"],
  "/api/updateResult": ["admin", "announce"],
  "/api/result": ["admin", "judge", "announce", "award", "result"],
  "/api/awarded": ["admin", "award", "result"],
  "/api/writeFile": ["admin"],
  "/api/export": ["admin"],
  "/api/stream": ["admin"],
};

const publicPages = ["/login", "/unauthorized", "/participant", "/stream/main"];
const publicApis = ["/api/login", "/api/result/announced", "/api/result/campus", "/api/result/students", "/api/backend", "/api/stream/state", "/api/leaderboard"];

function permissionFor(pathname: string, map: Record<string, string[]>) {
  return Object.entries(map)
    .sort(([left], [right]) => right.length - left.length)
    .find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1];
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApi = pathname.startsWith("/api/");
  const isPublic = (isApi ? publicApis : publicPages).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isApi && request.method !== "GET") {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 1_000_000) return jsonError("Request body is too large", 413);
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) return jsonError("Cross-origin request rejected", 403);
  }

  if (isPublic) return NextResponse.next();

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (isApi) return jsonError("Authentication required", 401);
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(SESSION_COOKIE);
    response.cookies.delete(accessCookieName);
    return response;
  }

  if (pathname === "/login") return NextResponse.redirect(new URL("/", request.url));

  const allowed = permissionFor(pathname, isApi ? apiPermissions : pagePermissions);
  if (allowed && !allowed.includes(session.role)) {
    return isApi
      ? jsonError("You do not have permission to perform this action", 403)
      : NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", isApi ? "private, no-store" : "private, no-cache");

  // Recover the client-only profile after cookie-name migrations or manual
  // deletion. Authorization continues to use only the signed HttpOnly session.
  if (!request.cookies.get(accessCookieName)) {
    const { exp, ...profile } = session;
    response.cookies.set(accessCookieName, JSON.stringify(profile), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: Math.max(1, exp - Math.floor(Date.now() / 1000)),
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|images|results|certificate|favicon.ico|eventpro-logo.png|meelad-logo.png|mmp-logo.png|letter-head.png|letter-head-2.png|fonts|public).*)"],
};
