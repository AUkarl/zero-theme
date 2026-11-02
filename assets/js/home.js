// ============================================================
// home.js - 首页（Home）文章卡片列表功能
// 包含：卡片分列网格渲染、分页、分类筛选、搜索、最新/最早/最热排序
// 卡片本身等高（行数由配置固定），所以分列后各列自然形成对齐的行，
// 偶数列再由 CSS 下移 --stagger-offset 形成错落。
// 适用于 Hugo 主题，数据由模板直接渲染，无需动态加载
// ============================================================

// 分页配置（从 Hugo 模板注入的 window.homeConfig 读取）
const homeCfg = window.homeConfig || {};
const ITEMS_PER_PAGE = homeCfg.paginate || 20;
const SHOW_IMAGES = homeCfg.showImages !== false;
const SHOW_SUMMARY = homeCfg.showSummary !== false;
// 「最热」的分数来自 data/poststats.json（后台定时任务导出、构建期写进每条数据）。
// 没有这份数据时排序无从算起，按钮直接隐藏，点了也不会显示一个假顺序。
const HAS_STATS = !!homeCfg.buildStats;
let currentPage = 1;
let filteredArticles = [];
let gardenSort = 'latest';
/** 服务端骨架（partials/home-card.html / home-pager.html）只服务「第 1 页 + 最新 + 没筛选」这一屏。
 *  认领过一次之后就走正常重建：切排序、翻页都是用户主动动作，那时重写 innerHTML 没有位移代价。 */
let skeletonTaken = false;
let pagerTaken = false;

// ==================== 卡片分列 ====================
// CSS 的 column-count 是「先竖着填满第一列，再填第二列」，
// 卡片顺序看起来会和时间顺序对不上。
// 这里改成：按数据顺序把卡片轮流分配到各列
// （第 1 张进第 1 列、第 2 张进第 2 列……第 n+1 张回到第 1 列继续往下），
// 阅读顺序即「从左到右、从上到下」；卡片等高，各列自然对齐成行，
// 偶数列再由 CSS 整体下移形成错落感。
const Columns = {
  // 列数取 CSS 变量 --home-columns（响应式断点写在 home.css 里）
  getColumnCount(grid) {
    const raw = getComputedStyle(grid).getPropertyValue('--home-columns');
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 4;
  },
  // 分列；首次调用会缓存卡片节点，之后 resize 重排也能保持顺序、不丢节点
  layout(grid) {
    if (!grid) return;
    if (!grid.__gardenCards) {
      grid.__gardenCards = Array.from(grid.children).filter(el => !el.classList.contains('garden-col'));
    }
    const cards = grid.__gardenCards;
    if (cards.length === 0) return;

    // 列数就取配置的列数，**不要**再被卡片数夹小：最后那一页只剩 2 条时，
    // 以前只建 2 个 .garden-col，而列是 flex:1 1 0 等分的 → 两张卡片各占半屏宽（实测列宽 578、卡高 622），
    // 与第一页的 279/398 完全不同。空列照样建、照样占位，卡片尺寸就跟第一页一致了。
    const count = Math.max(1, Columns.getColumnCount(grid));
    const cols = [];
    grid.textContent = '';                 // 清空旧列，卡片节点仍被 cards 引用着
    for (let i = 0; i < count; i++) {
      const col = document.createElement('div');
      col.className = 'garden-col';
      grid.appendChild(col);
      cols.push(col);
    }
    cards.forEach((card, i) => cols[i % count].appendChild(card));
    grid.classList.add('is-columns');
    grid.classList.remove('is-skeleton');   // 服务端那套 grid 布局到这里就交还给分列布局
    grid.__gardenCols = count;
  },
   // 内容重新渲染后调用：先丢弃旧缓存再分列
  refresh(grid) {
    if (!grid) return;
    grid.__gardenCards = null;
    Columns.layout(grid);
  },
   // 响应式：列数变化时重新分列
  watch() {
    window.addEventListener('resize', function () {
      const grid = document.getElementById('gardenGrid');
      if (!grid || !grid.__gardenCards || grid.__gardenCards.length === 0) return;
      if (Columns.getColumnCount(grid) !== grid.__gardenCols) Columns.layout(grid);
    });
  }
};

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', function() {
  initGarden();
});

// ==================== 构建文章数据 ====================
// 从 Hugo 模板渲染的 DOM 中读取文章数据
function initGarden() {
  const gridEl = document.getElementById('gardenGrid');
  if (!gridEl) return;

  // 从 data 属性读取文章列表（由 Hugo 模板注入）
  const dataEl = document.getElementById('gardenData');
  if (dataEl) {
    try {
      filteredArticles = JSON.parse(dataEl.textContent);
    } catch (e) {
      filteredArticles = [];
    }
    renderGarden();
  } else {
    // 静态列表页（/posts/ 等）：卡片已由 Hugo 渲染好，直接分列
    Columns.layout(gridEl);
  }

  bindEvents();
  Columns.watch();
}

// ==================== 渲染文章卡片 ====================
function renderGarden() {
  const gridEl = document.getElementById('gardenGrid');
  const paginationEl = document.getElementById('pagination');
  if (!gridEl) return;
  // 静态列表页（如 /posts/）的卡片由 Hugo 渲染，没有 #gardenData，
  // 这里直接跳过，避免重渲染把已有卡片清空
  if (!document.getElementById('gardenData')) return;

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageItems = filteredArticles.slice(start, end);

  if (pageItems.length === 0) {
    gridEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);">暂无文章</div>';
    if (paginationEl) paginationEl.innerHTML = '';
    return;
  }

  /**
   * 首屏这一屏服务端已经渲好了（layouts/partials/home-card.html）。
   * 判据是「这一次要渲的正是那一批」：第 1 页、最新排序、没被筛选过，
   * 且 DOM 里的卡片数与 href 顺序逐个对得上 —— 对不上就照常重建，宁可多写一次 innerHTML，
   * 也不能让屏幕上留着和当前排序不符的旧卡片。
   * 认领时只把现成节点分列，不重写 innerHTML：那一下重写才是 CLS 的来源。
   */
  function adoptServerCards(gridEl, start, pageItems) {
    if (skeletonTaken) return false;
    if (start !== 0 || currentPage !== 1 || gardenSort !== 'latest') return false;
    const flat = Array.prototype.slice.call(gridEl.children).filter(el => el.classList.contains('garden-card'));
    if (flat.length !== pageItems.length) return false;
    for (let i = 0; i < flat.length; i++) {
      if (flat[i].getAttribute('href') !== (pageItems[i].permalink || '#')) return false;
    }
    skeletonTaken = true;
    Columns.refresh(gridEl);
    return true;
  }

  /** 单张卡片的 HTML。改这里必须同时改 partials/home-card.html —— 两边不一致第 1 页和第 2 页就长得不一样
   *  （台架有一条把这批节点逐个元素比对的用例守着这件事）。 */
  function cardHtml(article) {
    const title = article.title || '';
    const desc = article.desc || '';
    const tags = article.tags || [];
    let imgHtml = '';
    let imgBg = '';
    if (SHOW_IMAGES) {
      const im = article.img || {};
      if (im.src) {
        // 构建时处理过的封面：先显示 LQIP 占位，进入视口前 200px 再加载高清（motion.js）
        if (im.lqip) imgBg = ` style="background-image:url(${im.lqip});background-size:cover;background-position:center"`;
        // 键名跟着 partials/img-src.html 走（width/height）：写 im.w 时这一条永远不成立，
        // 首页卡片图于是全部不带宽高 —— 图一到达就顶一下版面。
        const dims = (im.width && im.height) ? ` width="${im.width}" height="${im.height}"` : '';
        imgHtml = `<img data-src="${im.src}" data-srcset="${im.srcset || ''}" sizes="${im.sizes || '100vw'}"${dims} alt="${title}" decoding="async" />`;
      } else {
        imgHtml = article.image
          ? `<img src="${article.image}" alt="${title}" loading="lazy" />`
          : `<div class="card-img-placeholder"></div>`;
      }
    }
    const descHtml = SHOW_SUMMARY ? `<p class="card-desc">${desc}</p>` : '';
    // 卡片标题用 h2：home.css 的标题规则是 `.garden-card h2`（R43 那批按 h1→h2 不跳级统一过标签），
    // 这里以前写 h3 —— 规则命中不到 JS 拼出来的卡片，标题字号、两行截断与固定高度一起丢，卡片也就不等高了。
    return `
      <a class="garden-card" href="${article.permalink || '#'}">
        ${SHOW_IMAGES ? `<div class="card-img"${imgBg}>${imgHtml}</div>` : ''}
        <div class="card-body">
          <h2 class="card-title">${title}</h2>
          ${descHtml}
          <div class="card-meta">
            <span class="card-date">${article.date}</span>
            <span class="card-tags">${tags.map(t => '#' + t).join(' ')}</span>
          </div>
        </div>
      </a>
    `;
  }

  if (!adoptServerCards(gridEl, start, pageItems)) {
    let html = '';
    pageItems.forEach(article => { html += cardHtml(article); });
    gridEl.innerHTML = html;
    // 重新按顺序分列（保证「从左到右、从上到下」）
    Columns.refresh(gridEl);
  }
  // 封面进入视口前 200px 再加载高清图（服务端骨架里的图同样是 data-src，必须走这一遍才会加载）
  if (window.Motion) window.Motion.lazyImages(gridEl);

  // 渲染分页：「第 [输入框] 页 / 共 N 页」。输入框里改数字（回车或点走）就跳那一页。
  // 以前这里是一排页码按钮（1 2 3 …）：看不出自己在第几页，页数一多还占满一行。
  const totalPages = Math.ceil(filteredArticles.length / ITEMS_PER_PAGE);
  if (paginationEl && totalPages >= 1) {
    const L = homeCfg.labels || {};
    const prev = L.prev || '上一页';
    const next = L.next || '下一页';
    const wordPage = L.page || '第';
    const wordUnit = L.pageSuffix || '页';
    const wordTotal = L.pageTotal || '共';
    const ariaJump = L.jump || '输入页码跳转';
    /* 这一条也是服务端渲的（home-pager.html）。对得上就直接用现成的节点，
       对不上（翻页后、或第 1 页那一屏已被上面的卡片认领逻辑换过）才重写。 */
    const serverInput = paginationEl.querySelector('.page-input');
    const useServerPager = !pagerTaken && serverInput
      && Number(serverInput.max) === totalPages
      && Number(serverInput.value) === currentPage
      && start === 0 && gardenSort === 'latest';
    if (useServerPager) {
      pagerTaken = true;
    } else {
      paginationEl.innerHTML =
        `<button class="page-btn prev-btn" ${currentPage <= 1 ? 'disabled' : ''} data-page="${currentPage - 1}">‹ ${prev}</button>` +
        `<span class="page-jump">` +
          `<span class="page-jump-word">${wordPage}</span>` +
          `<input class="page-input" type="number" min="1" max="${totalPages}" step="1" value="${currentPage}" inputmode="numeric" aria-label="${ariaJump}">` +
          `<span class="page-jump-word">${wordUnit} / ${wordTotal} ${totalPages} ${wordUnit}</span>` +
        `</span>` +
        `<button class="page-btn next-btn" ${currentPage >= totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">${next} ›</button>`;
    }
    paginationEl.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        if (this.disabled) return;
        currentPage = parseInt(this.dataset.page);
        renderGarden();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    // 输入框：越界与非数字直接归位到「现在的页」，不留一个和实际不符的数字在框里
    const input = paginationEl.querySelector('.page-input');
    const jump = () => {
      const n = parseInt(input.value, 10);
      const target = Number.isFinite(n) ? Math.min(Math.max(n, 1), totalPages) : currentPage;
      input.value = target;
      if (target === currentPage) return;
      currentPage = target;
      renderGarden();                 // 重绘会把整条分页换掉，所以下面这些监听只活到这次点击为止
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    input.addEventListener('change', jump);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); jump(); } });
  } else if (paginationEl) {
    paginationEl.innerHTML = '';
  }
}

// ==================== 排序：最新 / 最早 / 最热 ====================
function scoreOf(a) {
  return Number(a.score || 0);
}

/** 按当前排序方式重排 filteredArticles（分类/筛选结果之上再排一次） */
function sortArticles() {
  const list = filteredArticles.slice();
  if (gardenSort === 'earliest') {
    list.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  } else if (gardenSort === 'hot' && HAS_STATS) {
    list.sort((a, b) => scoreOf(b) - scoreOf(a) || String(b.date).localeCompare(String(a.date)));
  } else {
    // 模板给的就是日期倒序，这里显式排一次，切回「最新」时顺序才稳定
    list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }
  filteredArticles = list;
}

// ==================== 事件绑定 ====================
function bindEvents() {
  // 排序切换
  const sortBtns = Array.prototype.slice.call(document.querySelectorAll('[data-gsort]'));
  if (sortBtns.length) {
    if (!HAS_STATS) {
      // 没有构建期统计就没有「最热」的数据来源，按钮不摆出来
      sortBtns.forEach((btn) => { if (btn.dataset.gsort === 'hot') btn.hidden = true; });
    }
    sortBtns.forEach((btn) => {
      btn.addEventListener('click', function () {
        sortBtns.forEach((b) => {
          const on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        gardenSort = btn.dataset.gsort;
        currentPage = 1;
        sortArticles();
        renderGarden();
      });
    });
  }

  // 分类筛选
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      filterBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const category = this.dataset.category;
      filterByCategory(category);
    });
  });

  // 搜索
  const searchInput = document.getElementById('gardenSearch');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const query = this.value.trim().toLowerCase();
      filterBySearch(query);
    });
  }
}

// ==================== 分类筛选 ====================
function filterByCategory(category) {
  const dataEl = document.getElementById('gardenData');
  if (!dataEl) return;
  let allArticles;
  try {
    allArticles = JSON.parse(dataEl.textContent);
  } catch (e) {
    return;
  }

  if (category === 'all' || !category) {
    filteredArticles = allArticles;
  } else {
    filteredArticles = allArticles.filter(a => a.category === category);
  }
  currentPage = 1;
  sortArticles();
  renderGarden();
}

// ==================== 搜索筛选 ====================
function filterBySearch(query) {
  const dataEl = document.getElementById('gardenData');
  if (!dataEl) return;
  let allArticles;
  try {
    allArticles = JSON.parse(dataEl.textContent);
  } catch (e) {
    return;
  }

  if (!query) {
    filteredArticles = allArticles;
  } else {
    filteredArticles = allArticles.filter(a =>
      String(a.title || '').toLowerCase().includes(query) ||
      String(a.desc || '').toLowerCase().includes(query) ||
      (a.tags || []).some(t => String(t).toLowerCase().includes(query))
    );
  }
  currentPage = 1;
  sortArticles();
  renderGarden();
}
