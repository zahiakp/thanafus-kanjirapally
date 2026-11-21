import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../app/utils/mysqlDb.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

test("database route modules reuse one pool per runtime and bound its size", () => {
  for (const [value, expected] of [[undefined, 3], ["0", 3], ["-1", 3], ["invalid", 3], ["2", 2]]) {
    const options = [];
    const pool = {};
    const context = vm.createContext({
      exports: {},
      process: { env: { MYSQL_CONNECTION_LIMIT: value } },
      require: () => ({ default: { createPool: config => { options.push(config); return pool; } } }),
    });
    vm.runInContext(`(function () { ${code} })()`, context);
    context.exports = {};
    vm.runInContext(`(function () { ${code} })()`, context);
    assert.equal(options.length, 1);
    assert.equal(context.exports.default, pool);
    assert.equal(options[0].connectionLimit, expected);
    assert.equal(options[0].maxIdle, expected);
    assert.equal(options[0].enableKeepAlive, true);
  }
});
