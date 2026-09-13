import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('database credentials are environment-backed', async () => {
  const source = await read('app/utils/mysqlDb.ts');
  assert.match(source, /process\.env\.MYSQL_PASSWORD/);
  assert.doesNotMatch(source, /hstgr\.io|u\d+_projects/);
});

test('the proxy validates signed sessions and covers APIs', async () => {
  const source = await read('proxy.ts');
  assert.match(source, /verifySessionToken/);
  assert.match(source, /pathname\.startsWith\("\/api\/"\)/);
  assert.doesNotMatch(source, /JSON\.parse\(cookie\.value\)/);
});

test('dangerous shared-pool shutdown is absent', async () => {
  const resultRoute = await read('app/api/result/route.js');
  assert.doesNotMatch(resultRoute, /pool\.end/);
});

test('generic delete is allowlisted and parameterized', async () => {
  const source = await read('app/api/delete/route.js');
  assert.match(source, /const targets =/);
  assert.match(source, /WHERE \$\{target\.key\} = \?/);
  assert.doesNotMatch(source, /WHERE[^\n]*'\$\{id\}'/);
});

test('browser backend calls use the server proxy', async () => {
  const source = await read('app/data/func.ts');
  assert.match(source, /\/api\/backend\//);
  assert.doesNotMatch(source, /projects\.abaqas\.in|NEXT_PUBLIC_BACKEND_API_KEY/);
});
test('client profile cookie uses a valid brand-independent name', async () => {
  const branding = await read('app/data/branding.ts');
  const login = await read('app/api/login/route.ts');
  const logout = await read('app/api/logout/route.ts');
  const proxy = await read('proxy.ts');

  assert.match(branding, /accessCookieName\s*=\s*["'][a-z0-9-]+-access["']/);
  for (const source of [login, logout, proxy]) {
    assert.match(source, /accessCookieName/);
    assert.doesNotMatch(source, /\$\{brandName\}-access/);
  }
});
test('program reset uses the secured proxy and idempotent reset requests', async () => {
  const resetClient = await read('app/config/reset/func.ts');
  const resetModal = await read('app/config/reset/Modal.tsx');
  const backendProxy = await read('app/api/backend/[...path]/route.ts');

  assert.match(resetClient, /ROOT_URL/);
  assert.match(resetClient, /Idempotency-Key/);
  assert.match(resetClient, /undoReset/);
  assert.match(resetModal, /resetRules/);
  assert.match(resetModal, /Automatic/);
  assert.match(resetModal, /Recommended/);
  assert.match(resetModal, /Optional/);
  assert.match(resetModal, /clearResultStatuses/);
  assert.match(resetModal, /clearTopics/);
  assert.match(backendProxy, /privateProgramReadActions/);
  assert.match(backendProxy, /resetcandidates/, 'reset program reads must not be treated as public');
});
test('numbered judges receive only their mark and boolean status for other columns', async () => {
  const modal = await read('components/common/AddResult.tsx');
  const client = await read('app/programs/func.ts');
  const writeRoute = await read('app/api/programList/addMark/route.js');
  const readRoute = await read('app/api/programList/route.js');
  const backendProxy = await read('app/api/backend/[...path]/route.ts');
  const privacy = await read('app/utils/judgeMarkPrivacy.ts');

  assert.match(modal, /UpdateMarks\(toUpdate\)/);
  assert.match(modal, /markColumns\.map/);
  assert.match(modal, /if \(judgeSlot && !editable\)/);
  assert.match(modal, /marked \? "Marked" : "Not marked"/);
  assert.match(modal, /student\[column\.statusKey\]/);
  assert.match(modal, /for \(const key of editableMarkKeys\)/);
  assert.match(client, /fetch\("\/api\/programList\/addMark"/);
  assert.match(client, /view=judgement/);
  assert.match(writeRoute, /requireApiSession\(\["admin", "judge"\]\)/);
  assert.match(writeRoute, /judgeSlotFromUsername\(session\.username\) \?\? judgeSlotFromScope\(session\.judgeSlot \?\? session\.campusId\)/);
  assert.match(writeRoute, /This judge cannot edit that mark column/);
  assert.match(readRoute, /applyJudgeMarkPrivacy\(data, judgeMarkVisibility\(session\)\)/);
  assert.match(backendProxy, /resource === "participants" && action === "markupdate"/);
  assert.match(backendProxy, /request\.nextUrl\.searchParams\.get\("view"\) === "judgement"/);
  assert.match(backendProxy, /isJudgementRead \? judgeMarkVisibility\(session\) : "hidden"/);
  assert.match(privacy, /mark1Marked/);
  assert.match(privacy, /mark2Marked/);
  assert.match(privacy, /mark3Marked/);
  assert.match(privacy, /delete copy\[key\]/);
});
test('dashboard menu recovers from a missing client profile cookie', async () => {
  const sideMenu = await read('components/common/SideMenu.tsx');
  const sessionRoute = await read('app/api/session/route.ts');
  const proxy = await read('proxy.ts');

  assert.match(sideMenu, /fetch\("\/api\/session"/);
  assert.match(sessionRoute, /requireApiSession/);
  assert.match(proxy, /response\.cookies\.set\(accessCookieName/);
});
test('login displays backend authentication errors instead of a generic network error', async () => {
  const page = await read('app/login/page.tsx');
  const loginFunc = await read('app/login/func.ts');

  assert.doesNotMatch(page, /Network response was not ok/);
  assert.match(page, /loginFunc\(username, password\)/);
  assert.match(loginFunc, /result\?\.message/);
});
test('registration deadline comes only from the public environment value and is server enforced', async () => {
  const envExample = await read('.env.example');
  const registration = await read('app/utils/registration.ts');
  const studentsPage = await read('app/students/Content.tsx');
  const studentMutation = await read('app/api/students/update/route.js');
  const backendProxy = await read('app/api/backend/[...path]/route.ts');

  assert.match(envExample, /^NEXT_PUBLIC_REGISTRATION_CLOSE_AT=/m);
  assert.doesNotMatch(envExample, /^REGISTRATION_CLOSE_AT=/m);
  assert.match(registration, /process\.env\.NEXT_PUBLIC_REGISTRATION_CLOSE_AT/);
  assert.doesNotMatch(studentsPage, /2026-\d{2}-\d{2}T/);
  assert.match(studentMutation, /isRegistrationClosed\(\)/);
  assert.match(backendProxy, /isRegistrationMutation && isRegistrationClosed\(\)/);
});
test('manual student add has no number field and requires backend success', async () => {
  const modal = await read('components/common/AddStudent.tsx');
  const api = await read('app/students/func.ts');

  assert.doesNotMatch(modal, /name="number"|CheckJamiaIds/);
  assert.doesNotMatch(api, /urlencoded\.append\("number"/);
  assert.match(api, /!response\.ok \|\| !result\?\.success/);
  assert.match(modal, /if \(resp\?\.success\)/);
});

test('users module keeps database roles fixed and respects protected accounts', async () => {
  const content = await read('app/config/users/Content.tsx');
  const api = await read('app/config/users/func.ts');
  const addModal = await read('app/config/users/AddUserModal.tsx');

  assert.match(content, /Administration/);
  assert.match(content, /Team managed/);
  assert.match(content, /Primary access/);
  assert.match(content, /disabled=\{user\.isPrimary\}/);
  assert.doesNotMatch(content, /<select[^>]*role/);
  assert.match(content, /Add User/);
  assert.match(api, /action\.php\?action=create/);
  assert.doesNotMatch(content, /if \(loading\) return/);
  assert.match(api, /method: "POST"/);
  assert.doesNotMatch(addModal, /value: "campus"/);
  assert.match(addModal, /navigator\.clipboard\.writeText/);
  assert.match(addModal, /cannot be retrieved after closing/);
  assert.match(addModal, /Copy login details/);
  assert.match(addModal, /value: "judge-1"/);
  assert.match(addModal, /value: "judge-2"/);
  assert.match(addModal, /value: "judge-3"/);
  assert.match(addModal, /Judge \(all mark columns\)/);
  assert.match(api, /judgeSlot/);
  assert.match(content, /userRoleLabel/);
  const login = await read('app/api/login/route.ts');
  assert.match(login, /reservedJudgeSlot \?\? judgeSlotFromScope\(user\.campusId\)/);
  assert.match(api, /method: "PUT"/);
  assert.match(api, /method: "DELETE"/);
  assert.doesNotMatch(api, /password.*data|data.*password/);
});

test('backend proxy supplies idempotency keys for secured mutations', async () => {
  const proxy = await read('app/api/backend/[...path]/route.ts');
  assert.match(proxy, /headers\.set\("idempotency-key"/);
  assert.match(proxy, /randomUUID\(\)/);
});

test('Teams page waits for the restored profile role before clearing results', async () => {
  const campusList = await read('app/campus/CampusList.tsx');

  assert.doesNotMatch(campusList, /useState\(cookies\[accessCookieName\]\?\.role\)/);
  assert.match(campusList, /const role = cookies\[accessCookieName\]\?\.role/);
  assert.match(campusList, /if \(!role\) \{\s*return;/);
  assert.match(campusList, /\[page, rows, role\]/);
  assert.match(campusList, /latestRequest/);
});

test('team create and edit use one atomic PHP backend request', async () => {
  const modal = await read('components/common/AddCampus.tsx');
  const api = await read('app/campus/func.ts');

  assert.match(modal, /saveTeam\(values, selectedCategories, edit\)/);
  assert.doesNotMatch(modal, /getAccessbyJamiaNo|editAccess|editTeam|addAccess|addTeam/);
  assert.match(api, /campuses\/action\.php\?action=teamSave/);
  assert.match(api, /id: edit\?\.id \|\| null/);
});
