/**
 * check-behavior.mjs — 页面行为回归测试（真浏览器里跑构建产物）
 *
 * 为什么光有 check-build.mjs 不够：check-build 只看文本，能挡住「数据里混进数字」
 * 「锚点被改名」这一类；但下面这些只有把页面跑起来才知道坏没坏：
 *   · 归档列表服务端渲的那一份，JS 接管后有没有被重写坏（结构两边不一致时，
 *     点一下筛选就换排版，肉眼在构建日志里完全看不出来）；
 *   · 搜索框/分类云/标签弹幕的点击筛选是否还生效；
 *   · 首屏那块有没有在加载过程中挪动（CLS 回归 —— 这条就是本次改动的验收线）；
 *   · Font Awesome 的图标是不是真的画出字形了（子集化/换 CDN 之后最容易悄悄变空白）；
 *   · 深色/浅色切换、移动端菜单这类交互有没有被改坏。
 *
 * 用法：
 *   node scripts/check-behavior.mjs [产物目录] [--mobile]
 *   默认产物目录 exampleSite/public（或 Pages 部署用的那个目录）
 *
 * 依赖：playwright-core + 本机 Chrome/Chromium。缺任何一样就整体跳过并说明原因，
 *   绝不假装通过（CI 里没浏览器的话请用 check:build 那一份纯文本判据）。
 *   指定内核：CHROME_PATH=C:/path/chrome.exe node scripts/check-behavior.mjs
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const MOBILE = argv.includes('--mobile');
const OUT = argv.find((a) => !a.startsWith('--')) || join(ROOT, 'exampleSite', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.xml': 'application/xml',
  '.ico': 'image/x-icon', '.gif': 'image/gif', '.txt': 'text/plain', '.md': 'text/markdown',
};

let failed = 0;
const ok = (name, pass, detail = '') => {
  if (!pass) failed++;
  console.log(`${pass ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};
/** 数据太少、这条判据在此站上无法成立时用这个：明说「跳过 + 为什么」，绝不记成通过 */
const skip = (name, reason) => console.log(`  – ${name} — 跳过：${reason}`);

if (!existsSync(OUT)) {
  console.error(`找不到构建产物目录：${OUT}\n先跑 npm run build`);
  process.exit(1);
}

/* ---------- 浏览器：装不上就整体跳过，不报错 ---------- */
let chromium = null;
/* 先按包名找（主题仓库自己 npm i -D playwright-core 就行）；
   找不到再看 ZERO_PLAYWRIGHT 指过去的目录 —— 站长/我们是在别的工作区里跑这份脚本，
   ESM 的解析只看脚本所在位置，NODE_PATH 对它无效，所以只能显式给路径。 */
for (const spec of ['playwright-core', process.env.ZERO_PLAYWRIGHT].filter(Boolean)) {
  try {
    const target = /^[./]/.test(spec) || /^[a-zA-Z]:[\\/]/.test(spec)
      ? pathToFileURL(join(spec, 'index.mjs')).href
      : spec;
    const mod = await import(target);
    chromium = mod.chromium;
    if (chromium) break;
  } catch { /* 换下一个 */ }
}
if (!chromium) {
  console.log('· 跳过行为回归：没有 playwright-core（npm i -D playwright-core，或用 ZERO_PLAYWRIGHT 指到装它的那个 node_modules/playwright-core）');
  process.exit(0);
}
const CHROME = process.env.CHROME_PATH ||
  'C:/Users/mzwon/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
if (!existsSync(CHROME)) {
  console.log(`· 跳过行为回归：找不到浏览器 ${CHROME}（设 CHROME_PATH 指定）`);
  process.exit(0);
}

/* ---------- 静态服务器：只监听 127.0.0.1，no-store 保证每次都是干净首屏 ---------- */
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const safe = pathname.split('/').filter((s) => s && s !== '..').join('/');
  let file = join(OUT, safe);
  try { if (statSync(file).isDirectory()) file = join(file, 'index.html'); } catch { file = join(file, 'index.html'); }
  if (!existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const VP = MOBILE ? { width: 390, height: 844 } : { width: 1440, height: 900 };

async function open(url, { throttle = false } = {}) {
  const ctx = await browser.newContext({ viewport: VP, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
  let cdp = null;
  if (throttle) {
    cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 4 * 1024 * 1024 / 8, uploadThroughput: 0 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    // 首屏位移计数：只记没有用户输入的那几次
    await page.addInitScript(() => {
      window.__shifts = [];
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shifts.push({ t: Math.round(e.startTime), v: e.value }); })
        .observe({ type: 'layout-shift', buffered: true });
    });
  }
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  return { ctx, page, errs };
}
const clsOf = (page) => page.evaluate(() => {
  let max = 0, cur = 0, start = -1, last = -1;
  for (const e of window.__shifts) {
    if (start < 0 || e.t - last > 1000 || e.t - start > 5000) { cur = 0; start = e.t; }
    cur += e.v; last = e.t; if (cur > max) max = cur;
  }
  return +max.toFixed(3);
});
/* 控制台噪音的口径：
   · 资源 404 / 网络失败：本地产物里那些指向线上接口的请求必然失败，不算主题缺陷；
   · CORS 被拦：本地这一份是 127.0.0.1 的源，站点的接口只认站点自己的域，
     所以「被 CORS 拦掉」恰恰说明接口没对陌生来源开放 —— 真正接口的跨域策略由
     台架那套 bv-* 套件在同一个域下验，这里不重复判。 */
const NOISE = /Failed to load resource|net::ERR|blocked by CORS policy|Access to fetch at|XMLHttpRequest cannot load/;
const realErrors = (errs) => errs.filter((e) => !NOISE.test(e));
const has = (html, id) => html.includes(`id=${id}`) || html.includes(`id="${id}"`);
const pageHtml = (rel) => {
  const p = join(OUT, rel, 'index.html');
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
};

console.log(`\n== 页面行为回归（${MOBILE ? '移动 390×844' : '桌面 1440×900'}，产物 ${relative(ROOT, OUT) || '.'}）==`);

/* ---------- 1. 归档页：预渲 + 接管 + 筛选 ---------- */
const archiveRel = existsSync(join(OUT, 'archive', 'index.html')) ? 'archive' : '';
if (archiveRel) {
  const html = pageHtml('archive');
  const anchors = ['archiveList', 'archiveSearch', 'archiveData'].filter((id) => !has(html, id));
  ok('归档页三个前端锚点在（列表/搜索框/数据）', anchors.length === 0, anchors.join(' '));

  const { ctx, page, errs } = await open(`${BASE}/archive/`);
  await page.waitForTimeout(2500);
  const init = await page.evaluate(() => ({
    months: document.querySelectorAll('#archiveList .archive-month').length,
    items: document.querySelectorAll('#archiveList .archive-item').length,
    chips: document.querySelectorAll('#tlChips .tl-chip').length,
    cloud: document.querySelectorAll('#categoryCloud .cloud-item').length,
    lanes: document.querySelectorAll('#tagDanmaku .danmaku-lane').length,
    cloudFirst: (document.querySelector('#categoryCloud .cloud-item')?.textContent || '').trim(),
  }));
  /* 先量一下这个站有多少内容 —— 下面每条判据都按它来决定「断言 / 跳过」，
     否则新站（或把示例文章删空、还没打分类的站）会被自己的闸门挡下：
     「分类云 ≥2 枚」「点分类后条目变少」这类要求，隐含的前提是内容够多。 */
  const scale = await page.evaluate(() => {
    try {
      const d = JSON.parse(document.getElementById('archiveData').textContent);
      const cats = {};
      const tags = {};
      for (const x of d) {
        if (x.category) cats[x.category] = (cats[x.category] || 0) + 1;
        for (const t of x.tags || []) tags[t] = (tags[t] || 0) + 1;
      }
      return { posts: d.length, cats, tags };
    } catch { return { posts: 0, cats: {}, tags: {}, bad: true }; }
  });
  const catNames = Object.keys(scale.cats || {});
  console.log(`  · 内容规模：文章 ${scale.posts} 篇 / 分类 ${catNames.length} 个${catNames.length ? `（${catNames.map((k) => `${k}:${scale.cats[k]}`).join(' ')}）` : ''} / 标签 ${Object.keys(scale.tags || {}).length} 个`);

  if (scale.bad) ok('归档注入了可解析的文章数据', false, 'archiveData 读不出来或不是 JSON');
  else if (!scale.posts) skip('预渲列表非空 / 月份条 / 分类云条目', '这个站一篇可列的文章都没有（新站或示例已删空）');
  else {
    ok('首屏就渲出月份节与条目（预渲生效，不是等 JS 填）', init.months > 0 && init.items > 0, JSON.stringify(init));
    ok('刻度尺月份条在（移动端点月份能跳）', init.chips > 0, `chips=${init.chips}`);
    ok('分类云渲出「全部 + 各分类」（条目数按真分类数判）',
      init.cloudFirst.startsWith('全部') && init.cloud === catNames.length + 1, `cloud=${init.cloud} 分类=${catNames.length}（期望 ${catNames.length + 1}）`);
    if (Object.keys(scale.tags || {}).length) ok('标签弹幕有轨道', init.lanes > 0, `lanes=${init.lanes}`);
    else skip('标签弹幕有轨道', '文章都没打标签');
  }

  /* 先把「服务端渲的那一版」结构记下来 —— 必须在任何筛选动作之前，
     否则记到的是被筛过的列表，跟后面 JS 全量重渲那一版永远对不上（第一版就栽在这）。 */
  const structure = await page.evaluate(() => {
    const norm = (el) => !el ? 'NO-LIST' : el.querySelectorAll(':scope > .archive-month').length +
      ':' + [...el.querySelectorAll('.archive-month-head')].map((h) => (h.querySelector('.ym')?.textContent || '').replace(/\s+/g, ' ').trim() +
        '/' + (h.querySelector('.cnt')?.textContent || '').trim()).join(',');
    return norm(document.getElementById('archiveList'));
  });

  /* 搜索用的词不能写死（「1984」这类是站长站上才有的标题，演示站里没有 → 假红）。
     从注入数据里取第一篇标题的前两个字，任何站点都保证搜得到。 */
  const kw = await page.evaluate(() => {
    try {
      const d = JSON.parse(document.getElementById('archiveData').textContent);
      const hit = d.find((x) => typeof x.title === 'string' && x.title.length >= 2);
      return hit ? hit.title.slice(0, 2) : '';
    } catch { return ''; }
  });
  if (kw) {
    await page.locator('#archiveSearch').fill(kw);
    await page.waitForTimeout(600);
    const searched = await page.evaluate((k) => {
      const items = [...document.querySelectorAll('#archiveList .archive-item .title')];
      return { n: items.length, allMatch: items.every((e) => e.textContent.includes(k)) };
    }, kw);
    ok(`搜「${kw}」只留下含这个词的条目（搜索仍然可用）`, searched.n > 0 && searched.n <= init.items && searched.allMatch,
      `${init.items} → ${searched.n}，全部命中=${searched.allMatch}`);
    await page.locator('#archiveSearch').fill('绝对搜不到的一篇zzz');
    await page.waitForTimeout(600);
    const noneText = await page.evaluate(() => (document.getElementById('archiveList')?.textContent || '').trim());
    ok('搜不到时给「没有匹配的文章」', noneText.includes('没有匹配'), noneText.slice(0, 30));
    await page.locator('#archiveSearch').fill('');
    await page.waitForTimeout(600);
  } else if (scale.bad) {
    ok('归档注入数据里有可搜的标题', false, 'archiveData 解析失败');
  } else {
    skip('搜索框能筛出结果', '这站一篇可列的文章都没有，取不到搜索词');
  }

  // 点分类云筛选（这条同时验证「预渲那份被 JS 接管后事件仍然挂着」）
  const catChip = page.locator('#categoryCloud .cloud-item').nth(1);
  if (await catChip.count()) {
    const value = (await catChip.getAttribute('data-value')) || '';
    await catChip.click();
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => ({
      items: document.querySelectorAll('#archiveList .archive-item').length,
      active: document.querySelectorAll('#categoryCloud .cloud-item.active-filter').length,
      months: document.querySelectorAll('#archiveList .archive-month').length,
    }));
    /* 期望值来自注入数据本身，不靠「一定比全量少」这种假设：
       只有一个分类、或整站文章同属一个分类时，筛完条数本来就不该变 —— 那种站要求变少是假红。 */
    const expect = scale.cats?.[value] ?? 0;
    if (!expect) ok(`点分类「${value}」后列表非空`, after.items > 0, JSON.stringify(after));
    else if (expect < init.items) {
      ok(`点分类「${value}」筛出该分类的 ${expect} 篇（比全量 ${init.items} 少）`, after.items === expect, JSON.stringify({ ...after, expect }));
    } else {
      ok(`点分类「${value}」条目数不变（${expect} 篇 = 全量，这站只有这一个分类）`, after.items === expect, JSON.stringify({ ...after, expect }));
    }
    ok('筛选后仍带 active 高亮（看不出列表被重渲）', after.active >= 1 && after.months >= 1, JSON.stringify(after));
  } else if (catNames.length) {
    ok('分类云有可点的分类', false, `数据里有 ${catNames.length} 个分类，页面上却只有一枚 chip`);
  } else {
    skip('点分类能筛出该分类', '这站的文章都没打分类');
  }

  // 点标签弹幕筛选。标签一直在滚，Playwright 的「等元素静止」会一直超时 ——
  // 这里直接派发 click 事件（走的是同一套 addEventListener 绑的处理函数），
  // 验的是「JS 接管后标签点击还能不能筛」，不是「滚动的标签好不好点」。
  const tagOk = await page.evaluate(() => {
    const el = document.querySelector('#tagDanmaku .cloud-item');
    if (!el) return 'no-tag';
    el.click();
    return el.dataset.value || '';
  });
  await page.waitForTimeout(700);
  {
    const n = await page.evaluate(() => document.querySelectorAll('#archiveList .archive-item').length);
    if (tagOk === 'no-tag') skip('点标签能筛出结果', '弹幕里没有标签（文章未打标签）');
    else {
      const expect = scale.tags?.[tagOk] ?? 0;
      ok(`点标签「${tagOk}」筛出结果`, expect ? n === expect : n > 0 && n <= init.items, `标签=${tagOk} items=${n} 数据里=${expect}`);
    }
  }

  const reRendered = await page.evaluate(async () => {
    // 触发一次「带条件重渲」再清空条件，等价于让 JS 自己渲一遍全量
    const input = document.getElementById('archiveSearch');
    input.value = ' ';
    input.dispatchEvent(new Event('input'));
    input.value = '';
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 500));
    const el = document.getElementById('archiveList');
    if (!el) return 'NO-LIST';
    return el.querySelectorAll(':scope > .archive-month').length +
      ':' + [...el.querySelectorAll('.archive-month-head')].map((h) => (h.querySelector('.ym')?.textContent || '').replace(/\s+/g, ' ').trim() +
        '/' + (h.querySelector('.cnt')?.textContent || '').trim()).join(',');
  });
  ok('预渲结构与 JS 渲出的完全一致（月份标题/条数文案）', structure === reRendered,
    structure.slice(0, 70) + ' ⇄ ' + reRendered.slice(0, 70));

  ok('归档页操作全程无 JS 报错', realErrors(errs).length === 0, realErrors(errs).slice(0, 2).join(' | '));
  await ctx.close();

  // CLS 回归线：限速首屏不许超过 0.1（本次改动的验收目标）
  const { ctx: c2, page: p2 } = await open(`${BASE}/archive/`, { throttle: true });
  await p2.waitForTimeout(8000);
  const cls = await clsOf(p2);
  ok('归档页限速首屏 CLS < 0.1（GOOD 档）', cls < 0.1, `CLS=${cls}`);
  await c2.close();
} else {
  console.log('  · 产物里没有 /archive/，跳过归档行为测试');
}

/* ---------- 2. 站内搜索页 ---------- */
const searchRel = existsSync(join(OUT, 'search', 'index.html'));
if (searchRel) {
  /* 查询词同样从产物里取：索引第一页标题的前两个字（写死的词只有某一站点才有） */
  let idxWord = '';
  try {
    const pages = JSON.parse(readFileSync(join(OUT, 'search', 'index.json'), 'utf8')).pages || [];
    const hit = pages.find((p) => typeof p.t === 'string' && p.t.length >= 2);
    idxWord = hit ? hit.t.slice(0, 2) : '';
  } catch { idxWord = ''; }
  const { ctx, page, errs } = await open(`${BASE}/search/?q=${encodeURIComponent(idxWord || '的')}`);
  await page.waitForTimeout(2000);
  const q = idxWord || '的';
  const r = await page.evaluate(() => ({
    value: document.getElementById('searchInput')?.value || '',
    results: document.querySelectorAll('#searchResults .search-result').length,
    status: (document.getElementById('searchStatus')?.textContent || '').trim(),
  }));
  ok(`带 ?q=${q} 打开就自动搜出结果`, r.value === q && r.results > 0, JSON.stringify(r));
  await page.locator('#searchInput').fill('绝不存在的词zzz');
  await page.waitForTimeout(900);
  /* 「没有找到…」这句话在 #searchStatus 里（aria-live 的那块），结果区本身是空的 ——
     判据要跟着实现走，别指望提示写在结果容器里。 */
  const r2 = await page.evaluate(() => ({
    results: document.querySelectorAll('#searchResults .search-result').length,
    status: (document.getElementById('searchStatus')?.textContent || '').trim(),
    url: location.search,
  }));
  ok('搜不到时清空结果并给提示', r2.results === 0 && r2.status.includes('没有'), JSON.stringify(r2).slice(0, 120));
  ok('地址栏跟着查询词走（能分享/回退）', decodeURIComponent(r2.url).includes('绝不存在的词zzz'), r2.url);
  const e2 = realErrors(errs);
  ok('搜索页无 JS 报错', e2.length === 0, e2.slice(0, 2).join(' | '));
  await ctx.close();
} else {
  console.log('  · 没有 /search/ 这一页（站点没启用站内搜索），跳过');
}

/* ---------- 3. 首页 ---------- */
const homeRel = existsSync(join(OUT, 'home', 'index.html')) ? 'home' : (existsSync(join(OUT, 'index.html')) ? '' : null);
if (homeRel !== null) {
  const { ctx, page, errs } = await open(`${BASE}/home/`);
  await page.waitForTimeout(2500);
  const h = await page.evaluate(() => ({
    // 首页有两套布局：bento 用 .hb-card，传统 grid 用 #gardenGrid 的子元素
    cards: document.querySelectorAll('.hb-card, .post-card, #gardenGrid > *').length,
    nav: document.querySelectorAll('.nav-links a').length,
  }));
  ok('首页渲出卡片与导航（数量非 0）', h.cards > 0 && h.nav > 0, JSON.stringify(h));
  const e = realErrors(errs);
  ok('首页无 JS 报错', e.length === 0, e.slice(0, 2).join(' | '));
  await ctx.close();
}

/* ---------- 4. 图标必须真的画出字形 ---------- */
{
  const { ctx, page } = await open(`${BASE}${archiveRel ? '/archive/' : '/'}`);
  await page.waitForTimeout(1500);
  const icons = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('i[class*="fa-"], span[class*="fa-"]')) {
      const cs = getComputedStyle(el, '::before');
      const c = (cs.content || '').replace(/^["']|["']$/g, '');
      if (!c || c === 'none' || c === 'normal') bad.push(el.className.toString().slice(0, 40));
    }
    return { total: document.querySelectorAll('i[class*="fa-"], span[class*="fa-"]').length, bad: bad.slice(0, 6) };
  });
  ok('每个 fa- 图标都取到了字形（没被裁掉/没断字体）', icons.total === 0 || icons.bad.length === 0,
    `共 ${icons.total} 个，缺字形 ${icons.bad.length}：${icons.bad.join(' | ')}`);
  await ctx.close();
}

/* ---------- 5. 深色/浅色切换 + 记住选择 ---------- */
{
  const { ctx, page } = await open(`${BASE}/`);
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const btn = page.locator('#themeToggle, #theme-toggle, .theme-toggle, [data-theme-toggle]').first();
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    ok('点主题按钮会换主题', after && after !== before, `${before} → ${after}`);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(600);
    const kept = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    ok('刷新后仍是刚选的主题（localStorage 生效）', kept === after, `${after} → ${kept}`);
  } else {
    console.log('  · 这一页没有主题切换按钮，跳过');
  }
  await ctx.close();
}

/* ---------- 6. 移动端菜单 ---------- */
if (MOBILE) {
  /* 落地页 `/` 按设计就没有站点导航（只有一个「进入」按钮），所以要在**有导航的页面**上测；
     以前这里只开 `/`，找不到按钮就整段什么都不打印 —— 等于这条判据在移动端档从未跑过。 */
  const candidates = ['/', '/archive/', '/home/'].filter((p) => {
    const rel = p.replace(/^\//, '').replace(/\/$/, '');
    return !rel || existsSync(join(OUT, rel, 'index.html'));
  });
  let tried = null;
  for (const path of candidates) {
    const { ctx, page } = await open(`${BASE}${path}`);
    const toggle = page.locator('#nav-toggle, .nav-toggle').first();
    if (!(await toggle.count())) { await ctx.close(); continue; }
    const closed = await page.evaluate(() => document.querySelector('.nav-links')?.className || '');
    await toggle.click();
    await page.waitForTimeout(500);
    const opened = await page.evaluate(() => ({
      cls: document.querySelector('.nav-links')?.className || '',
      visible: !!document.querySelector('.nav-links')?.offsetParent,
    }));
    ok(`移动端汉堡按钮能展开菜单（在 ${path} 上测）`, opened.cls !== closed && opened.visible, `${closed} → ${JSON.stringify(opened)}`);
    /* 展开后菜单盖住了汉堡键（Playwright 会因中心点命不中而超时），真实用户点的是面板上那颗关闭钮 */
    const closer = page.locator('.nav-close').first();
    if (await closer.count()) await closer.click();
    else await toggle.click({ force: true });
    await page.waitForTimeout(500);
    const again = await page.evaluate(() => document.querySelector('.nav-links')?.className || '');
    ok('展开后能收回（点面板上的关闭钮）', again === closed, `${opened.cls} → ${again}`);
    tried = path;
    await ctx.close();
    break;
  }
  if (!tried) skip('移动端汉堡按钮能展开菜单', `这几个页面里都没有 .nav-toggle（${candidates.join(' ')}）`);
}

console.log(failed ? `\n✗ ${failed} 项不通过\n` : '\n✓ 全部通过\n');
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
