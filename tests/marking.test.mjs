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

test('ties preserve dense ranking and multiple judge normalization', () => {
  const results = assignRanksAndCalculatePoints({participants: [90,90,80].map(participant), program:{id:'1',members:1,isGroup:0}});
  assert.deepEqual(results.map(p=>p.rank), [1,1,2]);
  const normalized = assignRanksAndCalculatePoints({participants: [{...participant(80,1),mark2:70,mark3:60}], program:{id:'1',members:1,isGroup:0}});
  assert.equal(normalized[0].grade,'B');
  assert.equal(normalized[0].points,8);
});

test('result queries use the same grades, points, and dense ties', async () => {
  const rows = [90,90,80,70,60].map((mark,i)=>({id:1,participantId:i,student:String(i),campus:'1',code:String(i),mark,participantStatus:'finished',studentName:'Participant',campusName:'Team',isGroup:0,members:1}));
  const { getProgramResults } = load('app/utils/resultQuery.ts', {
    './calculatePoints':{assignRanksAndCalculatePoints},
    './mysqlDb':{default:{execute:async()=>[rows]}},
  });
  const [result] = await getProgramResults('judged');
  assert.equal(result.first.length,2);
  assert.equal(result.second.length,1);
  assert.equal(result.third.length,0);
  assert.deepEqual(result.grades.map(p=>[p.grade,p.points]),[['B',3]]);
});

test('judge 2 counts for everyone when any participant has a mark', () => {
 const results=assignRanksAndCalculatePoints({program:{id:'1',isGroup:0},participants:[{...participant(90,'A'),mark2:89},participant(89,'B')]});
 assert.deepEqual(results.map(p=>[p.code,p.rank,p.grade,p.points]),[['A',1,'A',10],['B',2,null,3]]);
});
test('judge 3 is selected independently of judge 2 and applies to all participants', () => {
 const results=assignRanksAndCalculatePoints({program:{id:'1',isGroup:0},participants:[{...participant(80,'A'),mark3:80},participant(90,'B')]});
 assert.deepEqual(results.map(p=>[p.code,p.grade,p.points]),[['A','A',10],['B',null,3]]);
});
test('three active columns use the same divisor even when one participant has zeros', () => {
 const results=assignRanksAndCalculatePoints({program:{id:'1',isGroup:0},participants:[{...participant(75,'A'),mark2:75,mark3:75},participant(100,'B')]});
 assert.deepEqual(results.map(p=>[p.code,p.grade,p.points]),[['A','B',8],['B',null,3]]);
});
test('program-wide column detection includes participants not eligible for ranking', () => {
 const results=assignRanksAndCalculatePoints({program:{id:'1',isGroup:0},participants:[participant(90,'A')],markParticipants:[{mark2:50,mark3:0}]});
 assert.equal(results[0].grade,null);
 assert.equal(results[0].points,5);
});
test('result reader uses every judge column and isolates detection by program', async () => {
 const rows=[
  {id:1,participantId:1,student:'1',code:'A',mark:90,mark2:89,mark3:0,participantStatus:'finished'},
  {id:1,participantId:2,student:'2',code:'B',mark:89,mark2:0,mark3:0,participantStatus:'finished'},
  {id:2,participantId:3,student:'3',code:'C',mark:89,mark2:0,mark3:0,participantStatus:'finished'},
 ];
 const {getProgramResults}=load('app/utils/resultQuery.ts',{'./calculatePoints':{assignRanksAndCalculatePoints},'./mysqlDb':{default:{execute:async()=>[rows]}}});
 const results=await getProgramResults('judged');
 assert.equal(results[0].second[0].grade,null);
 assert.equal(results[1].first[0].grade,'A');
});

test('ties never consume the next distinct rank, including multiple second places', () => {
 const results=assignRanksAndCalculatePoints({participants:[90,90,80,80,75].map(participant),program:{id:'1',members:1,isGroup:0}});
 assert.deepEqual(results.map(p=>[p.rank,p.points]),[[1,10],[1,10],[2,8],[2,8],[0,3]]);
});
