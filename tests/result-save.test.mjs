import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
function load(file, imports={}) {
 const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',code)(name=>{if(!(name in imports))throw Error(name);return imports[name];},exports);return exports;
}
const criteria=load('app/utils/markingCriteria.ts');
const calc=load('app/utils/calculatePoints.ts',{'./markingCriteria':criteria});
class ApiError extends Error { constructor(message,status){super(message);this.status=status;} }
function fixture({status='finished',existing=[],failInsert=false,denied=false,participants}={}) {
 const writes=[];let committed=0,rolledBack=0;
 const connection={beginTransaction:async()=>{},commit:async()=>{committed++;},rollback:async()=>{rolledBack++;},release:()=>{},execute:async(sql,params)=>{
  if(sql.startsWith('SELECT id, status'))return [[{id:46,status,isGroup:0,members:1}]];
  if(sql.startsWith('SELECT id, student, code'))return [participants||[90,80,75].map((mark,i)=>({id:i+1,student:String(101+i),code:String(i+1),mark,mark2:0,mark3:0,status:'finished'}))];
  if(sql.startsWith('SELECT id, student, status'))return [existing];
  if(failInsert&&sql.startsWith('INSERT'))throw Error('Database unavailable');
  writes.push({sql,params});return [{affectedRows:1}];
 }};
 const route=load('app/api/results/confirm/route.ts',{
  '../../../utils/mysqlDb':{default:{getConnection:async()=>connection}},
  '../../../utils/apiAuth':{ApiError,requireApiSession:async roles=>{assert.deepEqual(roles,['admin']);if(denied)throw new ApiError('Forbidden',403);},apiErrorResponse:e=>Response.json({success:false,message:e.message},{status:e.status||500})},
  '../../../utils/validation':load('app/utils/validation.ts'),
  '../../../utils/calculatePoints':calc,
 });
 return {run:()=>route.POST(new Request('http://local/api/results/confirm',{method:'POST',body:JSON.stringify({program:46})})),writes,counts:()=>({committed,rolledBack})};
}
test('confirmation stores rank zero and pending status with the program update in one transaction',async()=>{
 const f=fixture();const response=await f.run();assert.equal(response.status,200);
 const inserts=f.writes.filter(w=>w.sql.startsWith('INSERT'));assert.equal(inserts.length,3);
 assert.deepEqual(inserts[2].params,[46,'103','3',0,'B',3,'pending']);
 assert.match(f.writes.at(-1).sql,/UPDATE programs SET status = 'resulted'/);assert.deepEqual(f.counts(),{committed:1,rolledBack:0});
 assert.ok(f.writes.every(w=>!w.sql.includes('DELETE')));
});
test('a partial result is updated rather than inserted again',async()=>{
 const f=fixture({existing:[{id:9,student:'101',status:''}]});assert.equal((await f.run()).status,200);
 assert.equal(f.writes.filter(w=>w.sql.startsWith('INSERT')).length,2);
 assert.equal(f.writes.filter(w=>w.sql.startsWith('UPDATE results')).length,1);
});
test('repeated confirmation is idempotent',async()=>{
 const f=fixture({status:'resulted'});assert.equal((await (await f.run()).json()).alreadyConfirmed,true);assert.equal(f.writes.length,0);
});
test('write failures roll back and never mark the program judged',async()=>{
 const f=fixture({failInsert:true});assert.equal((await f.run()).status,500);assert.deepEqual(f.counts(),{committed:0,rolledBack:1});assert.equal(f.writes.length,0);
});
test('duplicates, awarded records and published programs are not overwritten',async()=>{
 for(const settings of [{existing:[{id:1,student:'101',status:''},{id:2,student:'101',status:''}]},{existing:[{id:1,student:'101',status:'awarded'}]},{status:'announced'}]){
  const f=fixture(settings);assert.equal((await f.run()).status,409);assert.equal(f.writes.length,0);
 }
});
test('confirmation enforces admin authorization',async()=>{
 const f=fixture({denied:true});assert.equal((await f.run()).status,403);assert.equal(f.writes.length,0);
});
test('grade-less placed participants and group representatives save correctly',async()=>{
 const f=fixture({participants:[{student:'101',code:'A',mark:60,mark2:0,mark3:0,status:'finished'}]});assert.equal((await f.run()).status,200);assert.deepEqual(f.writes[0].params,[46,'101','A',1,'',5,'pending']);
});
test('the client sends only the program ID and preserves server errors',async()=>{
 const previous=globalThis.fetch;
 try{globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/results/confirm');assert.deepEqual(JSON.parse(options.body),{program:46});return Response.json({success:false,message:'No finished participants to confirm'},{status:400});};
 await assert.rejects(calc.generateFinalResults({program:{id:46},participants:[]}),/No finished participants/);
 }finally{globalThis.fetch=previous;}
});
