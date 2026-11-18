import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(path, imports = {}) {
  const source = readFileSync(new URL("../" + path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  new Function("require", "exports", outputText)(name => {
    assert.ok(name in imports, `Unexpected import: ${name}`);
    return imports[name];
  }, exports);
  return exports;
}

test("the code editor saves swaps atomically and rejects stale, conflicting or unauthorized changes", async () => {
  class ApiError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }
  const codes = new Map([[76, "A"], [85, "C"], [74, "B"]]);
  let status = "ongoing";
  let denied = false;
  let failWrite = false;
  const { POST } = load("app/api/programList/assignCode/route.js", {
    "../../../utils/apiAuth": {
      ApiError, requireApiSession: async () => ({ role: "report" }),
      apiErrorResponse: error => Response.json({ success: false, message: error.message }, { status: error.status ?? 500 }),
    },
    "../../../utils/validation": load("app/utils/validation.ts"),
    "../../../utils/venueAccess": {
      assertProgramVenue: async (_session, id, _db, lock) => {
        assert.equal(id, 17);
        assert.equal(lock, true);
        if (denied) throw new ApiError("Outside assigned venues", 403);
      },
      withVenueTransaction: async callback => {
        const draft = new Map(codes);
        await callback({ async execute(sql, values) {
          if (sql.startsWith("SELECT id, program")) return [values.filter(id => draft.has(id)).map(id => ({ id, program: 17 }))];
          if (sql.startsWith("SELECT status")) return [[{ status }]];
          if (sql.startsWith("SELECT id, code")) return [[...draft].map(([id, code]) => ({ id, code }))];
          if (sql.startsWith("UPDATE programlist SET code = NULL")) {
            for (const id of values.slice(1)) draft.set(id, null);
          } else if (sql.startsWith("UPDATE programlist SET code = ?")) {
            const [code, id] = values;
            if (id === 85 && failWrite) throw new Error("Fixture write failure");
            assert.ok(![...draft.values()].includes(code), "Old codes must be released before any new value is saved");
            draft.set(id, code);
          } else assert.fail(sql);
          return [[]];
        } });
        for (const [id, code] of draft) codes.set(id, code);
      },
    },
  });
  const save = entries => POST(new Request("http://localhost/api/programList/assignCode", {
    method: "POST", body: JSON.stringify({ participants: entries }),
  }));
  const swap = [{ id: 76, code: "C", previousCode: "A" }, { id: 85, code: "A", previousCode: "C" }];
  assert.equal((await save(swap)).status, 200);
  assert.deepEqual([...codes.values()], ["C", "A", "B"]);
  assert.equal((await save(swap)).status, 409);
  assert.equal((await save([{ id: 76, code: "b", previousCode: "C" }])).status, 409);
  denied = true;
  assert.equal((await save([{ id: 76, code: "D" }])).status, 403);
  denied = false;
  status = "pending";
  assert.equal((await save([{ id: 76, code: "D" }])).status, 409);
  status = "reporting";
  failWrite = true;
  assert.equal((await save([{ id: 76, code: "D" }, { id: 85, code: "E" }])).status, 500);
  assert.deepEqual([...codes.values()], ["C", "A", "B"]);
});
