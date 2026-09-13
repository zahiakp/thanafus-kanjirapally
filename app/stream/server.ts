import { createHash, randomBytes, timingSafeEqual } from "crypto";
import pool from "../utils/mysqlDb";
import { ApiError } from "../utils/apiAuth";
import { brandName, categoryMap, certificateEventName } from "../data/branding";
import {
  StreamAdminSnapshot, StreamChannelState, StreamControlCommand, StreamCue,
  StreamPublicState, StreamScenePayload, StreamSceneType, StreamUnchangedState,
} from "./types";

const MAIN_SLUG = "main";
const POLL_MS = 3_000;

const text = (value: unknown) => value == null ? "" : String(value);
const numberOrNull = (value: unknown) => value == null || value === "" ? null : Number(value);
const iso = (value: unknown) => new Date(value as string | number | Date).toISOString();
const labelCategory = (value: unknown) => categoryMap[text(value)] || text(value).toUpperCase();
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const safeJson = (value: unknown) => {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  try { return JSON.parse(String(value)) as Record<string, unknown>; } catch { return {}; }
};

function schemaError(error: unknown): never {
  const code = (error as { code?: string })?.code;
  if (["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"].includes(code || "")) {
    throw new ApiError("Stream database tables are not installed. Run database/stream-schema.sql first.", 503);
  }
  throw error;
}

function channelState(row: any): StreamChannelState {
  return {
    id: Number(row.id), slug: text(row.slug), name: text(row.name), enabled: Boolean(row.enabled),
    automatic: Boolean(row.automatic), version: Number(row.version), eventTitle: text(row.event_title),
    liveProgramId: numberOrNull(row.live_program_id), liveEntryId: numberOrNull(row.live_entry_id),
    nextProgramId: numberOrNull(row.next_program_id), pinnedScene: row.pinned_scene || null,
    tokenReady: Boolean(row.public_token_hash), updatedAt: iso(row.updated_at),
  };
}

function cueState(row: any): StreamCue {
  return {
    id: Number(row.id), type: row.type, priority: Number(row.priority), durationSeconds: Number(row.duration_seconds),
    status: row.status, programId: numberOrNull(row.program_id), sourceKey: row.source_key || null,
    createdBy: text(row.created_by), createdAt: iso(row.created_at),
    startsAt: row.starts_at ? iso(row.starts_at) : null, endsAt: row.ends_at ? iso(row.ends_at) : null,
  };
}

async function ensureMainChannel() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing]: any = await connection.execute("SELECT * FROM stream_channels WHERE slug = ? FOR UPDATE", [MAIN_SLUG]);
    let channel = existing[0];
    if (!channel) {
      await connection.execute(
        "INSERT INTO stream_channels (slug, name, event_title, enabled, automatic, updated_by) VALUES (?, ?, ?, 0, 1, 'system')",
        [MAIN_SLUG, "Main Stage", certificateEventName || brandName],
      );
      const [created]: any = await connection.execute("SELECT * FROM stream_channels WHERE slug = ?", [MAIN_SLUG]);
      channel = created[0];
      await connection.execute(
        `INSERT IGNORE INTO stream_cues
          (channel_id, type, priority, duration_seconds, source_key, program_id, status, created_by, starts_at, ends_at)
         SELECT ?, 'result', 80, 20, CONCAT('result:', p.id), p.id, 'completed', 'system', NOW(3), NOW(3)
           FROM programs p WHERE p.status = 'announced'`,
        [channel.id],
      );
    }
    await connection.commit();
    return channel;
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    schemaError(error);
  } finally {
    connection.release();
  }
}

async function syncNewResults(channel: any) {
  if (!channel.enabled || !channel.automatic) return;
  const [result]: any = await pool.execute(
    `INSERT IGNORE INTO stream_cues
      (channel_id, type, priority, duration_seconds, source_key, program_id, status, created_by)
     SELECT ?, 'result', 80, 20, CONCAT('result:', p.id), p.id, 'queued', 'system'
       FROM programs p
  LEFT JOIN stream_cues c ON c.channel_id = ? AND c.source_key = CONCAT('result:', p.id)
      WHERE p.status = 'announced' AND c.id IS NULL
      ORDER BY COALESCE(p.\`order\`, 2147483647), p.id
      LIMIT 5`,
    [channel.id, channel.id],
  );
  if (Number(result.affectedRows) > 0) {
    await pool.execute("UPDATE stream_channels SET version = version + 1, updated_by = 'system' WHERE id = ?", [channel.id]);
  }
}

async function advanceCue(channelId: number) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [channels]: any = await connection.execute("SELECT * FROM stream_channels WHERE id = ? FOR UPDATE", [channelId]);
    const channel = channels[0];
    if (!channel) throw new ApiError("Stream channel not found", 404);
    let changed = false;
    if (!channel.pinned_scene) {
      const [expired]: any = await connection.execute(
        "UPDATE stream_cues SET status = 'completed' WHERE channel_id = ? AND status = 'playing' AND ends_at IS NOT NULL AND ends_at <= NOW(3)",
        [channelId],
      );
      changed = Number(expired.affectedRows) > 0;
    }
    let [playing]: any = await connection.execute(
      "SELECT * FROM stream_cues WHERE channel_id = ? AND status = 'playing' ORDER BY starts_at DESC, id DESC LIMIT 1",
      [channelId],
    );
    if (!playing[0] && channel.enabled) {
      const [queued]: any = await connection.execute(
        "SELECT * FROM stream_cues WHERE channel_id = ? AND status = 'queued' ORDER BY priority DESC, created_at, id LIMIT 1 FOR UPDATE",
        [channelId],
      );
      if (queued[0]) {
        await connection.execute(
          "UPDATE stream_cues SET status = 'playing', starts_at = NOW(3), ends_at = DATE_ADD(NOW(3), INTERVAL ? SECOND) WHERE id = ?",
          [queued[0].duration_seconds, queued[0].id],
        );
        changed = true;
        [playing] = await connection.execute("SELECT * FROM stream_cues WHERE id = ?", [queued[0].id]);
      }
    }
    if (changed) await connection.execute("UPDATE stream_channels SET version = version + 1 WHERE id = ?", [channelId]);
    await connection.commit();
    return { channel: { ...channel, version: Number(channel.version) + (changed ? 1 : 0) }, cue: playing[0] || null };
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

async function idlePayload(eventTitle: string, message = "Celebrating knowledge, talent and excellence"): Promise<StreamScenePayload> {
  return { type: "idle", eventTitle, message };
}

async function resultPayload(programId: number, eventTitle: string): Promise<StreamScenePayload> {
  const [programs]: any = await pool.execute(
    "SELECT id, name, category, isGroup FROM programs WHERE id = ? AND status = 'announced' LIMIT 1", [programId],
  );
  if (!programs[0]) return idlePayload(eventTitle, "The selected result is not publicly announced");
  const [rows]: any = await pool.execute(
    `SELECT r.student, r.code, r.rank, r.grade, r.point, s.name AS studentName, c.name AS teamName
       FROM results r
  LEFT JOIN students s ON s.jamiaNo = SUBSTRING_INDEX(r.student, '&', 1)
  LEFT JOIN campus c ON c.jamiaNo = s.campus
      WHERE r.program = ? AND r.rank BETWEEN 1 AND 2
      ORDER BY r.rank DESC, s.name`,
    [programId],
  );
  return {
    type: "result", eventTitle, program: text(programs[0].name), category: labelCategory(programs[0].category),
    winners: rows.map((row: any) => ({
      name: `${text(row.studentName) || `Code ${text(row.code) || text(row.student)}`}${Number(programs[0].isGroup) ? " & Party" : ""}`,
      team: text(row.teamName), rank: Number(row.rank), grade: text(row.grade), points: Number(row.point || 0),
    })),
  };
}

async function scoreboardPayload(eventTitle: string): Promise<StreamScenePayload> {
  const [rows]: any = await pool.execute(
    `SELECT COALESCE(c.name, l.team_id) AS name, COALESCE(c.shortName, '') AS shortName, l.point AS points
       FROM leaderboard l
  LEFT JOIN campus c ON c.jamiaNo = l.team_id
      ORDER BY l.point DESC, name
      LIMIT 10`,
  );
  let previous: number | null = null; let rank = 0;
  const teams = rows.map((row: any, index: number) => {
    const points = Number(row.points || 0);
    if (points !== previous) rank = index + 1;
    previous = points;
    return { name: text(row.name), shortName: text(row.shortName), points, rank };
  });
  return { type: "scoreboard", eventTitle, teams };
}

async function programPayload(type: "live" | "next", programId: number | null, entryId: number | null, eventTitle: string): Promise<StreamScenePayload> {
  if (!programId) return idlePayload(eventTitle, type === "live" ? "No live program selected" : "The next program will appear shortly");
  const [programs]: any = await pool.execute("SELECT id, name, category FROM programs WHERE id = ? LIMIT 1", [programId]);
  const program = programs[0];
  if (!program) return idlePayload(eventTitle, "Program information is unavailable");
  if (type === "next") return { type: "next", eventTitle, program: text(program.name), category: labelCategory(program.category) };
  const [[counts]]: any = await pool.execute(
    "SELECT COUNT(*) AS total, SUM(status = 'finished') AS finished FROM programlist WHERE program = ?", [programId],
  );
  const [entries]: any = entryId
    ? await pool.execute("SELECT id, student, campus, code FROM programlist WHERE id = ? AND program = ? LIMIT 1", [entryId, programId])
    : await pool.execute("SELECT id, student, campus, code FROM programlist WHERE program = ? AND status = 'reported' ORDER BY id LIMIT 1", [programId]);
  const entry = entries[0];
  let participantName = "Waiting for participant"; let chestNo = ""; let teamName = "";
  if (entry) {
    const ids = text(entry.student).split(/[&,]/).map((value) => value.trim()).filter(Boolean);
    chestNo = text(entry.code) || ids.join(", ");
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      const [students]: any = await pool.execute(`SELECT jamiaNo, name FROM students WHERE jamiaNo IN (${placeholders})`, ids);
      const names = new Map(students.map((student: any) => [text(student.jamiaNo), text(student.name)]));
      participantName = ids.map((id) => names.get(id) || `Participant ${id}`).join(" & ");
    }
    const [teams]: any = await pool.execute("SELECT name FROM campus WHERE jamiaNo = ? LIMIT 1", [entry.campus]);
    teamName = text(teams[0]?.name);
  }
  return {
    type: "live", eventTitle, program: text(program.name), category: labelCategory(program.category),
    participantName, chestNo, teamName, finished: Number(counts?.finished || 0), total: Number(counts?.total || 0),
  };
}

function automaticScene(channel: any) {
  const scenes: Array<{ type: StreamSceneType; duration: number }> = [{ type: "scoreboard", duration: 16 }];
  if (channel.live_program_id) scenes.push({ type: "live", duration: 15 });
  if (channel.next_program_id) scenes.push({ type: "next", duration: 12 });
  scenes.push({ type: "idle", duration: 10 });
  const epoch = new Date(channel.cycle_epoch).getTime();
  const cycle = scenes.reduce((sum, scene) => sum + scene.duration, 0);
  const elapsed = Math.max(0, (Date.now() - epoch) / 1000);
  const cycleStart = elapsed - (elapsed % cycle);
  let offset = elapsed % cycle;
  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    if (offset < scene.duration) return { ...scene, slot: Math.floor(elapsed / cycle) * scenes.length + index, startedAt: new Date(epoch + (cycleStart + (elapsed % cycle) - offset) * 1000).toISOString() };
    offset -= scene.duration;
  }
  return { type: "idle" as const, duration: 10, slot: 0, startedAt: new Date().toISOString() };
}

async function payloadFor(type: StreamSceneType, channel: any, cue: any | null): Promise<StreamScenePayload> {
  const eventTitle = text(channel.event_title) || certificateEventName || brandName;
  if (type === "result") return resultPayload(Number(cue?.program_id || 0), eventTitle);
  if (type === "scoreboard") return scoreboardPayload(eventTitle);
  if (type === "live") return programPayload("live", numberOrNull(channel.live_program_id), numberOrNull(channel.live_entry_id), eventTitle);
  if (type === "next") return programPayload("next", numberOrNull(channel.next_program_id), null, eventTitle);
  if (type === "announcement") {
    const data = safeJson(cue?.payload_json);
    return { type, eventTitle, title: text(data.title), message: text(data.message), urgent: Boolean(data.urgent) };
  }
  return idlePayload(eventTitle);
}

async function currentPublicState(channelRow: any): Promise<StreamPublicState> {
  await syncNewResults(channelRow);
  const { channel, cue } = await advanceCue(Number(channelRow.id));
  let type: StreamSceneType; let duration: number; let startedAt: string; let key: string; let pinned = false;
  if (!channel.enabled) {
    type = "idle"; duration = 10; startedAt = new Date().toISOString(); key = `disabled-${channel.version}`;
  } else if (cue) {
    type = cue.type; duration = Number(cue.duration_seconds); startedAt = iso(cue.starts_at || new Date()); key = `cue-${cue.id}`; pinned = Boolean(channel.pinned_scene);
  } else if (channel.automatic) {
    const scene = automaticScene(channel); type = scene.type; duration = scene.duration; startedAt = scene.startedAt; key = `auto-${scene.slot}-${scene.type}`;
  } else {
    type = "idle"; duration = 10; startedAt = new Date().toISOString(); key = `manual-idle-${channel.version}`;
  }
  const version = `${channel.version}:${key}`;
  return {
    success: true, changed: true, version, serverTime: new Date().toISOString(), nextPollMs: POLL_MS,
    enabled: Boolean(channel.enabled), scene: { key, type, startedAt, durationSeconds: duration, pinned, payload: await payloadFor(type, channel, cue) },
  };
}

async function validateToken(channel: any, rawToken: string) {
  if (!channel.public_token_hash || !rawToken) throw new ApiError("A valid display token is required", 401);
  const actual = Buffer.from(tokenHash(rawToken), "hex");
  const expected = Buffer.from(text(channel.public_token_hash), "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new ApiError("Display token is invalid", 401);
}

export async function getStreamState(knownVersion: string | undefined, rawToken?: string, adminPreview = false): Promise<StreamPublicState | StreamUnchangedState> {
  try {
    const channel = await ensureMainChannel();
    if (!adminPreview) await validateToken(channel, rawToken || "");
    const state = await currentPublicState(channel);
    if (knownVersion && knownVersion === state.version) {
      return { success: true, changed: false, version: state.version, serverTime: state.serverTime, nextPollMs: POLL_MS };
    }
    return state;
  } catch (error) { schemaError(error); }
}

export async function getStreamAdmin(programId?: number): Promise<StreamAdminSnapshot> {
  try {
    let channel = await ensureMainChannel();
    const preview = await currentPublicState(channel);
    const [fresh]: any = await pool.execute("SELECT * FROM stream_channels WHERE id = ?", [channel.id]);
    channel = fresh[0];
    const entryProgram = programId || numberOrNull(channel.live_program_id);
    const [programs]: any = await pool.execute("SELECT id, name, category, status, `order` FROM programs ORDER BY category, name");
    const [entries]: any = entryProgram ? await pool.execute(
      `SELECT pl.id, pl.student, pl.code, pl.status, c.name AS teamName,
              COALESCE(s.name, CONCAT('Participant ', SUBSTRING_INDEX(pl.student, '&', 1))) AS participantName
         FROM programlist pl
    LEFT JOIN students s ON s.jamiaNo = SUBSTRING_INDEX(pl.student, '&', 1)
    LEFT JOIN campus c ON c.jamiaNo = pl.campus
        WHERE pl.program = ? ORDER BY pl.id`, [entryProgram],
    ) : [[]];
    const [queue]: any = await pool.execute("SELECT * FROM stream_cues WHERE channel_id = ? AND status IN ('queued','playing') ORDER BY status = 'playing' DESC, priority DESC, created_at LIMIT 50", [channel.id]);
    const [history]: any = await pool.execute("SELECT * FROM stream_cues WHERE channel_id = ? AND status IN ('completed','skipped') ORDER BY updated_at DESC LIMIT 30", [channel.id]);
    const mappedPrograms = programs.map((item: any) => ({ id: Number(item.id), name: text(item.name), category: labelCategory(item.category), status: text(item.status), order: numberOrNull(item.order) }));
    return {
      success: true, channel: channelState(channel), programs: mappedPrograms,
      entries: entries.map((item: any) => ({ id: Number(item.id), chestNo: text(item.code) || text(item.student).split(/[&,]/).join(", "), participantName: text(item.participantName) + (text(item.student).includes("&") ? " & Party" : ""), teamName: text(item.teamName), status: text(item.status) })),
      resultPrograms: mappedPrograms.filter((program: any) => program.status === "announced"),
      queue: queue.map(cueState), history: history.map(cueState), preview,
    };
  } catch (error) { schemaError(error); }
}

async function putCue(connection: any, channel: any, values: { type: StreamSceneType; priority: number; duration: number; programId?: number; payload?: unknown; showNow: boolean; pin?: boolean }) {
  if (values.showNow) await connection.execute("UPDATE stream_cues SET status = 'completed', ends_at = NOW(3) WHERE channel_id = ? AND status = 'playing'", [channel.id]);
  const status = values.showNow ? "playing" : "queued";
  const [result]: any = await connection.execute(
    `INSERT INTO stream_cues (channel_id, type, priority, duration_seconds, program_id, payload_json, status, starts_at, ends_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ${values.showNow ? "NOW(3)" : "NULL"}, ${values.showNow && !values.pin ? "DATE_ADD(NOW(3), INTERVAL ? SECOND)" : "NULL"}, ?)`,
    [channel.id, values.type, values.priority, values.duration, values.programId || null, values.payload ? JSON.stringify(values.payload) : null, status, ...(values.showNow && !values.pin ? [values.duration] : []), channel.updated_by],
  );
  if (values.pin) await connection.execute("UPDATE stream_channels SET pinned_scene = ? WHERE id = ?", [values.type, channel.id]);
  return Number(result.insertId);
}

export async function controlStream(command: StreamControlCommand, username: string) {
  const channel = await ensureMainChannel();
  const connection = await pool.getConnection();
  let token: string | undefined;
  try {
    await connection.beginTransaction();
    const [rows]: any = await connection.execute("SELECT * FROM stream_channels WHERE id = ? FOR UPDATE", [channel.id]);
    const locked = { ...rows[0], updated_by: username };
    if (command.action === "toggle_enabled") await connection.execute("UPDATE stream_channels SET enabled = ?, updated_by = ? WHERE id = ?", [command.enabled ? 1 : 0, username, locked.id]);
    else if (command.action === "toggle_automatic") await connection.execute("UPDATE stream_channels SET automatic = ?, cycle_epoch = NOW(3), updated_by = ? WHERE id = ?", [command.automatic ? 1 : 0, username, locked.id]);
    else if (command.action === "set_event_title") await connection.execute("UPDATE stream_channels SET event_title = ?, updated_by = ? WHERE id = ?", [command.eventTitle, username, locked.id]);
    else if (command.action === "set_live") {
      if (command.entryId && !command.programId) throw new ApiError("Select a live program before selecting a participant", 400);
      if (command.entryId) {
        const [entry]: any = await connection.execute("SELECT id FROM programlist WHERE id = ? AND program = ? LIMIT 1", [command.entryId, command.programId]);
        if (!entry[0]) throw new ApiError("The participant does not belong to the selected program", 400);
      }
      await connection.execute("UPDATE stream_channels SET live_program_id = ?, live_entry_id = ?, cycle_epoch = NOW(3), updated_by = ? WHERE id = ?", [command.programId, command.entryId, username, locked.id]);
    } else if (command.action === "set_next") await connection.execute("UPDATE stream_channels SET next_program_id = ?, cycle_epoch = NOW(3), updated_by = ? WHERE id = ?", [command.programId, username, locked.id]);
    else if (command.action === "queue_announcement") await putCue(connection, locked, { type: "announcement", priority: command.urgent ? 100 : command.showNow ? 90 : 70, duration: command.duration, payload: { title: command.title, message: command.message, urgent: command.urgent }, showNow: command.showNow || command.pin, pin: command.pin });
    else if (command.action === "show_scene") await putCue(connection, locked, { type: command.sceneType, priority: 90, duration: command.duration, showNow: true, pin: command.pin });
    else if (command.action === "show_result") {
      const [program]: any = await connection.execute("SELECT id FROM programs WHERE id = ? AND status = 'announced' LIMIT 1", [command.programId]);
      if (!program[0]) throw new ApiError("Only announced results can be streamed", 400);
      await putCue(connection, locked, { type: "result", priority: command.showNow ? 90 : 80, duration: command.duration, programId: command.programId, showNow: command.showNow });
    } else if (command.action === "skip" || command.action === "unpin") {
      await connection.execute("UPDATE stream_cues SET status = ?, ends_at = NOW(3) WHERE channel_id = ? AND status = 'playing'", [command.action === "skip" ? "skipped" : "completed", locked.id]);
      await connection.execute("UPDATE stream_channels SET pinned_scene = NULL, updated_by = ? WHERE id = ?", [username, locked.id]);
    } else if (command.action === "clear_queue") await connection.execute("UPDATE stream_cues SET status = 'skipped' WHERE channel_id = ? AND status = 'queued'", [locked.id]);
    else if (command.action === "regenerate_token") {
      token = randomBytes(32).toString("base64url");
      await connection.execute("UPDATE stream_channels SET public_token_hash = ?, updated_by = ? WHERE id = ?", [tokenHash(token), username, locked.id]);
    }
    await connection.execute("UPDATE stream_channels SET version = version + 1, updated_by = ? WHERE id = ?", [username, locked.id]);
    await connection.commit();
    return { success: true, token };
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    schemaError(error);
  } finally {
    connection.release();
  }
}

