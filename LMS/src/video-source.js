const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export function youtubeId(value){
 if(typeof value!=='string'||value.length>2048)fail(400,'Enter a YouTube video URL.');
 let u;try{u=new URL(value.trim());}catch{fail(400,'Enter a complete YouTube video URL.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port)fail(400,'Use an HTTPS YouTube link.');
 let id;const host=u.hostname.toLowerCase();
 if(host==='youtu.be')id=u.pathname.slice(1);
 else if(['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(host)){
  if(u.pathname==='/watch')id=u.searchParams.get('v');
  else id=/^\/(?:embed|shorts)\/([^/]+)\/?$/.exec(u.pathname)?.[1];
 }
 if(!/^[A-Za-z0-9_-]{11}$/.test(id||''))fail(400,'Use a single YouTube video link, not a channel or playlist.');
 return id;
}
export function checkVideoChange(course,input,duration){
 if(course.topic_path)fail(400,'Reading guides cannot have course videos.');
 if(input.revision!==course.admin_revision)fail(409,'This course changed. Reload before changing its video.');
 if(!Number.isFinite(duration)||duration<=0||duration>86400)fail(400,'Enter the full video duration in seconds, up to 24 hours.');
 if(!['preserve','reset'].includes(input.progressMode))fail(400,'Choose whether to preserve or reset video progress.');
 if(input.progressMode==='preserve'&&(course.asset_key||course.youtube_id)&&Math.abs(duration-course.duration_seconds)>1)fail(400,'Preserving progress requires the same lesson with the same duration (within one second). Otherwise choose reset.');
}
// A D1 batch is atomic. All statements use the same revision guard; the final
// statement changes that revision. Old objects and progress remain recoverable.
export function videoChangeStatements(env,user,course,source,mode){
 const change=crypto.randomUUID(),guard='EXISTS(SELECT 1 FROM courses WHERE id=? AND admin_revision=?)';
 const args=[course.id,course.admin_revision];
 return [
  env.DB.prepare(`INSERT INTO video_history(id,course_id,user_id,asset_key,youtube_id,duration_seconds,progress_mode) SELECT ?,id,?,asset_key,youtube_id,duration_seconds,? FROM courses WHERE id=? AND admin_revision=?`).bind(change,user.id,mode,...args),
  env.DB.prepare(`INSERT INTO video_progress_archive(change_id,user_id,course_id,position_seconds,watched_seconds,watched_ranges) SELECT ?,user_id,course_id,position_seconds,watched_seconds,watched_ranges FROM course_progress WHERE course_id=? AND ${guard}`).bind(change,course.id,...args),
  env.DB.prepare(`UPDATE course_progress SET playback_token=NULL,revision=revision+1${mode==='reset'?',position_seconds=0,watched_seconds=0,watched_ranges=\'[]\',last_position=0':''} WHERE course_id=? AND ${guard}`).bind(course.id,...args),
  env.DB.prepare('UPDATE courses SET asset_key=?,youtube_id=?,duration_seconds=?,hours=?,admin_revision=admin_revision+1 WHERE id=? AND admin_revision=?').bind(source.assetKey||null,source.youtubeId||null,source.duration,source.duration/3600,...args)
 ];
}
