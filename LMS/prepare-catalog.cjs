// Read only MP4 headers; generate the repeatable seed from actual local files.
const fs = require('node:fs');
const path = require('node:path');
function duration(file) {
  const fd = fs.openSync(file, 'r');
  function scan(start, end) {
    for (let pos = start; pos + 8 <= end;) {
      const h = Buffer.alloc(16); fs.readSync(fd,h,0,16,pos);
      let size = h.readUInt32BE(0), header = 8;
      if (size === 1) { size = Number(h.readBigUInt64BE(8)); header = 16; }
      if (size === 0) size = end-pos;
      if (size < header || pos+size > end) throw Error('Invalid MP4 atom');
      const type = h.toString('ascii',4,8);
      if (type === 'moov') return scan(pos+header,pos+size);
      if (type === 'mvhd') {
        const b = Buffer.alloc(32); fs.readSync(fd,b,0,32,pos+header);
        const v1 = b[0] === 1;
        return (v1 ? Number(b.readBigUInt64BE(24)) : b.readUInt32BE(16)) / b.readUInt32BE(v1?20:12);
      }
      pos += size;
    }
    throw Error('Movie duration header not found');
  }
  try { return scan(0,fs.fstatSync(fd).size); } finally { fs.closeSync(fd); }
}
const files = fs.readdirSync(path.join(__dirname,'Courses')).filter(f=>/^course \d+\.mp4$/i.test(f));
const rows = files.map(file=>({number:Number(file.match(/\d+/)[0]),duration:duration(path.join(__dirname,'Courses',file))})).sort((a,b)=>a.number-b.number);
for (const row of rows) if (!Number.isFinite(row.duration) || row.duration <= 0) throw Error('Invalid duration');
const sql = '-- Generated from MP4 headers. Zero hours means credits are not yet assigned.\n'+rows.map(r=>`INSERT INTO courses (id,title,description,category,level,hours,asset_key,published,duration_seconds) VALUES ('course-${r.number}','Course ${r.number}','On-demand video course.','General','Not specified',0,'courses/course-${r.number}.mp4',1,${r.duration}) ON CONFLICT(id) DO UPDATE SET asset_key=excluded.asset_key,duration_seconds=excluded.duration_seconds;`).join('\n')+'\n';
fs.writeFileSync(path.join(__dirname,'seed-courses.sql'),sql);
console.table(rows);
