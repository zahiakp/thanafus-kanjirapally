import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

function load(path, imports = {}) {
  const source = readFileSync(new URL(`../app/${path.startsWith("api/") ? path : "utils/" + path}.ts`, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("require", "exports", js)((name) => {
    if (name in imports) return imports[name];
    if (name === "./mapsLink" || name === "./timelineReorder") return load(name.slice(2));
    return { ApiError };
  }, exports);
  return exports;
}

const { checkSlot, moveProgram, readSchedule, saveTimelineOrder, scheduleDate, selectQueue, swapTimes } = load("venueSchedule");
const { reorderTimeline, timelineKey, timelineOrderAtGap } = load("timelineReorder");
const venueAccess = load("venueAccess");
const { assertProgramVenue, programVenueFilter } = venueAccess;
const { venueLocation } = load("venueLocation");
const date = "2026-11-14";

const timeline = () => [
  { programId: 1, eventId: null, status: "pending", position: 1, time: "08:00", duration: 30 },
  { programId: null, eventId: 1, kind: "break", position: 2, time: "08:40", duration: 15 },
  { programId: 2, eventId: null, status: "reporting", position: 3, time: "09:00", duration: 45 },
  { programId: 3, eventId: null, status: "pending", position: 4, time: "10:00", duration: 15 },
];

test("timeline inserts an event at a gap and previews times using durations and existing gaps", () => {
  const rows = timeline();
  const order = timelineOrderAtGap(rows, 1, 4);
  assert.deepEqual(order, ["program:1", "program:2", "program:3", "event:1"]);
  const preview = reorderTimeline(rows, order);
  assert.deepEqual(preview.map(row => [timelineKey(row), row.time, row.position]), [
    ["program:1", "08:00", 1], ["program:2", "08:40", 2], ["program:3", "09:30", 3], ["event:1", "10:00", 4],
  ]);
  assert.equal(rows[1].time, "08:40");
  assert.equal(timelineOrderAtGap(rows, 1, 1), undefined);
  assert.equal(timelineOrderAtGap(rows, 1, 2), undefined);
  const next = timelineOrderAtGap(preview, 3, 0);
  const combined = reorderTimeline(rows, next);
  assert.deepEqual(combined.map(row => row.time), ["08:00", "08:25", "09:00", "10:00"]);
  assert.deepEqual(reorderTimeline(rows, rows.map(timelineKey)), rows);
});

test("timeline keeps started and untimed programs fixed and rejects foreign keys", () => {
  const rows = timeline();
  rows[2].status = "ongoing";
  rows[3].time = null;
  assert.equal(timelineOrderAtGap(rows, 1, 3), undefined);
  assert.equal(timelineOrderAtGap(rows, 3, 2), undefined);
  assert.deepEqual(timelineOrderAtGap(rows, 1, 0), ["event:1", "program:1", "program:2", "program:3"]);
  assert.throws(() => reorderTimeline(rows, ["program:1", "program:2", "event:1", "program:3"]), /cannot be moved or crossed/);
  assert.throws(() => reorderTimeline(rows, ["event:1", "program:1", "program:2", "event:99"]), /exactly once/);
});

test("saving a timeline draft updates both item types once and rejects a stale revision before writes", async () => {
  const rows = timeline();
  const order = timelineOrderAtGap(rows, 1, 3);
  let revision = 5;
  const writes = [];
  const db = { async execute(sql, args) {
    sql = sql.trim();
    if (sql.startsWith("SELECT revision")) return [[{ revision }]];
    if (sql.startsWith("SELECT p.id, p.status")) return [rows.filter(row => row.programId !== null).map(row => ({ id: row.programId, status: row.status }))];
    if (sql.startsWith("SELECT s.programId")) return [rows];
    if (sql.startsWith("SELECT program_id")) return [[{ program_id: 1 }, { program_id: 2 }, { program_id: 3 }]];
    writes.push([sql, args]);
    if (sql.startsWith("UPDATE schedule_revision")) revision++;
    return [[]];
  } };
  const focus = { date, venueId: 1 };
  await saveTimelineOrder(db, 5, focus, order);
  assert.deepEqual(writes.slice(0, 2), [
    ["UPDATE program_schedule SET planned_time = ? WHERE program_id = ?", ["08:40", 2]],
    ["UPDATE schedule_events SET planned_time = ? WHERE id = ?", ["09:30", 1]],
  ]);
  assert.equal(revision, 6);
  writes.length = 0;
  await assert.rejects(saveTimelineOrder(db, 5, focus, order), { status: 409 });
  assert.deepEqual(writes, []);
  rows[2].status = "ongoing";
  await assert.rejects(saveTimelineOrder(db, 6, focus, order), /cannot be moved or crossed/);
  assert.deepEqual(writes, []);
});

test("only the focused day and stage load program rows", async () => {
  const queues = [
    { date, venueId: 1, venueName: "Stage 1", count: 6 },
    { date, venueId: 2, venueName: "Stage 2", count: 4 },
    { date: "2026-11-15", venueId: 3, venueName: "Stage 3", count: 2 },
  ];
  assert.equal(selectQueue(queues, null, null), queues[0]);
  assert.equal(selectQueue(queues, date, 2), queues[1]);
  assert.equal(selectQueue(queues, "2026-11-15", 2), queues[2]);
  assert.equal(selectQueue([], null, null), null);
  let calls = 0;
  const db = { async execute(sql, params) {
    calls++;
    assert.match(sql, /WHERE s\.venue_id = \? AND s\.event_date = \?/);
    assert.deepEqual(params, [2, date]);
    return [[]];
  } };
  await readSchedule(db, [1, 2], true, queues[1]);
  assert.deepEqual(await readSchedule(db, [1], true, queues[1]), []);
  assert.equal(calls, 1);
});

test("venue locations derive valid pins and leave short links without coordinates", () => {
  assert.deepEqual(venueLocation({ description: " Near school ", mapUrl: "https://www.google.com/maps/search/?api=1&query=11.25%2C75.78" }),
    ["Near school", "https://www.google.com/maps/search/?api=1&query=11.25%2C75.78", 11.25, 75.78]);
  assert.deepEqual(venueLocation({ mapUrl: "https://maps.app.goo.gl/example" }), [null, "https://maps.app.goo.gl/example", null, null]);
  assert.deepEqual(venueLocation({ mapUrl: "https://www.google.com/maps/place/School/@11,75,17z/data=!3d11.25!4d75.78" }),
    [null, "https://www.google.com/maps/place/School/@11,75,17z/data=!3d11.25!4d75.78", 11.25, 75.78]);
  for (const mapUrl of ["https://www.google.com/maps/@11.25,75.78,17z", "https://maps.google.com/?q=11,200"]) {
    assert.deepEqual(venueLocation({ mapUrl }), [null, mapUrl, null, null]);
  }
  assert.throws(() => venueLocation({ mapUrl: "https://example.com/maps" }), { status: 400 });
});

function database() {
  const state = {
    revision: 4, status: "reporting", grants: [{ venue_id: 1 }], entries: [
      { program_id: 1, venueId: 1, date, position: 1, time: "10:00" },
      { program_id: 2, venueId: 1, date, position: 2, time: "11:00" },
      { program_id: 3, venueId: 2, date, position: 1, time: null },
    ],
  };
  return {
    state,
    async execute(sql, args = []) {
      sql = sql.trim();
      const [a, b, c, time, duration] = args;
      if (sql.startsWith("SELECT revision")) return [[{ revision: state.revision }]];
      if (sql.startsWith("SELECT status, isStage")) return [[{ status: state.status, isStage: 1 }]];
      if (sql.startsWith("SELECT type")) return [[{ type: a === 9 ? "off-stage" : "stage" }]];
      if (sql.startsWith("SELECT venue_id AS")) return [state.entries.filter(row => row.program_id === a)];
      if (sql.startsWith("DELETE FROM program_schedule")) state.entries = state.entries.filter(row => row.program_id !== a);
      else if (sql.startsWith("SELECT program_id")) return [state.entries.filter(row => row.venueId === a && row.date === b).sort((x, y) => (x.time ?? "99:99").localeCompare(y.time ?? "99:99"))];
      else if (sql.startsWith("INSERT INTO program_schedule")) state.entries.push({ program_id: a, venueId: b, date: c, position: 0, time, duration });
      else if (sql.startsWith("UPDATE program_schedule SET position = -")) state.entries.filter(row => row.venueId === a && row.date === b).forEach(row => { row.position *= -1; });
      else if (sql.startsWith("UPDATE program_schedule SET position")) state.entries.find(row => row.program_id === b).position = a;
      else if (sql.startsWith("UPDATE schedule_revision")) state.revision++;
      else if (sql.startsWith("SELECT id FROM access")) return [[{ id: 5 }]];
      else if (sql.startsWith("SELECT g.venue_id")) return [state.grants];
      else if (sql.startsWith("SELECT id FROM programs")) return [[{ id: a }]];
      else if (sql.startsWith("SELECT venue_id")) return [state.entries.filter(row => row.program_id === a).map(row => ({ venue_id: row.venueId }))];
      return [[]];
    },
  };
}

test("editing a start time orders the program chronologically and transferring rebuilds both lists", async () => {
  const db = database();
  await moveProgram(db, { programId: 2, revision: 4, destination: { venueId: 1, date, time: "09:30", duration: 20 } });
  assert.equal(db.state.entries.find(row => row.program_id === 2).time, "09:30");
  assert.equal(db.state.entries.find(row => row.program_id === 1).position, 2);
  await moveProgram(db, { programId: 2, revision: 5, destination: { venueId: 2, date, time: "11:00", duration: 20 } });
  assert.equal(db.state.entries.find(row => row.program_id === 1).position, 1);
  assert.equal(db.state.entries.find(row => row.program_id === 2).position, 1);
  await moveProgram(db, { programId: 2, revision: 6, destination: null });
  assert.equal(db.state.entries.some(row => row.program_id === 2), false);
});

test("swapping unequal durations updates both start times and preserves the gap", () => {
  const slots = [
    { id: 1, time: "09:00", duration: 30, status: "reporting" },
    { id: 2, time: "09:40", duration: 10, status: "pending" },
  ];
  assert.deepEqual(swapTimes(slots, 1, 2, []), [{ id: 2, time: "09:00" }, { id: 1, time: "09:20" }]);
  assert.throws(() => swapTimes(slots, 1, 2, [{ time: "09:30", duration: 10 }]), { status: 409 });
  assert.throws(() => swapTimes([{ ...slots[0], status: "ongoing" }, slots[1]], 1, 2, []), { status: 409 });
  assert.throws(() => checkSlot("23:50", 15, []), { status: 400 });
  assert.doesNotThrow(() => checkSlot("09:30", 10, slots));
});

test("stale edits, incompatible venues, and moves after start are rejected", async () => {
  const db = database();
  const change = { programId: 2, revision: 4, destination: { venueId: 9, date } };
  await assert.rejects(moveProgram(db, { ...change, revision: 3 }), { status: 409 });
  await assert.rejects(moveProgram(db, change), { status: 400 });
  db.state.status = "ongoing";
  await assert.rejects(moveProgram(db, { ...change, destination: null }), { status: 409 });
  assert.equal(db.state.revision, 4);
  assert.throws(() => scheduleDate("2026-02-30"), { status: 400 });
});

test("restricted staff lose write access after transfer and all-venue staff can work on unscheduled programs", async () => {
  const db = database();
  const actor = { username: "judge-1", role: "judge" };
  await assertProgramVenue(actor, 1, db, true);
  await moveProgram(db, { programId: 1, revision: 4, destination: { venueId: 2, date, time: "10:00", duration: 15 } });
  await assert.rejects(assertProgramVenue(actor, 1, db, true), { status: 403 });
  db.state.grants.push({ venue_id: 2 });
  await assertProgramVenue(actor, 1, db, true);
  db.state.grants = [{ venue_id: null }];
  await assert.rejects(assertProgramVenue(actor, 1, db, true), { status: 403 });
  db.state.grants = [];
  await assertProgramVenue(actor, 99, db, true);
});

test("venue access saves and reloads database names for selected, empty and unrestricted accounts", async () => {
  const names = new Map([[1, "Misbah"], [2, "Minhaj"]]);
  let grant = null;
  let role = "admin";
  let transactions = 0;
  const db = { async execute(sql, args) {
    sql = sql.trim();
    if (sql.startsWith("SELECT role FROM access")) return [[{ role: "report" }]];
    if (sql.startsWith("DELETE FROM venue_staff_scope")) grant = null;
    else if (sql.startsWith("INSERT INTO venue_staff_scope")) grant = [];
    else if (sql.startsWith("INSERT INTO venue_staff_grants")) grant.push(args[1]);
    else if (sql.startsWith("SELECT a.id AS accessId")) {
      assert.deepEqual(args, sql.includes("AND a.id = ?") ? [5] : []);
      return [(grant?.length ? grant : [null]).map(venueId => ({
        accessId: "5", restricted: Number(grant !== null), venueId, venueName: names.get(venueId) ?? null,
      }))];
    } else if (sql.startsWith("SELECT id, name, type FROM venues")) {
      return [[...names].map(([id, name]) => ({ id: String(id), name, type: "stage" }))];
    } else throw new Error(`Unexpected query: ${sql}`);
    return [[]];
  } };
  const { GET, POST } = load("api/schedule/route", {
    "../../utils/apiAuth": {
      ApiError, apiErrorResponse: error => Response.json({ message: error.message }, { status: error.status ?? 500 }),
      requireApiSession: async roles => {
        if (!roles.includes(role)) throw new ApiError("Forbidden", 403);
        return { role };
      },
    },
    "../../utils/validation": load("validation"),
    "../../utils/venueAccess": { ...venueAccess, withVenueTransaction: async run => { transactions++; return run(db); } },
  });
  const request = path => new Request("http://localhost/api/schedule" + path);
  const save = venueIds => POST(new Request(request("").url, {
    method: "POST", body: JSON.stringify({ action: "staff", accessId: 5, venueIds }),
  }));
  for (const [ids, venues] of [[null, null], [[1], [{ id: 1, name: "Misbah" }]], [[1, 2], [{ id: 1, name: "Misbah" }, { id: 2, name: "Minhaj" }]], [[], []]]) {
    const assignment = { accessId: 5, venues };
    const response = await save(ids);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, assignment });
    assert.deepEqual(await (await GET(request("?view=staff-access"))).json(), { assignments: [assignment] });
    const modal = await (await GET(request("?accessId=5"))).json();
    assert.deepEqual(modal.scope, ids);
    assert.equal(modal.venues[0].id, 1);
  }
  role = "report";
  assert.equal((await save(null)).status, 403);
  assert.equal(transactions, 12);
  assert.equal((await GET(request("?view=staff-access"))).status, 403);
});

test("program filters and direct reads enforce the current scope for both staff roles", async () => {
  for (const role of ["judge", "report"]) {
    const db = database();
    const actor = { role, username: role };
    const filter = async () => programVenueFilter(await venueAccess.venueScope(actor, db), "program");
    assert.deepEqual(await filter(), { sql: "program IN (SELECT program_id FROM program_schedule WHERE venue_id IN (?))", values: [1] });
    await assertProgramVenue(actor, 1, db);
    await assert.rejects(assertProgramVenue(actor, 3, db), { status: 403 });
    await assert.rejects(assertProgramVenue(actor, 99, db), { status: 403 });
    db.state.grants = [{ venue_id: 1 }, { venue_id: 2 }];
    assert.deepEqual((await filter()).values, [1, 2]);
    await assertProgramVenue(actor, 3, db);
    db.state.grants = [{ venue_id: null }];
    assert.equal((await filter()).sql, "1 = 0");
    db.state.grants = [];
    assert.equal((await filter()).sql, "1 = 1");
    await assertProgramVenue(actor, 99, db);
  }
});

test("public schedule selects only published schedule fields and empty staff scopes read nothing", async () => {
  let calls = 0;
  const db = { async execute(sql, params) {
    calls++;
    assert.deepEqual(params, []);
    assert.doesNotMatch(sql, /s\.status|programlist|mark|password|SELECT \*/i);
    assert.match(sql, /ORDER BY .*s\.planned_time/);
    return [[]];
  } };
  await readSchedule(db, null, false);
  assert.deepEqual(await readSchedule(db, [], true), []);
  assert.equal(calls, 1);
});
