import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as crypto from "node:crypto";
import * as bcrypt from "bcryptjs";

function load(path, imports = {}) {
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("require", "exports", code)(name => {
    if (!(name in imports)) throw Error(name);
    return imports[name];
  }, exports);
  return exports;
}
class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
const judges = load("app/utils/judges.ts");
const validation = load("app/utils/validation.ts");
const sessions = load("app/utils/session.ts");
const passwords = load("app/utils/password.ts", { crypto, bcryptjs: bcrypt });
const privacy = load("app/utils/judgeMarkPrivacy.ts", { "./judges": judges });
const venueAccess = load("app/utils/venueAccess.ts", {
  "./mysqlDb": { default: {} }, "./apiAuth": { ApiError },
});

test("venue judge login creates a verified session retaining its dedicated mark column", async () => {
  const previousSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-only-judge-session-secret-at-least-32-characters";
  try {
    const password = "Judge-test-123!";
    const hash = await bcrypt.hash(password, 4);
    for (const slot of [1, 2, 3]) {
      const username = "judge-" + slot + "-minhaj";
      const cookies = new Map();
      const route = load("app/api/login/route.ts", {
        "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200, cookies: { set: (key, value) => cookies.set(key, value) } }) } },
        "../../utils/mysqlDb": { default: { getConnection: async () => ({
          execute: async () => [[{ username, role: "judge", campusId: String(slot), password: hash }]],
          release() {},
        }) } },
        "../../utils/session": sessions,
        "../../utils/password": passwords,
        "../../utils/validation": validation,
        "../../data/branding": { accessCookieName: "test-profile" },
        "../../utils/judges": judges,
      });
      const response = await route.POST(new Request("http://localhost/api/login", { method: "POST", body: JSON.stringify({ username, password }) }));
      assert.equal(response.status, 200);
      const session = await sessions.verifySessionToken(cookies.get(sessions.SESSION_COOKIE));
      assert.equal(session.username, username);
      assert.equal(session.judgeSlot, slot);
      assert.equal(JSON.parse(cookies.get("test-profile")).judgeSlot, slot);
      assert.equal(privacy.judgeMarkVisibility(session), slot);
      const visible = privacy.applyJudgeMarkPrivacy({ mark: 90, mark2: 80, mark3: 70 }, slot);
      assert.deepEqual(["mark", "mark2", "mark3"].filter(key => key in visible), [judges.markKeyForJudge(slot)]);
      assert.equal(await sessions.verifySessionToken(cookies.get(sessions.SESSION_COOKIE) + "tampered"), null);
    }
  } finally {
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  }
});

test("venue judges can submit only their column and only inside their assigned venue", async () => {
  for (const slot of [1, 2, 3]) {
    for (const scenario of ["allowed", "wrong-column", "wrong-venue"]) {
      let committed = false, updated = false;
      const session = { username: "judge-" + slot + "-minhaj", role: "judge", judgeSlot: slot, campusId: String(slot) };
      const connection = {
        beginTransaction: async () => {}, commit: async () => { committed = true; },
        rollback: async () => {}, release() {},
        execute: async sql => {
          if (sql.startsWith("SELECT id FROM access")) return [[{ id: 78 }]];
          if (sql.startsWith("SELECT g.venue_id")) return [[{ venue_id: 4 }]];
          if (sql.startsWith("SELECT program FROM programlist")) return [[{ program: 10 }]];
          if (sql.startsWith("SELECT id FROM programs")) return [[{ id: 10 }]];
          if (sql.startsWith("SELECT venue_id FROM program_schedule")) return [[{ venue_id: scenario === "wrong-venue" ? 5 : 4 }]];
          if (sql.startsWith("UPDATE programlist")) { updated = true; return [{}]; }
          throw Error(sql);
        },
      };
      const route = load("app/api/programList/addMark/route.js", {
        "../../../utils/mysqlDb": { default: { getConnection: async () => connection } },
        "../../../utils/venueAccess": venueAccess,
        "../../../utils/apiAuth": { ApiError, requireApiSession: async () => session, apiErrorResponse: error => Response.json({}, { status: error.status || 500 }) },
        "../../../utils/validation": validation,
        "../../../utils/judges": judges,
      });
      const key = judges.markKeyForJudge(scenario === "wrong-column" ? slot % 3 + 1 : slot);
      const response = await route.POST({ json: async () => ({ participants: [{ id: 42, [key]: 85 }] }) });
      assert.equal(response.status, scenario === "allowed" ? 200 : 403);
      assert.equal(committed, scenario === "allowed");
      assert.equal(updated, scenario === "allowed");
    }
  }
});
