import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("appeals page is available only to admin and campus sessions", async () => {
  const page = await read("app/config/appeals/page.tsx");
  const proxy = await read("proxy.ts");
  const menu = await read("components/common/SideMenu.tsx");
  assert.match(page, /requireApiSession\(\["admin", "campus"\]\)/);
  assert.match(proxy, /"\/config\/appeals": \["admin", "campus"\]/);
  assert.match(menu, /path: "\/config\/appeals"/);
  assert.match(menu, /label: "Appeals"/);
});

test("appeals client uses the signed backend proxy and complete workflow actions", async () => {
  const api = await read("app/config/appeals/func.ts");
  assert.match(api, /ROOT_URL.*appeals\/action\.php/);
  for (const action of ["list", "eligiblePrograms", "eligibleParticipants", "create", "markPaid", "decide", "settleBond"]) {
    assert.match(api, new RegExp(action));
  }
});

test("appeals UI has separate mobile rows and desktop table", async () => {
  const content = await read("app/config/appeals/Content.tsx");
  assert.match(content, /md:hidden/);
  assert.match(content, /hidden overflow-x-auto md:block/);
  assert.match(content, /Decision remarks are required/);
  assert.match(content, /Bond: ₹\{bondAmount\}/);
});
