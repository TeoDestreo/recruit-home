// Explicit asset allowlist: never ship course sources, SQL, credentials, or backend.
const { mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, cpSync } = require('node:fs');
const {buildSync}=require('esbuild');
const { createHash } = require('node:crypto');
const { join } = require('node:path');
const target = join(__dirname, 'dist');
mkdirSync(join(target,'LMS'), {recursive:true});
const site=require('./site-pages.cjs');
writeFileSync(join(target,'index.html'),readFileSync(join(__dirname,'../index.html'),'utf8').replace('<!-- SITE_NAV -->',site.nav).replace('<!-- SITE_FOOTER -->',site.footer).replace('<!-- ARTICLE_CARDS -->',site.articleCards()));
writeFileSync(join(target,'site.css'),readFileSync(join(__dirname,'site.css'),'utf8')+'\n'+readFileSync(join(__dirname,'site-polish.css'),'utf8'));
const pagePaths=site.build(target);
mkdirSync(join(target,'assets'),{recursive:true});
copyFileSync(join(__dirname,'assets/learning-desk.png'),join(target,'assets/learning-desk.png'));
copyFileSync(join(__dirname,'assets/favicon.svg'),join(target,'favicon.svg'));
const urls=['/','/LMS/',...pagePaths];
writeFileSync(join(target,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(url=>'<url><loc>https://advancedcpe.com'+url+'</loc></url>').join('')+'</urlset>');
writeFileSync(join(target,'robots.txt'),'User-agent: *\nDisallow: /api/\nDisallow: /LMS/certificate\nSitemap: https://advancedcpe.com/sitemap.xml\n');
copyFileSync(join(__dirname,'index.html'),join(target,'LMS/register.html'));
buildSync({entryPoints:[join(__dirname,'src/index.js')],outfile:join(target,'_worker.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',define:{__BUILD_NOTES__:JSON.stringify(readFileSync(join(__dirname,'../README-SETUP.txt'),'utf8'))}});
buildSync({entryPoints:[join(__dirname,'admin.js')],outfile:join(target,'LMS/admin.js'),bundle:true,format:'iife',platform:'browser',target:'es2022'});
for(const name of ['admin.html','admin.css','activity-player.js','youtube-player.js','account.html','account.js','account-nav.js'])copyFileSync(join(__dirname,name),join(target,'LMS',name));
cpSync(join(__dirname,'node_modules/h5p-standalone/dist'),join(target,'LMS/vendor/h5p'),{recursive:true});
copyFileSync(join(__dirname,'node_modules/h5p-standalone/LICENSE'),join(target,'LMS/vendor/h5p/LICENSE.txt'));
copyFileSync(join(__dirname,'node_modules/fflate/LICENSE'),join(target,'LMS/vendor/fflate-LICENSE.txt'));
let adminPage=readFileSync(join(target,'LMS/admin.html'),'utf8');
for(const asset of ['admin.js','admin.css','styles.css']){const source=asset==='admin.js'?join(target,'LMS',asset):join(__dirname,asset);adminPage=adminPage.replace('/LMS/'+asset,'/LMS/'+asset+'?v='+createHash('sha256').update(readFileSync(source)).digest('hex').slice(0,12));}
writeFileSync(join(target,'LMS/admin.html'),adminPage);
for (const name of ['index.html','app.js','styles.css','certificate.html','certificate.js','certificate.css']) copyFileSync(join(__dirname,name),join(target,'LMS',name));
// Version assets so an existing browser cannot retain old registration behavior.
let learningPage=readFileSync(join(__dirname,'index.html'),'utf8');
learningPage=learningPage.replace('</head>','<link rel="icon" type="image/svg+xml" href="/favicon.svg"><meta name="theme-color" content="#101b35"></head>');
for(const asset of ['app.js','styles.css','youtube-player.js']){
 const version=createHash('sha256').update(readFileSync(join(__dirname,asset))).digest('hex').slice(0,12);
 learningPage=learningPage.replace('/LMS/'+asset,'/LMS/'+asset+'?v='+version);
}
writeFileSync(join(target,'LMS/index.html'),learningPage);
writeFileSync(join(target,'LMS/register.html'),learningPage);
const certificatePage=readFileSync(join(__dirname,'certificate.html'),'utf8').replace('</head>','<link rel="icon" type="image/svg+xml" href="/favicon.svg"><meta name="robots" content="noindex"></head>');
writeFileSync(join(target,'LMS/certificate.html'),certificatePage);
const siteVersion=createHash('sha256').update(readFileSync(join(target,'site.css'))).digest('hex').slice(0,12);
function versionPages(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())versionPages(path);else if(item.name.endsWith('.html'))writeFileSync(path,readFileSync(path,'utf8').replace('href="/site.css"','href="/site.css?v='+siteVersion+'"'));}}
function accountLinks(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())accountLinks(path);else if(item.name.endsWith('.html')){let html=readFileSync(path,'utf8');if(!path.startsWith(join(target,'LMS')+require('node:path').sep))html=html.replace('</head>','<script src="/LMS/account-nav.js?v='+createHash('sha256').update(readFileSync(join(__dirname,'account-nav.js'))).digest('hex').slice(0,12)+'" defer></script></head>');else if(item.name==='account.html'){for(const asset of ['account.js','styles.css'])html=html.replace('/LMS/'+asset,'/LMS/'+asset+'?v='+createHash('sha256').update(readFileSync(join(__dirname,asset))).digest('hex').slice(0,12));}writeFileSync(path,html);}}}
accountLinks(target);
versionPages(target);
console.log('Built homepage and LMS assets in LMS/dist');
