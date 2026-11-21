import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(path, imports = {}) {
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("require", "exports", code)(name => {
    if (!(name in imports)) throw Error(name);
    return imports[name];
  }, exports);
  return exports;
}
const judges = load("app/utils/judges.ts");
const validation = load("app/utils/validation.ts");
class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
function harness({ failGrant = false, duplicate = false, admin = true, missingVenue = false } = {}) {
  const calls = [];
  let committed = false, rolledBack = false;
  const route = load("app/api/users/judge/route.ts", {
    "../../../utils/apiAuth": {
      ApiError,
      requireApiSession: async roles => { assert.deepEqual(roles, ["admin"]); if (!admin) throw new ApiError("Forbidden", 403); },
      apiErrorResponse: error => Response.json({ success: false }, { status: error.status || 500 }),
    },
    "../../../utils/validation": validation,
    "../../../utils/judges": judges,
    "../../../utils/password": { hashPassword: async () => "hashed-password" },
    "../../../utils/venueAccess": { withVenueTransaction: async fn => {
      try {
        const result = await fn({ execute: async (sql, values) => {
          calls.push({ sql, values });
          if (sql.startsWith("SELECT id, name")) return [missingVenue ? [] : [{ id: 4, name: "Minhaj" }]];
          if (sql.startsWith("SELECT id FROM access")) return [duplicate ? [{ id: 77 }] : []];
          if (sql.startsWith("INSERT INTO access")) return [{ insertId: 78 }];
          if (sql.includes("venue_staff_grants") && failGrant) throw Error("Grant failed");
          return [{}];
        } });
        committed = true;
        return result;
      } catch (error) { rolledBack = true; throw error; }
    } },
  });
  return { calls, run: async () => {
    const response = await route.POST(new Request("http://localhost/api/users/judge", { method: "POST", body: JSON.stringify({ judgeSlot: 2, venueId: 4, password: "test-password", username: "ignored" }) }));
    return { response, committed, rolledBack };
  } };
}
test("judge creation inserts account and selected venue restriction together", async () => {
  const h = harness();
  const result = await h.run();
  assert.equal(result.response.status, 201);
  assert.equal(result.committed, true);
  assert.deepEqual((await result.response.json()).data, { id: 78, username: "judge-2-minhaj" });
  assert.deepEqual(h.calls.find(c => c.sql.startsWith("INSERT INTO access")).values, ["judge-2-minhaj", "hashed-password", "2"]);
  assert.deepEqual(h.calls.find(c => c.sql.includes("INSERT INTO venue_staff_scope")).values, [78]);
  assert.deepEqual(h.calls.find(c => c.sql.includes("INSERT INTO venue_staff_grants")).values, [78, 4]);
});
test("grant failure rolls back account creation", async () => {
  const result = await harness({ failGrant: true }).run();
  assert.equal(result.response.status, 500);
  assert.equal(result.committed, false);
  assert.equal(result.rolledBack, true);
});
test("invalid venue, duplicate login, and non-admin cannot create an account", async () => {
  for (const [options, status] of [[{ missingVenue: true }, 400], [{ duplicate: true }, 409], [{ admin: false }, 403]]) {
    const h = harness(options);
    const result = await h.run();
    assert.equal(result.response.status, status);
    assert.equal(h.calls.some(c => c.sql.startsWith("INSERT")), false);
  }
});
