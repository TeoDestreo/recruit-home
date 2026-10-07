const $=id=>document.getElementById(id);
const registrationPage=()=>/^\/LMS\/register(?:\.html)?\/?$/.test(location.pathname);
let user=null,courses=[],register=false,active=null,token=null,saving=false,watching=false,ready=false,adminCoursePreview=false;
let resetToken=new URLSearchParams(location.hash.slice(1)).get('reset')||'';
if(resetToken)history.replaceState(null,'',location.pathname+location.search);
let config={},pendingCourse=null,challengeToken='',widgetId=null,challengeScript=null;
let testStatus=null,testAttempt=null,testSubmitting=false;
let activitySession=null;
let videoType='upload';
const media=()=>videoType==='youtube'?window.CourseYouTube:$('video');
const pauseMedia=()=>videoType==='youtube'?window.CourseYouTube.pause():$('video').pause();
function message(text='',error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
async function api(path,data){
  const response=await fetch('/api'+path,{credentials:'same-origin',...(data!==undefined?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});
  const result=await response.json().catch(()=>({error:'The server did not return a valid response.'}));
  if(!response.ok) throw Object.assign(new Error(result.error||'Request failed.'),{status:response.status});
  return result;
}
function show(section){for(const id of ['auth','forgot-panel','reset-panel','library','player','paywall','test','interactive'])$(id).hidden=id!==section;$('account').hidden=!user;$('login').hidden=!!user;$('admin-link').hidden=!user?.admin;$('view-certificate').hidden=section!=='player'||!active?.completed_at;}
function text(tag,value,className){const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;}
function progressLabel(c){return c.completed_at?'Completed':c.watched_seconds>0?'In progress':'Not started';}
function percent(c){return Math.min(100,Math.floor(c.watched_seconds/c.duration_seconds*100))||0;}
function draw(){
  const q=$('search').value.trim().toLowerCase(),category=$('category').value,status=$('status').value,format=$('format').value;
  const visible=courses.filter(c=>(!q||(c.title+' '+c.description+' '+c.course_code).toLowerCase().includes(q))&&(!category||c.category===category)&&(!format||(format==='video'?c.available:!c.available))&&(!status||(c.available&&(status==='complete'?!!c.completed_at:status==='started'?!c.completed_at&&c.watched_seconds>0:!c.completed_at&&!c.watched_seconds))));
  $('courses').replaceChildren();$('empty').hidden=visible.length>0;
  $('summary').textContent=`${courses.filter(c=>c.available).length} video courses · ${courses.filter(c=>!c.available).length} free reading topics${user?` · ${courses.filter(c=>c.completed_at).length} completed`:''}`;
  const groups=new Map();
  for(const c of visible){
    if(!groups.has(c.category)){
      const section=text('section','','category-group');section.append(text('h2',c.category));const grid=text('div','','grid');section.append(grid);$('courses').append(section);groups.set(c.category,grid);
    }
    const card=text('article','','card'),kind=c.available?'Video':c.content_type==='article'?'Article':c.content_type==='guide'?'Reading guide':'Learning item';card.append(text('span',`${c.course_code} · ${kind}`,'tag'),text('h3',c.title),text('p',c.description),text('small',c.available?`${Math.ceil(c.duration_seconds/60)} minutes · ${c.has_access?progressLabel(c):'Library access required'}`:c.access_tier==='free'?'Free learning resource': 'Course Pack access required',c.completed_at?'complete':''));
    if(user&&c.has_access&&c.available){const progress=document.createElement('progress');progress.max=100;progress.value=percent(c);progress.setAttribute('aria-label',`${c.title}: ${percent(c)}% watched`);card.append(progress);}
    if(!c.available&&c.topic_path&&c.article_published){const link=text('a',c.content_type==='article'?'Read article →':'Read topic →','topic-link');link.href=c.topic_path;card.append(link);}
    if(c.test_published||c.lumi_published){const testButton=text('button',c.test_published?'Open course modules':'Open Lumi activity');testButton.onclick=()=>user?openTestOnly(c,testButton):(show('auth'),authMode(false),message('Sign in or create an account to open this learning module.'));card.append(testButton);}
    else {const button=text('button',!c.has_access?'View enrollment':c.completed_at?'Watch again':c.position_seconds>0?'Continue learning':'Start course');button.onclick=()=>c.has_access?openCourse(c,button):showPaywall(c);card.append(button);}groups.get(c.category).append(card);
    if(c.completed_at){const cb=text('button','View certificate','secondary');cb.onclick=()=>viewCertificate(c.id,cb);card.append(cb);}
  }
}
async function library(){
  ({courses}=await api('/courses'));courses.sort((a,b)=>a.category.localeCompare(b.category)||Number(a.id.replace('course-',''))-Number(b.id.replace('course-','')));$('category').replaceChildren(new Option('All topics',''),...[...new Set(courses.map(c=>c.category))].map(c=>new Option(c,c)));
  $('greeting').textContent=user?`Hi, ${user.name}`:'';$('status').disabled=!user;if(!user)$('status').value='';show('library');draw();message();
}
function showPaywall(course){pendingCourse=course;$('paywall-title').textContent=course.title;$('paywall-description').textContent=course.description;$('paywall-login').hidden=!!user;$('checkout-actions').hidden=!user;$('paypal-checkout').disabled=!config.checkoutAvailable;$('coupon-form').hidden=!config.couponAvailable;$('checkout-status').textContent=config.checkoutAvailable?'Secure checkout on PayPal. Your courses unlock after payment is confirmed.':'PayPal checkout is being connected. If you have a coupon, you can redeem it now after signing in.';show('paywall');message();}
function paymentOrder(){return new URLSearchParams(location.search).get('checkout')==='return'?new URLSearchParams(location.search).get('token'):null;}
async function confirmPayment(){
  if(!paymentOrder())return;
  $('payment-recovery').hidden=false;
  if(!user){authMode(false);message('Sign in with the account used for checkout to confirm your payment.');return;}
  $('payment-retry').disabled=true;message('Confirming your PayPal payment…');
  try{const result=await api('/checkout/capture',{orderId:paymentOrder()});if(result.access!=='library')throw Error('Payment was recorded, but access is no longer active. Please contact Advanced CPE.');history.replaceState(null,'','/LMS/');$('payment-recovery').hidden=true;pendingCourse=null;await library();message('Payment confirmed! Your one-year video library access is ready.');}
  catch(e){message(e.message,true);}finally{$('payment-retry').disabled=false;}
}
$('payment-retry').onclick=confirmPayment;
$('payment-dismiss').onclick=()=>{history.replaceState(null,'','/LMS/');$('payment-recovery').hidden=true;message('Checkout confirmation dismissed. If you were charged but courses are locked, contact Advanced CPE.');};
$('paypal-checkout').onclick=async()=>{const button=$('paypal-checkout');button.disabled=true;message('Opening secure PayPal checkout…');try{const result=await api('/checkout/create',{});location.assign(result.approvalUrl);}catch(e){message(e.message,true);button.disabled=!config.checkoutAvailable;}};
$('coupon-form').onsubmit=async event=>{event.preventDefault();$('coupon-submit').disabled=true;try{await api('/checkout/coupon',{code:$('coupon-code').value});$('coupon-code').value='';pendingCourse=null;await library();message('Coupon redeemed! Your one-year video library access is ready. No payment required.');}catch(e){message(e.message,true);}finally{$('coupon-submit').disabled=false;}};
async function stopPlayer(){await save();ready=false;watching=false;active=null;adminCoursePreview=false;window.CourseYouTube.destroy();videoType='upload';testStatus=null;testAttempt=null;activitySession=null;$('activity-frame').removeAttribute('src');$('test-questions').replaceChildren();pauseMedia();$('video').removeAttribute('src');$('video').load();}
async function securityCheck(){
  if(!register)return;
  $('security-status').textContent='Loading security check…';challengeToken='';
  if(!config.turnstileSiteKey){$('security-status').textContent='Registration is temporarily unavailable. You can still browse courses.';return;}
  try{
    if(!challengeScript)challengeScript=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.onload=resolve;s.onerror=reject;document.head.append(s);});
    await challengeScript;if(!register)return;
    if(widgetId!==null)window.turnstile.reset(widgetId);
    else widgetId=window.turnstile.render('#security-check',{sitekey:config.turnstileSiteKey,action:'signup',size:'flexible',callback:value=>{challengeToken=value;$('security-status').textContent='Security check complete.';},'expired-callback':()=>{challengeToken='';$('security-status').textContent='Security check expired. Please complete it again.';},'error-callback':()=>{challengeToken='';$('security-status').textContent='Unable to complete the security check. Please try again.';}});
  }catch{$('security-status').textContent='Unable to load the security check. Please refresh and try again.';}
}
function authMode(create){register=create;$('name-row').hidden=!register;$('name-row').disabled=!register;$('auth').classList.toggle('registration',register);$('security-check').hidden=!register;$('security-status').textContent='';$('auth-title').textContent=register?'Create your account.':'Welcome back.';$('auth-submit').textContent=register?'Create account':'Sign in';$('auth-toggle').textContent=register?'Already have an account? Sign in':'New here? Create an account';$('forgot-password').hidden=register||!config.passwordResetAvailable;$('password').autocomplete=register?'new-password':'current-password';show('auth');message();if(register)securityCheck();}
function profileData(){const fields={};for(const [key,id] of Object.entries({firstName:'first-name',lastName:'last-name',organization:'organization',jobTitle:'job-title',city:'city',region:'region',country:'country',phone:'phone',designation:'designation',licenseNumber:'license-number',licenseRegion:'license-region'}))fields[key]=$(id).value;return {...fields,marketingOptIn:$('marketing-opt-in').checked};}
$('browse').onclick=async()=>{await stopPlayer();pendingCourse=null;try{await library();}catch(e){message(e.message,true);}};
$('login').onclick=async()=>{await stopPlayer();authMode(false);};
$('paywall-login').onclick=()=>authMode(false);
$('paywall-back').onclick=()=>{pendingCourse=null;show('library');};
function updateProgress(){if(!active)return;$('progress-bar').value=percent(active);$('progress-text').textContent=active.completed_at?`Completed on ${new Date(active.completed_at.replace(' ','T')+'Z').toLocaleDateString()}`:`${percent(active)}% watched${percent(active)>=95?' · Video requirement met; pass the test to complete the course.':''}`;$('view-certificate').hidden=!active.completed_at||$('player').hidden;drawTestStatus();}
function drawTestStatus(){
  if(!active)return;
  const passed=testStatus?.passed||testStatus?.certificateId;
  const activities=testStatus?.activities||[],blocked=activities.some(a=>a.required&&!a.completed);
  $('activity-panel').hidden=!activities.length;$('admin-preview-note').hidden=!adminCoursePreview;
  $('activity-description').textContent=activities.length?`${activities.filter(a=>a.required).length} required · ${activities.length} total. All required activities must be completed before the test.`:'';
  const list=$('course-activity-list');list.replaceChildren();for(const activity of activities){const row=document.createElement('article');row.className='activity-item';row.append(text('h3',activity.title),text('p',`${activity.required?'Required':'Optional'} · ${activity.completed?'Completed':'Not completed'}`));const open=text('button','Open activity');open.onclick=()=>openCourseActivity(activity);row.append(open);if(adminCoursePreview){const label=document.createElement('label');label.className='check-label';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=activity.completed;checkbox.setAttribute('aria-label',`Mark ${activity.title} complete for your administrator account`);checkbox.onchange=async()=>{checkbox.disabled=true;try{await api(`/admin/courses/${active.id}/activities/${activity.id}/completion`,{completed:checkbox.checked});testStatus=await api(`/courses/${active.id}/test`);drawTestStatus();}catch(error){checkbox.checked=!checkbox.checked;message(error.message,true);}finally{checkbox.disabled=false;}};label.append(checkbox,text('span','Mark complete in admin preview'));row.append(label);}list.append(row);}
  $('test-status').closest('.panel').hidden=!active.test_published;
  if(!active.test_published){$('take-test').hidden=true;return;}
  $('take-test').hidden=!!passed;
  $('take-test').disabled=!testStatus||!testStatus.eligible||testStatus.attemptsRemaining===0||blocked;
  $('test-status').textContent=!testStatus?'Loading test status…':passed?'Completed. Your certificate is available.':`${testStatus.attemptsRemaining} of 3 attempts remaining.${testStatus.lastScore===null?'':` Last score: ${testStatus.lastScore}% — not passed.`} ${testStatus.attemptsRemaining===0?'You have used all three attempts. No certificate is available for this course.':!testStatus.eligible?'Watch at least 95% to unlock the test.':'You can start or resume your test.'}`;
  if(blocked&&!passed)$('test-status').textContent=$('test-status').textContent.replace('You can start or resume your test.','')+' Complete the required interactive activity to unlock the test.';
}
$('admin-return').onclick=()=>location.href='/LMS/admin';
async function openTestOnly(course,button){button.disabled=true;message();try{active=course;adminCoursePreview=false;ready=false;watching=false;token=null;videoType='upload';window.CourseYouTube.destroy();$('video').hidden=true;$('video').removeAttribute('src');$('video').load();$('video').nextElementSibling.hidden=true;$('youtube-container').hidden=true;$('youtube-notice').hidden=true;$('course-title').textContent=course.title;$('course-description').textContent=course.description;$('admin-preview-note').hidden=true;$('view-certificate').hidden=true;const activities=course.lumi_published?await api(`/courses/${course.id}/activities`):{activities:[]};testStatus=course.test_published?await api(`/courses/${course.id}/test`):{...activities,eligible:false,attemptsRemaining:0,lastScore:null};if(course.test_published&&course.lumi_published)testStatus.activities=activities.activities;show('player');drawTestStatus();message();}catch(e){if(e.status===401){active=null;show('auth');authMode(false);message('Sign in or create an account to open this learning module.');}else if(e.status===402)showPaywall(course);else message(e.message,true);}finally{button.disabled=false;}}
async function openCourseActivity(activity){if(!active)return;const course=active;try{await save();pauseMedia();watching=false;activitySession=await api(`/courses/${course.id}/activity/launch`,{packageId:activity.id});if(active!==course)return;$('activity-title').textContent=activity.title;$('activity-feedback').textContent='Complete the entire activity. Completion saves automatically; opening it alone does not count.';$('activity-frame').src=activitySession.playerUrl;show('interactive');message();}catch(e){message(e.message,true);}}
window.addEventListener('message',async e=>{if(!active||!activitySession||e.source!==$('activity-frame').contentWindow||e.origin!=='null'||e.data?.type!=='acpe-activity-complete'||e.data.token!==activitySession.token)return;try{await api(`/courses/${active.id}/activity/complete`,e.data);testStatus=active.test_published?await api(`/courses/${active.id}/test`):await api(`/courses/${active.id}/activities`);drawTestStatus();$('activity-feedback').textContent='Activity completed and saved.';}catch(err){$('activity-feedback').textContent='Completion was not saved: '+err.message+'. Finish the activity again or reopen it to retry.';}});
$('activity-back').onclick=async()=>{activitySession=null;$('activity-frame').removeAttribute('src');try{testStatus=active.test_published?await api(`/courses/${active.id}/test`):await api(`/courses/${active.id}/activities`);show('player');updateProgress();}catch(e){message(e.message,true);}};
async function startTest(){
  if(!active||testSubmitting)return;
  const course=active;$('take-test').disabled=true;$('test-retry').disabled=true;message();
  try{
    await save();pauseMedia();watching=false;
    const attempt=await api(`/courses/${course.id}/test/start`,{});
    if(active!==course)return;
    testAttempt=attempt;testStatus=attempt.status;
    $('test-title').textContent=course.title;
    $('test-instructions').textContent=`Attempt ${attempt.attemptNumber} of 3 · Answer all 10 questions. You need 8 correct answers (80%) or more to pass. Opening or resuming a test does not use an attempt. Unsubmitted selections are not saved when you leave this page.`;
    $('test-questions').replaceChildren();
    attempt.questions.forEach((q,i)=>{
      const field=document.createElement('fieldset');field.className='test-question';field.append(text('legend',`${i+1}. ${q.prompt}`));
      q.options.forEach((option,j)=>{const label=document.createElement('label');label.className='test-option';const input=document.createElement('input');input.type='radio';input.name=`question-${i}`;input.value=String(j);input.required=true;label.append(input,text('span',option));field.append(label);});
      $('test-questions').append(field);
    });
    $('test-form').hidden=false;$('test-result').hidden=true;show('test');$('test-title').focus();
  }catch(e){message(e.message,true);try{testStatus=await api(`/courses/${course.id}/test`);}catch{}drawTestStatus();}
  finally{$('test-retry').disabled=false;drawTestStatus();}
}
$('take-test').onclick=startTest;$('test-retry').onclick=startTest;
$('test-back').onclick=()=>{if(testSubmitting)return;testAttempt=null;$('test-questions').replaceChildren();show('player');updateProgress();message();};
$('test-certificate').onclick=()=>viewCertificate(active.id,$('test-certificate'));
$('test-form').onsubmit=async event=>{
  event.preventDefault();if(!active||!testAttempt||testSubmitting)return;
  const answers=testAttempt.questions.map((_,i)=>$('test-form').querySelector(`input[name="question-${i}"]:checked`));
  if(answers.some(x=>!x)){message('Please answer every question before submitting.',true);return;}
  const course=active;testSubmitting=true;$('test-submit').disabled=true;$('test-back').disabled=true;message('Submitting your test…');
  for(const id of ['browse','login','logout'])$(id).disabled=true;
  try{
    const result=await api(`/courses/${course.id}/test/submit`,{attemptId:testAttempt.attemptId,answers:answers.map(x=>Number(x.value))});
    $('test-questions').replaceChildren();testAttempt=null;
    if(active!==course)return;
    testStatus=result.status;$('test-form').hidden=true;$('test-result').hidden=false;
    $('test-instructions').textContent=`Attempt ${result.attemptNumber} of 3 · Submitted. Results show your score and pass/fail only.`;
    $('test-outcome').textContent=result.passed?'Passed — congratulations!':'Not passed';
    $('test-score').textContent=`Your score: ${result.score}%. A score over 70% is required to pass.`;
    $('test-remaining').textContent=result.passed?'Your completion has been recorded and your certificate is ready.':result.status.attemptsRemaining?`${result.status.attemptsRemaining} attempt${result.status.attemptsRemaining===1?'':'s'} remaining. Review the lesson before trying again.`:'You have used all 3 attempts for this course. No certificate has been issued.';
    $('test-certificate').hidden=!result.passed;$('test-retry').hidden=result.passed||result.status.attemptsRemaining===0;
    if(result.passed){course.completed_at=new Date().toISOString().slice(0,19).replace('T',' ');try{const refreshed=await api('/courses');Object.assign(course,refreshed.courses.find(c=>c.id===course.id));}catch{/* Certificate is already recorded; a catalog refresh can wait. */}}
    updateProgress();message();$('test-outcome').focus();
  }catch(e){message(`${e.message} If your connection was interrupted, retry this submission; the same attempt will not be counted twice.`,true);}
  finally{testSubmitting=false;$('test-submit').disabled=false;$('test-back').disabled=false;for(const id of ['browse','login','logout'])$(id).disabled=false;}
};
async function viewCertificate(courseId,button){
  button.disabled=true;
  try{const {certificate}=await api(`/courses/${courseId}/certificate`,{});ready=false;watching=false;pauseMedia();location.href=`/LMS/certificate.html?id=${encodeURIComponent(certificate.id)}`;}
  catch(e){message(e.message,true);button.disabled=false;}
}
$('view-certificate').onclick=()=>viewCertificate(active.id,$('view-certificate'));
async function openCourse(course,button){
  button.disabled=true;message();
  try{
    const params=new URLSearchParams(location.search);adminCoursePreview=!!user?.admin&&params.get('adminPreview')===course.id;
    const p=await api(`/courses/${course.id}/start`,{});active=course;Object.assign(course,{position_seconds:p.position_seconds,watched_seconds:p.watched_seconds,duration_seconds:p.duration_seconds});window.CourseYouTube.destroy();videoType=p.video?.type||'upload';$('video').hidden=videoType==='youtube';$('youtube-container').hidden=videoType!=='youtube';$('youtube-notice').hidden=videoType!=='youtube';token=p.token;ready=false;watching=false;testStatus=null;testAttempt=null;
    $('course-title').textContent=course.title;$('course-description').textContent=course.description;$('save-status').textContent='';
    const v=$('video');if(videoType==='youtube'){await window.CourseYouTube.load(p.video.id,course.completed_at?0:p.position_seconds,{ready:()=>{ready=true;},state:async state=>{if(!active||active.id!==course.id)return;if(state===1){if(media().duration>0&&Math.abs(media().duration-course.duration_seconds)>2){ready=false;pauseMedia();message('This video duration does not match the course settings. Please contact support so it can be corrected.',true);return;}await save(false);watching=ready;}else{const was=watching;watching=false;await save(state===3?false:was);}},error:text=>{ready=false;watching=false;message(text,true);}});}else v.src=`/api/courses/${course.id}/video`;
    v.onloadedmetadata=()=>{v.currentTime=course.completed_at?0:Math.min(p.position_seconds,Math.max(0,v.duration-1));ready=true;};
    $('test-status').closest('.panel').hidden=!course.test_published;show('player');updateProgress();testStatus=course.test_published?await api(`/courses/${course.id}/test`):null;if(course.test_published)drawTestStatus();
  }catch(e){if(e.status===402)showPaywall(course);else message(e.message,true);}finally{button.disabled=false;}
}
async function save(playing=watching){
  if(!active||!ready||saving)return;
  saving=true;const course=active,v=media();
  try{
    const p=await api(`/courses/${course.id}/progress`,{token,position:v.currentTime,playing});Object.assign(course,p);updateProgress();$('save-status').textContent='Progress saved';
  }catch(e){$('save-status').textContent=`Progress not saved: ${e.message}`;if([401,402,409].includes(e.status)){watching=false;pauseMedia();ready=false;message(e.message,true);}}
  finally{saving=false;}
}
$('auth-toggle').onclick=()=>authMode(!register);
$('forgot-password').onclick=()=>{$('reset-email').value=$('email').value;show('forgot-panel');message();};
$('forgot-back').onclick=()=>authMode(false);
$('forgot-form').onsubmit=async event=>{event.preventDefault();$('forgot-submit').disabled=true;message();try{const result=await api('/auth/password-reset/request',{email:$('reset-email').value});$('forgot-panel').hidden=true;authMode(false);message(result.message);}catch(e){message(e.message,true);}finally{$('forgot-submit').disabled=false;}};
$('reset-back').onclick=()=>authMode(false);
$('reset-form').onsubmit=async event=>{event.preventDefault();if(!resetToken){message('This reset link is missing or expired. Request a new password reset.',true);return;}const password=$('new-password').value;if(password!==$('confirm-password').value){message('The passwords do not match.',true);return;}$('reset-submit').disabled=true;message();try{const result=await api('/auth/password-reset/complete',{token:resetToken,password});resetToken='';user=null;$('new-password').value='';$('confirm-password').value='';authMode(false);message(result.message);}catch(e){message(e.message,true);}finally{$('reset-submit').disabled=false;}};
$('auth-form').onsubmit=async event=>{event.preventDefault();if(register&&!challengeToken){message('Please complete the security check.',true);return;}$('auth-submit').disabled=true;message();try{({user}=await api('/auth/'+(register?'register':'login'),{...(register?profileData():{}),email:$('email').value,password:$('password').value,turnstileToken:challengeToken}));$('password').value='';if(registrationPage())history.replaceState(null,'','/LMS/');if(new URLSearchParams(location.search).get('next')==='account'){location.href='/LMS/account';return;}await library();if(paymentOrder())await confirmPayment();else if(pendingCourse)showPaywall(pendingCourse);}catch(e){message(e.message,true);}finally{$('auth-submit').disabled=false;if(register){challengeToken='';if(widgetId!==null)window.turnstile.reset(widgetId);}}};
$('logout').onclick=async()=>{try{await stopPlayer();await api('/auth/logout',{});user=null;pendingCourse=null;await library();}catch(e){message(e.message,true);}};
$('back').onclick=async()=>{await stopPlayer();try{await library();}catch(e){message(e.message,true);}};
for(const id of ['search','category','status','format'])$(id).addEventListener('input',draw);
$('video').addEventListener('play',async()=>{await save(false);watching=true;});
$('video').addEventListener('pause',()=>{const was=watching;watching=false;save(was);});
$('video').addEventListener('seeking',()=>{watching=false;});
$('video').addEventListener('seeked',async()=>{await save(false);watching=!$('video').paused;});
$('video').addEventListener('ended',()=>save(true));
$('video').addEventListener('error',()=>{if(active)message('The video could not load. Please return to the library and reopen the course.',true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)pauseMedia();});
setInterval(()=>{if(active&&!media().paused&&!media().seeking)save(watching);},10000);
window.addEventListener('beforeunload',()=>{if(active&&ready)fetch(`/api/courses/${active.id}/progress`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',keepalive:true,body:JSON.stringify({token,position:media().currentTime,playing:watching})});});
(async()=>{try{const [me,settings]=await Promise.all([api('/me'),api('/config')]);user=me.user;config=settings;await library();if(resetToken){show('reset-panel');message();return;}if(user&&new URLSearchParams(location.search).get('next')==='account'){location.href='/LMS/account';return;}if(new URLSearchParams(location.search).get('course')){const params=new URLSearchParams(location.search),c=courses.find(c=>c.id===params.get('course')),adminPreview=!!user?.admin&&params.get('adminPreview')===c?.id;if(c?.available&&(c.has_access||adminPreview)){adminCoursePreview=adminPreview;await openCourse(c,$('browse'));}}if(paymentOrder())await confirmPayment();else if(new URLSearchParams(location.search).get('checkout')==='cancel'){history.replaceState(null,'','/LMS/');message('PayPal checkout canceled. You can try again or redeem a coupon.');}else if(!user&&registrationPage())authMode(true);else if(!user&&new URLSearchParams(location.search).get('login')==='1')authMode(false);}catch(e){message('Unable to reach the learning service. Please refresh to try again.',true);}})();
