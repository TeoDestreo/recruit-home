// Cloudflare Email Sending. Throws on failure so callers decide whether a failure matters.
export const emailReady=env=>!!(env.CF_EMAIL_API_TOKEN&&env.CF_ACCOUNT_ID);
export const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function sendEmail(env,{to,subject,text,html}) {
  if(!emailReady(env))throw Object.assign(new Error('Email is not configured'),{code:'EMAIL_NOT_CONFIGURED'});
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`,{
    method:'POST',headers:{Authorization:`Bearer ${env.CF_EMAIL_API_TOKEN}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),
    body:JSON.stringify({to,from:env.PASSWORD_RESET_FROM||'noreply@advancedcpe.com',subject,text,html})
  });
  const result=await response.json().catch(()=>null);
  if(!response.ok||!result?.success)throw Object.assign(new Error('Cloudflare email request failed'),{code:`CF_EMAIL_HTTP_${response.status}`});
}
