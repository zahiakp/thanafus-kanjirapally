import { createHash, timingSafeEqual } from "crypto";
import pool from "../utils/mysqlDb";
import { ApiError } from "../utils/apiAuth";
import { brandName, categoryMap, certificateEventName } from "../data/branding";
import { RESULT_REFRESH_MS, type ResultPlaylist } from "./playlist";
type Cached = { expires: number; data: ResultPlaylist };
const runtime = globalThis as typeof globalThis & {
  resultPlaylistCache?: Cached; resultPlaylistPending?: Promise<Cached>;
};
async function loadResults(): Promise<Cached> {
  const [rows]: any = await pool.execute(
    "SELECT p.id, p.name, p.category, p.isGroup, r.student, r.code, r.rank, r.grade, r.point, s.name AS studentName, s.mekhala AS mekhala, c.name AS teamName " +
    "FROM programs p LEFT JOIN results r ON r.program = p.id AND r.rank BETWEEN 1 AND 2 " +
    "LEFT JOIN students s ON s.jamiaNo = SUBSTRING_INDEX(r.student, '&', 1) " +
    "LEFT JOIN campus c ON c.jamiaNo = s.campus " +
    "WHERE p.status = 'announced' ORDER BY p.id, r.rank DESC, s.name"
  );
  const programs = new Map<number, ResultPlaylist["results"][number]>();
  for (const row of rows) {
    const id = Number(row.id);
    let result = programs.get(id);
    if (!result) {
      result = { id, payload: { type: "result", eventTitle: "", program: String(row.name),
        category: categoryMap[String(row.category)] || String(row.category), winners: [] } };
      programs.set(id, result);
    }
    if (row.rank != null) result.payload.winners.push({
      name: String(row.studentName || "Code " + (row.code || row.student)) + (Number(row.isGroup) ? " & Party" : ""),
      team: String(row.teamName || ""), mekhala: String(row.mekhala || ""), rank: Number(row.rank), grade: String(row.grade || ""), points: Number(row.point || 0),
    });
  }
  const results = [...programs.values()];
  return { expires: Date.now() + RESULT_REFRESH_MS, data: { success: true, version: createHash("sha256").update(JSON.stringify(results)).digest("hex"),
    enabled: true, eventTitle: "", results } };
}
export async function getResultPlaylist(token: string, preview: boolean): Promise<ResultPlaylist> {
  const [channels]: any = await pool.execute("SELECT enabled, event_title, public_token_hash FROM stream_channels WHERE slug = 'main' LIMIT 1");
  const channel = channels[0];
  if (!channel) throw new ApiError("Configure the stream first.", 404);
  if (!preview) {
    const actual = createHash("sha256").update(token).digest();
    const expected = Buffer.from(String(channel.public_token_hash || ""), "hex");
    if (!token || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new ApiError("Display token is invalid", 401);
  }
  const eventTitle = String(channel.event_title || certificateEventName || brandName);
  if (!channel.enabled) return { success: true, version: "disabled", enabled: false, eventTitle, results: [] };
  if (!runtime.resultPlaylistCache || runtime.resultPlaylistCache.expires <= Date.now()) {
    if (!runtime.resultPlaylistPending) runtime.resultPlaylistPending = loadResults();
    try { runtime.resultPlaylistCache = await runtime.resultPlaylistPending; }
    finally { runtime.resultPlaylistPending = undefined; }
  }
  const data = runtime.resultPlaylistCache.data;
  return { ...data, eventTitle, results: data.results.map(result => ({ ...result, payload: { ...result.payload, eventTitle } })) };
}
