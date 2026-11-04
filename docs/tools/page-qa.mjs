#!/usr/bin/env node
/* Page QA and fallback snapshots for the live page, driven by docs/build_assets.py.
   node docs/tools/page-qa.mjs --docs docs [--snap] [--qa] [--lighthouse] [--pages index.html,...]
   --snap        render every [data-viz] scene at full progress in both themes to assets/viz_<name>_<theme>.png (static fallback)
   --qa          screenshots in both themes: hero, the first two body scenes, a 375 px hero, plus a console-error check, to qa/<theme>/
   --lighthouse  desktop Lighthouse run against the served page, report to qa/lighthouse.report.{html,json}
   Needs the globally installed playwright (and its Chromium) and, for --lighthouse, the lighthouse CLI. */
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright'); // global playwright resolves through NODE_PATH
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { spawn } from 'node:child_process';
const args = process.argv.slice(2); const opt = k => { const i = args.indexOf(k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null; };
const DOCS = path.resolve(opt('--docs') || 'docs'), SNAP = !!opt('--snap'), QA = !!opt('--qa'), LH = !!opt('--lighthouse');
const PAGES = (opt('--pages') || 'index.html').split(','); const HERO_JSON = opt('--hero-json'); const HERO_PNG = !!opt('--hero-png');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.md': 'text/markdown', '.csv': 'text/csv', '.txt': 'text/plain', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const fp = path.join(DOCS, p); if (!fp.startsWith(DOCS) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream', 'cache-control': 'no-cache' }); fs.createReadStream(fp).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const PORT = server.address().port; const base = `http://127.0.0.1:${PORT}/`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function open(pageName, theme, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 500 ? 2 : 1, reducedMotion: 'no-preference', colorScheme: theme });
  await ctx.addInitScript(t => { window.__forceGL = true; try { localStorage.setItem('theme', t); } catch (e) { } }, theme);
  const page = await ctx.newPage(); const errors = [], failed = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', e => errors.push(String(e))); page.on('requestfailed', r => failed.push(r.url()));
  await page.goto(base + pageName, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.SITE && window.SITE.ready); await sleep(1200);
  return { ctx, page, errors, failed };
}
async function scrollTo(page, sel, frac = .5) { await page.evaluate(([s, fr]) => { const el = document.querySelector(s); const r = el.getBoundingClientRect(); const y = r.top + scrollY - (innerHeight - r.height) * fr; if (window.SITE && window.SITE.lenis) window.SITE.lenis.scrollTo(y, { immediate: true, force: true }); window.scrollTo(0, y); if (window.ScrollTrigger) { ScrollTrigger.update(); } }, [sel, frac]); await page.evaluate(() => { if (window.ScrollTrigger) { ScrollTrigger.update(); ScrollTrigger.refresh(); } if (window.__viz) window.__viz.force(1); document.querySelectorAll('.reveal').forEach(e => e.classList.add('in')); }); }
const qaJson = path.join(DOCS, 'qa', 'qa.json'); const report = fs.existsSync(qaJson) ? JSON.parse(fs.readFileSync(qaJson, 'utf8')) : { pages: {} }; report.pages = report.pages || {};
for (const pageName of PAGES) {
  const stem = pageName.replace(/\.html$/, '').replace(/[\/]/g, '_'); const pr = report.pages[pageName] = report.pages[pageName] || {};
  for (const theme of ['dark', 'light']) {
    if (SNAP) {
      const { ctx, page, errors } = await open(pageName, theme, { width: 1280, height: 860 });
      const names = await page.$$eval('[data-viz]', els => els.map(e => e.dataset.viz));
      for (const name of names) {
        const sel = `[data-viz="${name}"]`; await scrollTo(page, sel, .5); await page.evaluate(() => window.__viz && window.__viz.force(1)); await sleep(900);
        const el = await page.$(sel); const out = path.join(DOCS, 'assets', `viz_${name}_${theme}.png`); await el.screenshot({ path: out, timeout: 180000 }); console.log('snap', out);
      }
      if (errors.length) console.log('console errors during snap', theme, errors); await ctx.close();
    }
    if (QA) {
      const qd = path.join(DOCS, 'qa', theme); fs.mkdirSync(qd, { recursive: true });
      const { ctx, page, errors, failed } = await open(pageName, theme, { width: 1440, height: 900 });
      await page.screenshot({ path: path.join(qd, `${stem}-hero.png`), timeout: 180000 });
      const names = (await page.$$eval('[data-viz]', els => els.map(e => e.dataset.viz))).slice(0, 2); let i = 1;
      for (const name of names) { await scrollTo(page, `[data-viz="${name}"]`, .5); await sleep(2600); await page.screenshot({ path: path.join(qd, `${stem}-scene${i++}-${name}.png`), timeout: 180000 }); }
      const imgs = await page.$$eval('img', els => els.filter(i => i.src && !i.src.startsWith('data:')).map(i => ({ ok: i.complete && i.naturalWidth > 0, src: i.src.split('/').pop() })));
      const bytes = await page.evaluate(() => performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0) + (performance.getEntriesByType('navigation')[0]?.transferSize || 0));
      pr[theme] = { errors, failed, imagesLoaded: `${imgs.filter(i => i.ok).length}/${imgs.length}`, transferBytes: bytes, scenes: names };
      await ctx.close();
      const m = await open(pageName, theme, { width: 375, height: 812 }); await m.page.screenshot({ path: path.join(qd, `${stem}-mobile-375-hero.png`), timeout: 180000 }); pr[theme].mobileErrors = m.errors; await m.ctx.close();
      console.log('qa', theme, JSON.stringify(pr[theme]));
    }
  }
  if (HERO_PNG) {
    // static hero fallback: the hero canvas alone, dark theme, at the first keyframe
    const { ctx, page } = await open(pageName, 'dark', { width: 1600, height: 900 }); await sleep(2500); const el = await page.$('#heroCanvas'); await el.screenshot({ path: path.join(DOCS, 'assets', 'hero.png'), timeout: 180000 }); console.log('hero.png'); await ctx.close();
  }
  if (HERO_JSON && pageName === PAGES[0]) {
    // projected particle positions of the hero's six shapes, for the README hero SVG (docs/build_assets.py)
    const { ctx, page } = await open(pageName, 'dark', { width: 1280, height: 800 }); await page.waitForFunction(() => window.__hero); const data = await page.evaluate(() => window.__hero.PROJECTS.map((p, i) => ({ key: p.key, name: p.name, points: window.__hero.project(i, 300) })));
    fs.writeFileSync(HERO_JSON, JSON.stringify(data)); console.log('hero json', HERO_JSON, data.map(d => d.points.length)); await ctx.close();
  }
  if (LH) {
    const out = path.join(DOCS, 'qa', stem === 'index' ? 'lighthouse.report' : `lighthouse.${stem}.report`);
    const cmd = `lighthouse ${base}${pageName} --preset=desktop --quiet --chrome-flags="--headless=new --no-sandbox --use-gl=angle --use-angle=swiftshader" --output=html --output=json --output-path=${out} --only-categories=performance,accessibility,best-practices,seo --max-wait-for-load=30000`;
    // spawned asynchronously so this process keeps serving the page to Lighthouse's Chrome (a blocking exec would starve the in-process server)
    await new Promise((res, rej) => { const c = spawn(cmd, { shell: true, stdio: 'inherit', env: { ...process.env, CHROME_PATH: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' } }); const t = setTimeout(() => { c.kill(); rej(new Error('lighthouse timed out')); }, 420000); c.on('exit', code => { clearTimeout(t); code ? rej(new Error('lighthouse exit ' + code)) : res(); }); });
    const j = JSON.parse(fs.readFileSync(out + '.report.json', 'utf8')); const c = j.categories, a = j.audits;
    pr.lighthouse = { performance: Math.round(c.performance.score * 100), accessibility: Math.round(c.accessibility.score * 100), bestPractices: Math.round(c['best-practices'].score * 100), seo: Math.round(c.seo.score * 100), fcp: a['first-contentful-paint'].displayValue, lcp: a['largest-contentful-paint'].displayValue, tbt: a['total-blocking-time'].displayValue, cls: a['cumulative-layout-shift'].displayValue, si: a['speed-index'].displayValue, bytes: a['total-byte-weight'].displayValue };
    console.log('lighthouse', JSON.stringify(pr.lighthouse));
  }
}
fs.mkdirSync(path.join(DOCS, 'qa'), { recursive: true }); fs.writeFileSync(path.join(DOCS, 'qa', 'qa.json'), JSON.stringify(report, null, 1));
await browser.close(); server.close();
