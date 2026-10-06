// Validates deployed PayPal OAuth without creating an order or charging money.
// Creates one isolated synthetic account/session, then removes only those records.
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const origin='https://advancedcpe.com';
const auth=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',"& 'C:\\Program Files\\nodejs\\npx.cmd' --offline wrangler auth token --json"],{encoding:'utf8'}));
const endpoint='https://api.cloudflare.com/client/v4/accounts/ef7d930dd08e89e749df7b27c60f0684/d1/database/fdbc1e0e-50c8-42dd-84aa-e9724ac7f802/query';
async function query(sql,params=[]){
 const r=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+auth.token,'Content-Type':'application/json'},body:JSON.stringify({sql,params})});
 const data=await r.json();if(!r.ok||!data.success||data.result.some(x=>!x.success))throw Error('Cloudflare test database request failed.');return data.result;
}
const id='paypal-connection-test-'+randomUUID(),token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
let created=false;
try{
 await query('INSERT INTO users(id,email,name) VALUES(?,?,?)',[id,id+'@example.invalid','Temporary PayPal connection check']);created=true;
 await query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,unixepoch()+300)',[hash,id]);
 const r=await fetch(origin+'/api/checkout/status',{headers:{Cookie:'__Host-acpe_session='+token}});
 const data=await r.json();assert.equal(r.status,200,data.error||'PayPal verification failed');assert.equal(data.ready,true);
 console.log('PASS: deployed live PayPal credentials authenticated successfully. No order, capture, or purchase created.');
}finally{
 if(created){
  await query('DELETE FROM sessions WHERE user_id=?',[id]);
  await query('DELETE FROM auth_limits WHERE key=?',['paypal-status:'+id]);
  await query('DELETE FROM users WHERE id=?',[id]);
  console.log('Removed the temporary connection-check account and session.');
 }
}
