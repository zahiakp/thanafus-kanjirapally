import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(path, imports = {}) {
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('require', 'exports', code)((name) => {
    if (!(name in imports)) throw new Error('Unexpected import: ' + name);
    return imports[name];
  }, exports);
  return exports;
}
const criteria = load('app/utils/markingCriteria.ts');
const { assignRanksAndCalculatePoints } = load('app/utils/calculatePoints.ts', {
  './markingCriteria': criteria,
  '../judgement/func': { AssignResult: async () => ({ success: true }) },
});
const participant = (mark, i) => ({ code: String(i), student: String(i), mark, mark2: 0, mark3: 0, status: 'finished' });

test('grade boundaries and the two placement awards', () => {
  for (const [mark, grade, points] of [[100,'A',5],[80,'A',5],[79.99,'B',3],[70,'B',3],[69.99,null,0],[0,null,0]]) {
    assert.deepEqual(criteria.pointsFor(mark, 3), {rank: 0, grade, points});
  }
  assert.deepEqual(criteria.pointsFor(80, 1), {rank: 1, grade: 'A', points: 10});
  assert.deepEqual(criteria.pointsFor(70, 2), {rank: 2, grade: 'B', points: 6});
  assert.deepEqual(criteria.pointsFor(60, 2), {rank: 2, grade: null, points: 3});
});

test('individual and group sizes all receive fixed grade points', () => {
  for (const members of [1,2,3,4,5,6,10]) for (const isGroup of [0,1]) {
    const results = assignRanksAndCalculatePoints({participants: [90,80,75,65].map(participant), program: {id:'1',members,isGroup}});
    assert.deepEqual(results.map(({rank,grade,points}) => ({rank,grade,points})), [
      {rank:1,grade:'A',points:10},{rank:2,grade:'A',points:8},
      {rank:0,grade:'B',points:3},{rank:0,grade:null,points:0},
    ]);
  }
});

test('ties preserve competition ranking and multiple judge normalization', () => {
  const results = assignRanksAndCalculatePoints({participants: [90,90,80].map(participant), program:{id:'1',members:1,isGroup:0}});
  assert.deepEqual(results.map(p=>p.rank), [1,1,0]);
  const normalized = assignRanksAndCalculatePoints({participants: [{...participant(80,1),mark2:70,mark3:60}], program:{id:'1',members:1,isGroup:0}});
  assert.equal(normalized[0].grade,'B');
  assert.equal(normalized[0].points,8);
});

test('result queries use the same grades, points, and competition ties', async () => {
  const rows = [90,90,80,70,60].map((mark,i)=>({id:1,participantId:i,student:String(i),campus:'1',code:String(i),mark,participantStatus:'finished',studentName:'Participant',campusName:'Team',isGroup:0,members:1}));
  const { getProgramResults } = load('app/utils/resultQuery.ts', {
    './markingCriteria':criteria,
    './mysqlDb':{default:{execute:async()=>[rows]}},
  });
  const [result] = await getProgramResults('judged');
  assert.equal(result.first.length,2);
  assert.equal(result.second.length,0);
  assert.equal(result.third.length,0);
  assert.deepEqual(result.grades.map(p=>[p.grade,p.points]),[['A',5],['B',3]]);
});
