import { NextResponse } from "next/server";
import { accessCookieName, brandName } from "../../data/branding";
import { SESSION_COOKIE } from "../../utils/session";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(accessCookieName);
  return response;
}
