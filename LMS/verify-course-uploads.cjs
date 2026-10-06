// Run from the repository root. Downloads stream into a hash, not onto disk.
const { createReadStream, readdirSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const { join, dirname } = require('node:path');
async function digest(stream) {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of stream) { bytes += chunk.length; hash.update(chunk); }
  return { bytes, sha256: hash.digest('hex') };
}
async function main() {
  const start = Number(process.argv[2] || 0);
  const files = readdirSync(join(__dirname, 'Courses')).filter(x => /^course \d+\.mp4$/i.test(x))
    .filter(x => Number(x.match(/\d+/)[0]) >= start)
    .sort((a,b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  for (const file of files) {
    const number = Number(file.match(/\d+/)[0]);
    const key = `advancedcpe-r2/courses/course-${number}.mp4`;
    const local = await digest(createReadStream(join(__dirname, 'Courses', file)));
    const child = spawn(process.execPath, [join(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js'), '--offline', 'wrangler', 'r2', 'object', 'get', key, '--config=./LMS/wrangler.toml', '--remote', '--pipe'], {
      cwd: join(__dirname, '..'), env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
      stdio: ['ignore','pipe','inherit'], windowsHide: true
    });
    const done = new Promise((resolve,reject) => {
      child.on('error',reject);
      child.on('close', code => code === 0 ? resolve() : reject(new Error(`Download failed: ${key} (${code})`)));
    });
    const [remote] = await Promise.all([digest(child.stdout), done]);
    if (local.bytes !== remote.bytes || local.sha256 !== remote.sha256) throw new Error(`Verification mismatch: ${key}`);
    console.log(`VERIFIED ${key} | ${remote.bytes} bytes | SHA256 ${remote.sha256}`);
  }
  console.log(`All ${files.length} remote course files match their local sources.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
