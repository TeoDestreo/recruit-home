// Caption files arrive as WebVTT or SRT. Everything is stored as WebVTT.
const TIMING=/^(\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}/;
export function toVtt(raw) {
  const text=String(raw).replace(/^﻿/,'').replace(/\r\n?/g,'\n').trim();
  const lines=text.split('\n');
  if(!lines.some(l=>TIMING.test(l.trim())))return null;
  if(/^WEBVTT(\s|$)/.test(text))return text+'\n';
  // SRT: comma decimal separators become periods; numeric cue numbers are valid VTT cue IDs.
  return 'WEBVTT\n\n'+lines.map(l=>TIMING.test(l.trim())?l.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g,'$1.$2'):l).join('\n')+'\n';
}
// Plain transcript from caption cues: drops timings, cue IDs, markup and repeated lines.
export function transcriptFromVtt(vtt) {
  const out=[],lines=vtt.split('\n');let skipBlock=true;// the WEBVTT header block
  for(let i=0;i<lines.length;i++) {
    const l=lines[i].trim();
    if(!l){skipBlock=false;continue;}
    if(/^(NOTE|STYLE|REGION)(\s|$)/.test(l)){skipBlock=true;continue;}
    if(skipBlock||TIMING.test(l)||TIMING.test((lines[i+1]||'').trim()))continue;// timing line or the cue ID above it
    const clean=l.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
    if(clean&&clean!==out.at(-1))out.push(clean);
  }
  return out.join(' ').replace(/\s+/g,' ').replace(/([.?!])\s+/g,'$1\n').trim()||null;
}
