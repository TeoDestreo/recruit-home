// Loaded only when an enrolled learner opens a YouTube-backed lesson.
window.CourseYouTube=(()=>{
 let loading,player,generation=0;
 const api=()=>loading||(loading=new Promise((resolve,reject)=>{
  if(window.YT?.Player){resolve();return;}
  const timer=setTimeout(()=>{loading=null;reject(Error('YouTube did not load. Check your connection or browser content blocker.'));},20000);
  window.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);resolve();};
  const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.onerror=()=>{clearTimeout(timer);loading=null;reject(Error('Unable to load YouTube.'));};document.head.append(s);
 }));
 return {
  async load(id,position,events){const g=++generation;await api();if(g!==generation)return;const box=document.getElementById('youtube-container');box.replaceChildren();const mount=document.createElement('div');mount.id='youtube-frame';box.append(mount);
   const timeout=setTimeout(()=>{if(g===generation)events.error('YouTube did not finish loading. Check your connection or content blocker, then reopen the course.');},25000);
   player=new YT.Player('youtube-frame',{host:'https://www.youtube-nocookie.com',width:'100%',height:450,videoId:id,playerVars:{enablejsapi:1,playsinline:1,origin:location.origin,start:Math.floor(position)},events:{onReady:()=>{clearTimeout(timeout);if(g===generation)events.ready();},onStateChange:e=>{if(g===generation)events.state(e.data);},onError:e=>{clearTimeout(timeout);if(g===generation)events.error('YouTube cannot play this video (code '+e.data+'). It may be private, removed, restricted, or embedding may be disabled. Contact support.');}}});
  },
  pause(){player?.pauseVideo?.();},
  destroy(){generation++;player?.destroy?.();player=null;document.getElementById('youtube-container').replaceChildren();},
  get currentTime(){return player?.getCurrentTime?.()||0;},
  get duration(){return player?.getDuration?.()||0;},
  get paused(){return player?.getPlayerState?.()!==1;},
  get seeking(){return player?.getPlayerState?.()===3;}
 };
})();
