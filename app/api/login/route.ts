import { NextResponse } from "next/server";
import pool from "../../utils/mysqlDb";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "../../utils/session";
import { hashPassword, isPasswordHash, verifyPassword } from "../../utils/password";
import { objectBody, requiredString, RequestValidationError } from "../../utils/validation";
import { accessCookieName } from "../../data/branding";
import { judgeSlotFromScope, judgeSlotFromUsername } from "../../utils/judges";

const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
    return false;
  }
  current.count += 1;
  return current.count > 10;
}

export async function POST(request: Request) {
  let connection;
  try {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const key = forwarded || "unknown";
    if (isRateLimited(key)) return NextResponse.json({ success: false, message: "Too many login attempts" }, { status: 429 });

    const body = objectBody(await request.json());
    const username = requiredString(body, "username", 100);
    const password = requiredString(body, "password", 200);
    connection = await pool.getConnection();
    const [access]: any = await connection.execute(
      "SELECT username, role, password, campusId FROM access WHERE username = ? LIMIT 1",
      [username]
    );
    const user: any = access[0];
    if (!user || !(await verifyPassword(password, String(user.password)))) {
      return NextResponse.json({ success: false, message: "Invalid username or password" }, { status: 401 });
    }
    const reservedJudgeSlot = judgeSlotFromUsername(user.username);
    if (reservedJudgeSlot && user.role !== "judge") {
      return NextResponse.json({ success: false, message: "Account configuration is incomplete" }, { status: 403 });
    }

    let campus: any = null;
    if (user.role === "campus") {
      const [campuses]: any = await connection.execute(
        "SELECT jamiaNo, name, categories, strength FROM campus WHERE jamiaNo = ? LIMIT 1",
        [user.campusId]
      );
      campus = campuses[0];
      if (!campus) return NextResponse.json({ success: false, message: "Account configuration is incomplete" }, { status: 403 });
    }

    if (user.role !== "campus" && !isPasswordHash(String(user.password))) {
      try {
        await connection.execute("UPDATE access SET password = ? WHERE username = ?", [await hashPassword(password), username]);
      } catch (migrationError) {
        console.warn("Password hash migration failed; ensure access.password is VARCHAR(255)", migrationError);
      }
    }

    const profile = {
      username: user.username,
      role: user.role,
      campusId: user.campusId || null,
      judgeSlot: user.role === "judge" ? reservedJudgeSlot ?? judgeSlotFromScope(user.campusId) : null,
      ...(campus || {}),
    };
    const response = NextResponse.json({ data: profile, message: "Login successful", success: true });
    response.cookies.set(SESSION_COOKIE, await createSessionToken(profile), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    response.cookies.set(accessCookieName, JSON.stringify(profile), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    attempts.delete(key);
    return response;
  } catch (error: any) {
    const status = error instanceof RequestValidationError ? 400 : 500;
    if (status === 500) console.error("Login failed", error);
    return NextResponse.json({ message: status === 500 ? "Unable to log in" : error.message, success: false }, { status });
  } finally {
    connection?.release();
  }
}
