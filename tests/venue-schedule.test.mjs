import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

function load(path) {
  const source = readFileSync(new URL("../app/utils/" + path + ".ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("require", "exports", js)((name) => name === "./mapsLink" ? load("mapsLink") : ({ ApiError }), exports);
  return exports;
}

const { moveProgram, readSchedule, scheduleDate } = load("venueSchedule");
const { assertProgramVenue } = load("venueAccess");
const { venueLocation } = load("venueLocation");
const date = "2026-11-14";

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
      const [a, b, c, time] = args;
      if (sql.startsWith("SELECT revision")) return [[{ revision: state.revision }]];
      if (sql.startsWith("SELECT status, isStage")) return [[{ status: state.status, isStage: 1 }]];
      if (sql.startsWith("SELECT type")) return [[{ type: a === 9 ? "off-stage" : "stage" }]];
      if (sql.startsWith("SELECT venue_id AS")) return [state.entries.filter(row => row.program_id === a)];
      if (sql.startsWith("DELETE FROM program_schedule")) state.entries = state.entries.filter(row => row.program_id !== a);
      else if (sql.startsWith("SELECT program_id")) return [state.entries.filter(row => row.venueId === a && row.date === b).sort((x, y) => x.position - y.position)];
      else if (sql.startsWith("INSERT INTO program_schedule")) state.entries.push({ program_id: a, venueId: b, date: c, position: 0, time });
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

test("moving a reporting program preserves planned time and rebuilds both queues", async () => {
  const db = database();
  await moveProgram(db, { programId: 2, revision: 4, destination: { venueId: 1, date, position: 1 } });
  assert.equal(db.state.entries.find(row => row.program_id === 2).time, "11:00");
  assert.equal(db.state.entries.find(row => row.program_id === 1).position, 2);
  await moveProgram(db, { programId: 2, revision: 5, destination: { venueId: 2, date } });
  assert.equal(db.state.entries.find(row => row.program_id === 1).position, 1);
  assert.equal(db.state.entries.find(row => row.program_id === 2).position, 2);
  await moveProgram(db, { programId: 2, revision: 6, destination: null });
  assert.equal(db.state.entries.some(row => row.program_id === 2), false);
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
  await moveProgram(db, { programId: 1, revision: 4, destination: { venueId: 2, date } });
  await assert.rejects(assertProgramVenue(actor, 1, db, true), { status: 403 });
  db.state.grants.push({ venue_id: 2 });
  await assertProgramVenue(actor, 1, db, true);
  db.state.grants = [{ venue_id: null }];
  await assert.rejects(assertProgramVenue(actor, 1, db, true), { status: 403 });
  db.state.grants = [];
  await assertProgramVenue(actor, 99, db, true);
});

test("public schedule selects only published schedule fields and empty staff scopes read nothing", async () => {
  let calls = 0;
  const db = { async execute(sql, params) {
    calls++;
    assert.deepEqual(params, []);
    assert.doesNotMatch(sql, /p\.status|programlist|mark|password|SELECT \*/i);
    assert.match(sql, /ORDER BY .*s\.position/);
    return [[]];
  } };
  await readSchedule(db, null, false);
  assert.deepEqual(await readSchedule(db, [], true), []);
  assert.equal(calls, 1);
});
