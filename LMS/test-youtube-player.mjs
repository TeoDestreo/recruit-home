// Unit test the adapter contract without a browser or external network.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const box={children:[],replaceChildren(){this.children=[];},append(e){this.children.push(e);}};
let options,paused=0,destroyed=0,ready=0,states=[],errors=[];
const context={window:{YT:{Player:class{constructor(frame,opts){options=opts;this.frame=frame;}pauseVideo(){paused++;}destroy(){destroyed++;}getCurrentTime(){return 13;}getDuration(){return 100;}getPlayerState(){return 1;}}}},document:{getElementById:()=>box,createElement:()=>({})},location:{origin:'https://lms.test'},setTimeout:()=>1,clearTimeout(){},encodeURIComponent};context.YT=context.window.YT;
vm.runInNewContext(readFileSync(new URL('youtube-player.js',import.meta.url),'utf8'),context);
const p=context.window.CourseYouTube;
await p.load('M7lc1UVf-VE',25.8,{ready:()=>ready++,state:v=>states.push(v),error:v=>errors.push(v)});
assert.equal(options.videoId,'M7lc1UVf-VE');assert.equal(options.playerVars.start,25);assert.equal(options.playerVars.origin,'https://lms.test');
assert.equal(options.host,'https://www.youtube-nocookie.com');
options.events.onReady();options.events.onStateChange({data:1});options.events.onError({data:153});
assert.equal(ready,1);assert.deepEqual(states,[1]);assert.match(errors[0],/153/);assert.equal(p.currentTime,13);assert.equal(p.duration,100);assert.equal(p.paused,false);
p.pause();assert.equal(paused,1);p.destroy();assert.equal(destroyed,1);assert.equal(box.children.length,0);
options.events.onReady();options.events.onStateChange({data:0});assert.equal(ready,1);assert.deepEqual(states,[1]);
console.log('PASS: YouTube adapter origin/referrer, resume, state/position, errors, teardown and stale-event isolation. External playback requires a real browser/network.');
