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
 const c=await mysql.createConnection({host:process.env.MYSQL_HOST,port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER,password:process.env.MYSQL_PASSWORD,database:process.env.MYSQL_DATABASE});
 try {
 const [teams]=await c.query('SELECT id,jamiaNo,name,shortName,strength,categories,password FROM campus ORDER BY id');
 const [admins]=await c.query("SELECT username,role,campusId FROM access WHERE role='admin' ORDER BY id LIMIT 1");
 const original=teams.filter(t=>!names.includes(t.name));
 console.log(JSON.stringify({existingPasswordFormats:original.map(t=>({name:t.name,hashed:/^\$2[aby]\$/.test(t.password)})),rotate:teams.filter(t=>names.includes(t.name)).length}));
 if(!process.argv.includes('--apply'))return;
 const credentials=JSON.parse(fs.readFileSync(credentialPath,'utf8'));
 const {webcrypto}=require('node:crypto');
 function exactPassword(length=16){const groups=['ABCDEFGHJKLMNPQRSTUVWXYZ','abcdefghijkmnopqrstuvwxyz','23456789','!@#$%&*_-+'];const randomIndex=size=>{const values=new Uint32Array(1);webcrypto.getRandomValues(values);return values[0]%size;};const result=groups.map(group=>group[randomIndex(group.length)]);const all=groups.join('');while(result.length<length)result.push(all[randomIndex(all.length)]);return result.map(character=>({character,order:randomIndex(1000000)})).sort((a,b)=>a.order-b.order).map(({character})=>character).join('');}
 for(const team of teams.filter(t=>names.includes(t.name))){
 const record=credentials.find(r=>r.username===team.jamiaNo&&r.name===team.name);if(!record)throw new Error('Missing credential record');
 if(record.rotationStatus==='verified')continue;
 if(!record.pendingPassword){record.pendingPassword=exactPassword();record.rotationKey=randomUUID();fs.writeFileSync(credentialPath,JSON.stringify(credentials,null,2),{mode:0o600});}
 await request(admins[0],'action=teamSave',{id:team.id,jamiaNo:team.jamiaNo,name:team.name,shortname:team.shortName,strength:team.strength,categories:team.categories.split(','),password:record.pendingPassword},randomUUID());
 await c.execute('UPDATE campus SET password=? WHERE id=? AND jamiaNo=?',[record.pendingPassword,team.id,team.jamiaNo]);
 const [[stored]]=await c.execute('SELECT c.password AS displayPassword,a.password AS loginPassword FROM campus c JOIN access a ON a.username=c.jamiaNo AND a.campusId=c.jamiaNo WHERE c.jamiaNo=?',[team.jamiaNo]);
 const loginOK=/^\$2[aby]\$/.test(stored.loginPassword)?await require('bcryptjs').compare(record.pendingPassword,stored.loginPassword):stored.loginPassword===record.pendingPassword;
 if(stored.displayPassword!==record.pendingPassword || !loginOK)throw new Error('Password verification failed for '+team.jamiaNo+'; displayMatches='+String(stored.displayPassword===record.pendingPassword)+'; loginMatches='+String(loginOK));
 record.password=record.pendingPassword;delete record.pendingPassword;record.rotationStatus='verified';fs.writeFileSync(credentialPath,JSON.stringify(credentials,null,2),{mode:0o600});console.log('Rotated and verified '+team.jamiaNo);
 }
 for(const old of original){const [[current]]=await c.execute('SELECT password FROM campus WHERE jamiaNo=?',[old.jamiaNo]);if(current.password!==old.password)throw new Error('Original team password changed');}
 console.log('Verified all 22 rotated passwords for display and login; original 3 preserved.');
 } finally{await c.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
