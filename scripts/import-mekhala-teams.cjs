const fs = require('node:fs');
const path = require('node:path');
const {createHash,createHmac,randomUUID,randomInt} = require('node:crypto');
require('@next/env').loadEnvConfig(path.resolve(__dirname,'..'));
const mysql = require('mysql2/promise');
const names = ['DSM - KANJIRAPPALLY','MM - PARAKKADAVU','DUM - KODUVENTHANAM','MM - KALLUNKAL NAGAR','SUM - EDAPPALLY','NIM - PICHAKAPALLIMEDU','DUM - PUTHUKKUZHI','DUM - AMAN NAGAR','ISM - PATTIMATTAM','SIM - KOOVAPPALLY','HIM - MANANGALLOOR','HIM - IDAKKUNNAM','SIM - MUKKALI','MUM - PARATHODU','JUM - ANJILIPPA','MIM - CHIRAKKADAVU','IIM - CHENAPPADI','IIM - CHANTHAYIL','BM - MANIMALA','MIM - PONKUNNAM','NIM - CHAMAMPATHAL','HIM - PANAMATTAM'];
const credentialPath = path.resolve(__dirname,'../.env.team-import.local');
const normalize = value => value.trim().replace(/\s+/g,' ').toUpperCase();
function shortName(name) { const words=name.trim().split(/\s+/).map(w=>w.replace(/[^A-Za-z0-9]/g,'')).filter(Boolean); return (words.length===1?words[0].slice(0,3):words.map(w=>w[0]).join('').slice(0,6)).toUpperCase(); }
function password() {const groups=['ABCDEFGHJKLMNPQRSTUVWXYZ','abcdefghijkmnopqrstuvwxyz','23456789','!@#$%&*_-+'];const all=groups.join('');const result=groups.map(g=>g[randomInt(g.length)]);while(result.length<16)result.push(all[randomInt(all.length)]);for(let i=result.length-1;i>0;i--){const j=randomInt(i+1);[result[i],result[j]]=[result[j],result[i]];}return result.join('');}
async function request(actor, query, payload, key) {
 const target=new URL('campuses/action.php',process.env.BACKEND_URL.replace(/\/?$/,'/')); target.search=query;target.searchParams.set('api',process.env.BACKEND_API_KEY);
 const method=payload?'POST':'GET', body=payload?JSON.stringify(payload):'', timestamp=String(Math.floor(Date.now()/1000));
 const identity=Buffer.from(JSON.stringify(actor)).toString('base64url');
 const canonical=[method,target.pathname,createHash('sha256').update(body).digest('hex'),timestamp,identity].join('\n');
 const signature=createHmac('sha256',process.env.BACKEND_SIGNING_SECRET).update(canonical).digest('base64url');
 const response=await fetch(target,{method,headers:{'content-type':'application/json','x-api-key':process.env.BACKEND_API_KEY,'x-artivox-timestamp':timestamp,'x-artivox-actor':identity,'x-artivox-signature':signature,...(payload?{'idempotency-key':key}:{})},body:payload?body:undefined,redirect:'error',signal:AbortSignal.timeout(20000)});
 const result=await response.json(); if(!response.ok || result.success===false)throw new Error('Backend request failed: '+response.status+' '+(result.message||''));return result;
}
(async()=>{
 const c=await mysql.createConnection({host:process.env.MYSQL_HOST,port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER,password:process.env.MYSQL_PASSWORD,database:process.env.MYSQL_DATABASE,connectTimeout:10000});
 try {
 const [before]=await c.query('SELECT id,jamiaNo,name,shortName,strength,categories FROM campus ORDER BY id');
 const [admins]=await c.query("SELECT username,role,campusId FROM access WHERE role='admin' ORDER BY id LIMIT 1");if(!admins.length)throw new Error('No admin account');
 const actor=admins[0];
 const expected=['NIM - VILLANI','DUM - ANAKKALLU','DIM - ANITHOTTAM'];if(!expected.every(n=>before.some(t=>t.name===n)))throw new Error('Unexpected database: original teams missing');
 const categories=before.find(t=>t.name===expected[0]).categories;
 if(!expected.every(n=>before.find(t=>t.name===n).categories===categories))throw new Error('Existing team categories differ');
 const upstream=await request(actor,'teamId='+encodeURIComponent(before[0].jamiaNo));
 if(!JSON.stringify(upstream).includes(before[0].name))throw new Error('Backend/database mismatch');
 const used=new Set(before.map(t=>t.jamiaNo.toUpperCase())); const [accounts]=await c.query('SELECT username FROM access');accounts.forEach(a=>used.add(a.username.toUpperCase()));
 const plan=[];for(const name of names){if(before.some(t=>normalize(t.name)===normalize(name)))continue;const shortname=shortName(name);let n=1;while(used.has(shortname+String(n).padStart(2,'0')))n++;const jamiaNo=shortname+String(n).padStart(2,'0');used.add(jamiaNo);plan.push({id:null,jamiaNo,name,shortname,strength:50,categories:categories.split(',')});}
 console.log(JSON.stringify({existing:before.length,add:plan.length,skipped:names.length-plan.length,plan:process.argv.includes('--apply')?undefined:plan},null,2));
 if(!process.argv.includes('--apply'))return;
 const credentials=fs.existsSync(credentialPath)?JSON.parse(fs.readFileSync(credentialPath,'utf8')):[];
 await c.beginTransaction();
 for(const team of plan){let record=credentials.find(r=>r.name===team.name);if(!record){record={name:team.name,username:team.jamiaNo,password:password(),idempotencyKey:randomUUID(),status:'pending'};credentials.push(record);fs.writeFileSync(credentialPath,JSON.stringify(credentials,null,2),{mode:0o600});}if(record.username!==team.jamiaNo)throw new Error('ID changed since prior attempt');if(process.argv.includes('--schema-compatible')) {
 const hash=await require('bcryptjs').hash(record.password,12);
 await c.execute('INSERT INTO campus (jamiaNo,name,password,strength,categories,shortName,points) VALUES (?,?,?,?,?,?,0)',[team.jamiaNo,team.name,hash,team.strength,team.categories.join(','),team.shortname]);
 await c.execute("INSERT INTO access (username,role,password,campusId) VALUES (?,'campus',?,?)",[team.jamiaNo,hash,team.jamiaNo]);
 } else {await request(actor,'action=teamSave',{...team,password:record.password},record.idempotencyKey);}record.status='created';fs.writeFileSync(credentialPath,JSON.stringify(credentials,null,2),{mode:0o600});console.log('Created '+team.jamiaNo+' '+team.name);}
 const [after]=await c.query('SELECT id,jamiaNo,name,shortName,strength,categories FROM campus ORDER BY id');
 for(const old of before){if(JSON.stringify(after.find(t=>t.id===old.id))!==JSON.stringify(old))throw new Error('Existing team changed');}
 for(const name of names){const matches=after.filter(t=>normalize(t.name)===normalize(name));if(matches.length!==1 || Number(matches[0].strength)!==50)throw new Error('Verification failed for '+name);const [access]=await c.execute("SELECT username FROM access WHERE username=? AND campusId=? AND role='campus'",[matches[0].jamiaNo,matches[0].jamiaNo]);if(access.length!==1)throw new Error('Login verification failed for '+name);}
 await c.commit();
 console.log(JSON.stringify({verified:true,totalTeams:after.length,added:plan.length,preserved:before.length,credentialsFile:credentialPath}));
 } catch(error){await c.rollback();throw error;} finally{await c.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
