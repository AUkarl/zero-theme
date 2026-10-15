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

    const count = Math.max(1, Math.min(Columns.getColumnCount(grid), cards.length));
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

  let html = '';
  pageItems.forEach(article => {
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
        const dims = (im.w && im.h) ? ` width="${im.w}" height="${im.h}"` : '';
        imgHtml = `<img data-src="${im.src}" data-srcset="${im.srcset || ''}" sizes="${im.sizes || '100vw'}"${dims} alt="${title}" decoding="async" />`;
      } else {
        imgHtml = article.image
          ? `<img src="${article.image}" alt="${title}" loading="lazy" />`
          : `<div class="card-img-placeholder"></div>`;
      }
    }
    const descHtml = SHOW_SUMMARY ? `<p class="card-desc">${desc}</p>` : '';
    html += `
      <a class="garden-card" href="${article.permalink || '#'}">
        ${SHOW_IMAGES ? `<div class="card-img"${imgBg}>${imgHtml}</div>` : ''}
        <div class="card-body">
          <h3 class="card-title">${title}</h3>
          ${descHtml}
          <div class="card-meta">
            <span class="card-date">${article.date}</span>
            <span class="card-tags">${tags.map(t => '#' + t).join(' ')}</span>
          </div>
        </div>
      </a>
    `;
  });
  gridEl.innerHTML = html;
  // 重新按顺序分列（保证「从左到右、从上到下」）
  Columns.refresh(gridEl);
  // 封面进入视口前 200px 再加载高清图
  if (window.Motion) window.Motion.lazyImages(gridEl);

  // 渲染分页
  const totalPages = Math.ceil(filteredArticles.length / ITEMS_PER_PAGE);
  if (paginationEl && totalPages >= 1) {
    let pHtml = '';
    pHtml += `<button class="page-btn prev-btn" ${currentPage <= 1 ? 'disabled' : ''} data-page="${currentPage - 1}">‹ 上一页</button>`;
    for (let i = 1; i <= totalPages; i++) {
      pHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    pHtml += `<button class="page-btn next-btn" ${currentPage >= totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">下一页 ›</button>`;
    paginationEl.innerHTML = pHtml;
    paginationEl.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        if (this.disabled) return;
        currentPage = parseInt(this.dataset.page);
        renderGarden();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
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
      (a.title || '').toLowerCase().includes(query) ||
      (a.desc || '').toLowerCase().includes(query) ||
      (a.tags || []).some(t => t.toLowerCase().includes(query))
    );
  }
  currentPage = 1;
  sortArticles();
  renderGarden();
}
