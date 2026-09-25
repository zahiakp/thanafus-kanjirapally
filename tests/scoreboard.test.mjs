import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function load(file, imports = {}) {
 const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
 const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports = {};
 new Function('require','exports',code)(name => { if (!(name in imports)) throw Error(name); return imports[name]; }, exports);
 return exports;
}
const { buildScoreBoard } = load('app/utils/scoreboard.ts');
test('score cells preserve individual awards, ties, ordering and saved points', () => {
 const rows = [
  {id:'3',teamId:'A',programId:'1',point:'3',rank:'0'},
  {id:'2',teamId:'A',programId:'1',point:'5',rank:'2'},
  {id:'1',teamId:'A',programId:'1',point:'8',rank:'1'},
  {id:'4',teamId:'B',programId:'1',point:'8',rank:'1'},
 ];
 const board = buildScoreBoard([{id:'A',name:'A'},{id:'B',name:'B'},{id:'C',name:'C'}],[{id:'1',name:'One'},{id:'2',name:'Two'}],rows);
 assert.equal(board.teams[0].scores['1'].map(a=>a.point).join('+'),'8+5+3');
 assert.deepEqual(board.teams[0].scores['1'].map(a=>a.kind),['first','second','grade']);
 assert.equal(board.teams[1].scores['1'][0].kind,'first');
 assert.deepEqual(board.teams[2].scores,{});
 assert.equal(board.programs.length,2);
});
test('group results count once and zero, invalid or foreign results stay out', () => {
 const result = {id:'1',teamId:'A',programId:'1',point:8,rank:1};
 const board = buildScoreBoard([{id:'A',name:'Team'}],[{id:'1',name:'Group program'}],[result,result,{...result,id:'2',point:0},{...result,id:'3',point:'bad'},{...result,id:'4',programId:'9'},{...result,id:'5',teamId:'X'}]);
 assert.equal(board.teams[0].scores['1'].length,1);
});
test('API authorizes before reads, validates categories and returns the complete grid', async () => {
 let allowed = true;
 const calls = [];
 const route = load('app/api/team-scoreboard/route.ts', {
  '../../utils/mysqlDb':{default:{execute:async(sql,params)=>{calls.push({sql,params});return [sql.includes('FROM campus')?[{id:'A',name:'Team'}]:sql.includes('FROM programs WHERE')?[{id:1,name:'Program'}]:[]];}}},
  '../../utils/apiAuth':{requireApiSession:async roles=>{assert.deepEqual(roles,['admin','announce']);if(!allowed)throw Error('denied');},ApiError:class extends Error {},apiErrorResponse:error=>Response.json({message:error.message},{status:400})},
  '../../data/branding':{categoryMap:{junior:'JUNIOR'}},
  '../../utils/scoreboard':{buildScoreBoard},
 });
 let response = await route.GET(new Request('http://local/api/team-scoreboard?category=junior'));
 const body = await response.json();
 assert.equal(body.data.teams.length,1);
 assert.equal(body.data.programs.length,1);
 assert.equal(calls.length,3);
 assert.match(calls[2].sql,/p.status = 'announced'/);
 assert.match(calls[2].sql,/SUBSTRING_INDEX/);
 assert.deepEqual(calls[2].params,['junior']);
 assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 calls.length=0;
 await route.GET(new Request('http://local/api/team-scoreboard?category=all'));
 assert.equal(calls.length,0);
 allowed=false;
 await route.GET(new Request('http://local/api/team-scoreboard?category=junior'));
 assert.equal(calls.length,0);
});
