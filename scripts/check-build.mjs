/**
 * check-build.mjs — 构建产物体检（CI 与本地都跑：npm run build && npm run check:build）
 *
 * 为什么要有这个：主题里有几类错误只会体现在**产物**里，模板不报错、页面却坏了：
 *   · 归档/首页的搜索数据里混进非字符串（tags 写成不带引号的 1984）
 *     —— 前端 `tag.toLowerCase()` 抛 TypeError，整块搜索当场失效，而构建完全成功
 *     （站长站上的归档搜索就是这么坏了很久才发现的）；
 *   · 样式回退成外链 <link> —— 首屏多 3~5 次阻塞往返，Lighthouse 的 render-blocking 又变红；
 *   · 前端渲染所依赖的锚点（#archiveList / #archiveSearch / #archiveData）被改名 —— JS 静默什么都不做；
 *   · 内联样式里出现相对 url() —— 内联后基准路径变成页面地址，图片/字体 404。
 * 这些都能用纯文本断言在 CI 里挡住，不需要浏览器。
 *
 * 只读检查，不写任何文件；输出目录取参数或 exampleSite/public。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const OUT = process.argv[2] || join(ROOT, 'exampleSite/public');

let failed = 0;
const ok = (name, pass, detail = '') => {
  if (!pass) failed++;
  console.log(`${pass ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

if (!existsSync(OUT)) {
  console.error(`找不到构建产物目录：${OUT}\n先跑 npm run build`);
  process.exit(1);
}

const htmls = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) htmls.push(p);
  }
};
walk(OUT);

const read = (p) => readFileSync(p, 'utf8');
const find = (name) => htmls.find((p) => relative(OUT, p).replaceAll('\\', '/').startsWith(name));
const jsonIn = (html, id) => {
  const m = html.match(new RegExp(`id=${id}[^>]*>([\\s\\S]*?)<\\/script>`)) || html.match(new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`));
  return m ? m[1].trim() : '';
};

console.log(`\n== 构建产物体检（${htmls.length} 个 HTML）==`);

/* ---------- 1. 搜索数据必须是字符串 ---------- */
for (const [page, id, required] of [['archive/', 'archiveData', true], ['home/', 'gardenData', false]]) {
  const file = find(page);
  if (!file) { console.log(`  · 跳过 ${page}（产物里没有这一页）`); continue; }
  const raw = jsonIn(read(file), id);
  if (!raw) {
    // 首页是 bento 布局时本来就没有 gardenData（卡片由 home-bento 直接服务端渲染），不是缺陷
    if (required) ok(`${page} 的 ${id} 存在`, false, '没找到这段 JSON');
    else console.log(`  · 跳过 ${page} 的 ${id}（当前是 bento 首页，没有 grid 数据）`);
    continue;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    ok(`${page} 的 ${id} 可解析`, false, String(e.message).slice(0, 60));
    continue;
  }
  const list = Array.isArray(data) ? data : data.pages || [];
  const bad = [];
  for (const item of list) {
    for (const key of ['title', 'category', 'desc', 'date', 'permalink']) {
      if (item[key] !== undefined && item[key] !== null && typeof item[key] !== 'string') bad.push(`${key}=${JSON.stringify(item[key])}`);
    }
    for (const key of ['tags', 'tagsZh', 'tagsEn']) {
      const v = item[key];
      if (Array.isArray(v) && v.some((t) => typeof t !== 'string')) bad.push(`${key}=${JSON.stringify(v)}`);
    }
  }
  ok(`${page} 的搜索数据全是字符串（数字会让前端搜索抛错）`, bad.length === 0, bad.slice(0, 3).join(' '));

  /* 没有 date 的文章：Hugo 不报错，但 .Date 是零值 —— 归档页会多出一个「0001 · 01」月份节，
     而且因为「最新」排序按日期倒序，它排在最前面，访客看到的是站里最老的一条顶在最上。
     这条只提示不拦（缺日期多半是有意为之的占位稿，构建也没坏），但要点名到 permalink，
     不然人只会在归档里看到一个怪月份、不知道是哪篇文章。 */
  if (page === 'archive/') {
    const noDate = list.filter((x) => !String(x.date ?? '').slice(0, 4).match(/\d{4}/) || String(x.date).startsWith('0001'));
    if (noDate.length) {
      console.log(`  ⚠ ${noDate.length} 篇文章没有可解析的 date，归档里会进「0001 · 01」并排在最前：`);
      for (const x of noDate.slice(0, 10)) console.log(`      ${x.permalink || '(无链接)'} —— ${x.title || '(无标题)'}`);
      console.log('      （不是构建错误；要修就在正文里补 date: 2026-10-28，或在归档里把这篇排除）');
    }
  }
}

/* ---------- 2. 样式必须内联、不得回退成阻塞外链 ---------- */
const blocking = [];
const noInline = [];
for (const p of htmls) {
  const html = read(p);
  const rel = relative(OUT, p).replaceAll('\\', '/');
  // 第三方样式（FA/waline/artalk）与 extra_css 不在管辖范围；只管本站 /css/ 与 /images/ 产物
  const localLinks = [...html.matchAll(/<link[^>]+href="(\/css\/[^"]+\.css)"/g)].map((m) => m[1]);
  if (localLinks.length) blocking.push(`${rel}: ${localLinks.join(' ')}`);
  if (/<link[^>]+href="\/css\//.test(html) && rel === 'subscribe/index.html') continue; // 订阅正文样式允许外链
  if (!/data-zero-css=/.test(html) && !/<style>/.test(html) && !/404/.test(rel)) noInline.push(rel);
}
ok('没有阻塞首屏的本站样式外链（样式应内联进 head）', blocking.filter((x) => !x.startsWith('subscribe/')).length === 0, blocking.slice(0, 3).join(' | '));
ok('每个页面都带内联样式（data-zero-css 或页面自带 <style>）', noInline.length === 0, noInline.slice(0, 3).join(' | '));

/* ---------- 3. 前端依赖的锚点不能被改名 ---------- */
const hasId = (html, id) => html.includes(`id=${id}`) || html.includes(`id="${id}"`);
const archiveHtml = find('archive/');
if (archiveHtml) {
  const html = read(archiveHtml);
  const miss = ['archiveList', 'archiveSearch', 'archiveData', 'tlSvg'].filter((id) => !hasId(html, id));
  ok('归档页的前端锚点齐全（列表/搜索框/数据/时间轴）', miss.length === 0, miss.join(' '));
}
const homeHtml = find('home/');
if (homeHtml && hasId(read(homeHtml), 'gardenData')) {
  const miss = ['gardenGrid'].filter((id) => !hasId(read(homeHtml), id));
  ok('首页 grid 的渲染容器在（有 gardenData 就必须有 gardenGrid）', miss.length === 0, miss.join(' '));
}

/* ---------- 4. 内联样式里不许有相对 url() ---------- */
const relUrl = [];
for (const p of htmls) {
  const html = read(p);
  for (const m of html.matchAll(/<style[^>]*data-zero-css[^>]*>([\s\S]*?)<\/style>/g)) {
    for (const u of m[1].matchAll(/url\(\s*['"]?([^'")]+)/g)) {
      const v = u[1];
      if (!/^(\/|data:|https?:|#)/.test(v)) relUrl.push(`${relative(OUT, p)}: url(${v})`);
    }
  }
}
ok('内联样式没有相对 url()（基准路径会变成页面地址）', relUrl.length === 0, relUrl.slice(0, 3).join(' | '));

/* ---------- 5. 站内搜索页（建了就查） ---------- */
const searchHtml = find('search/');
if (searchHtml) {
  const html = read(searchHtml);
  const idx = join(OUT, 'search', 'index.json');
  ok('/search/ 的索引 index.json 已生成', existsSync(idx));
  ok('/search/ 页带 noindex（搜索结果页不该被收录）', /name=robots content="noindex|name="robots" content="noindex/.test(html));
  ok('/search/ 页有输入框与结果区', html.includes('id=searchInput') && html.includes('id=searchResults'));
  if (existsSync(idx)) {
    const pages = JSON.parse(read(idx)).pages || [];
    const bad = pages.filter((p) => (p.g || []).some((t) => typeof t !== 'string'));
    ok('索引里的标签都是字符串', bad.length === 0, `${bad.length} 条异常`);
  }
}

/* ---------- 6. 归档列表的服务端预渲必须和注入数据一一对应 ---------- */
/* 预渲那份列表是 JS 首次渲染的「跳过重写」依据（archive.js 的 keepServerHtml）：
   两边月份/条数对不上时，刻度尺点某个月却滚不过去（JS 用数据里的月份建刻度尺，
   页面里却没有那个 #m-YYYY-MM 锚点）。这是改预渲之后新引入的耦合，必须机器盯着。 */
if (archiveHtml) {
  const html = read(archiveHtml);
  const raw = jsonIn(html, 'archiveData');
  const months = [...html.matchAll(/<section[^>]+id=["']?(m-[0-9]{4}-[0-9]{2})(?=["'\s>])/g)].map((m) => m[1]);
  const items = (html.match(/class=["']?archive-item/g) || []).length;
  let data = null;
  try { data = JSON.parse(raw); } catch { data = null; }
  if (!Array.isArray(data)) {
    ok('归档注入数据可解析（预渲对齐的前提）', false);
  } else if (!months.length) {
    ok('归档列表已服务端渲出月份节（有文章就必须有 <section class=archive-month>）', data.length === 0,
      `数据里 ${data.length} 篇，页面里 0 节`);
  } else {
    const want = [...new Set(data.map((d) => String(d.date).slice(0, 7)))].map((k) => `m-${k}`);
    const missing = want.filter((k) => !months.includes(k));
    const extra = months.filter((k) => !want.includes(k));
    ok('预渲的月份节与注入数据一一对应（刻度尺跳转靠这个）', !missing.length && !extra.length,
      `缺 ${missing.slice(0, 3).join(' ')} 多 ${extra.slice(0, 3).join(' ')}`);
    ok('预渲条目数与文章数一致', items === data.length, `页面 ${items} 条 / 数据 ${data.length} 篇`);
  }
}

console.log(failed ? `\n✗ ${failed} 项不通过\n` : '\n✓ 全部通过\n');
process.exit(failed ? 1 : 0);
