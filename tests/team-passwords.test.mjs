import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import * as crypto from 'node:crypto';
import * as bcrypt from 'bcryptjs';

function load(file, imports = {}) {
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(name => {
    if (!(name in imports)) throw new Error('Unexpected import: ' + name);
    return imports[name];
  }, exports);
  return exports;
}
const passwords = load('app/utils/password.ts', { crypto, bcryptjs: bcrypt });
const validation = load('app/utils/validation.ts');

test('team create and edit store the entered password in both team records', async () => {
  for (const edit of [undefined, 'TEAM01']) {
    const writes = [];
    let committed = false;
    const connection = {
      beginTransaction: async () => {},
      execute: async (sql, params) => { writes.push({ sql, params }); return [{}]; },
      commit: async () => { committed = true; },
      rollback: async () => {}, release: () => {},
    };
    const route = load('app/api/campus/update/route.js', {
      '../../../utils/mysqlDb': { default: { getConnection: async () => connection } },
      '../../../utils/apiAuth': {
        requireApiSession: async roles => assert.deepEqual(roles, ['admin']),
        apiErrorResponse: error => { throw error; },
      },
      '../../../utils/validation': validation,
    });
    const password = 'Team-test-987!';
    const response = await route.POST({ json: async () => ({ edit, name: 'Test team', jamiaNo: 'TEAM01', password, categories: ['junior'], strength: 50 }) });
    assert.equal(response.status, 200);
    assert.equal(committed, true);
    assert.equal(writes.length, 2);
    assert.equal(writes[0].params[1], password);
    assert.equal(writes[1].params[2], password);
  }
});

test('login preserves readable team passwords and still migrates other roles to bcrypt', async () => {
  const password = 'Login-test-987!';
  for (const role of ['campus', 'admin', 'judge']) {
    const writes = [];
    const connection = {
      execute: async (sql, params) => {
        if (sql.startsWith('SELECT username')) return [[{ username: 'testuser', role, campusId: 'TEAM01', password }]];
        if (sql.startsWith('SELECT jamiaNo')) return [[{ jamiaNo: 'TEAM01', name: 'Test team', categories: 'junior', strength: 50 }]];
        writes.push(params); return [{}];
      },
      release: () => {},
    };
    const route = load('app/api/login/route.ts', {
      'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200, cookies: { set: () => {} } }) } },
      '../../utils/mysqlDb': { default: { getConnection: async () => connection } },
      '../../utils/session': { createSessionToken: async () => 'test', SESSION_COOKIE: 'session', SESSION_MAX_AGE: 60 },
      '../../utils/password': passwords,
      '../../utils/validation': validation,
      '../../data/branding': { accessCookieName: 'test-access' },
      '../../utils/judges': { judgeSlotFromScope: () => null, judgeSlotFromUsername: () => null },
    });
    const response = await route.POST({ headers: new Headers(), json: async () => ({ username: 'testuser', password }) });
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(writes.length, role === 'campus' ? 0 : 1);
    if (writes.length) assert.equal(await bcrypt.compare(password, writes[0][0]), true);
  }
});

test('existing hashed team credentials still verify and wrong passwords fail', async () => {
  const stored = await bcrypt.hash('Team-test-987!', 4);
  assert.equal(await passwords.verifyPassword('Team-test-987!', stored), true);
  assert.equal(await passwords.verifyPassword('wrong', stored), false);
  assert.equal(await passwords.verifyPassword('wrong', 'Team-test-987!'), false);
});
