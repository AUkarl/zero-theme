/**
 * search.js — /search/ 页的站内搜索（纯前端、零依赖）
 *
 * 索引由 Hugo 在构建期生成到 /search/index.json（见 layouts/search/list.json），
 * 这里只负责：取一次索引 → 本地打分 → 渲染结果。没有请求发到后端，关掉后端也能搜。
 *
 * 打分只有一条原则：标题命中最重，其次标签、摘要、正文；
 * 多个关键词默认「全部命中」才算结果，全都命不中时退回「任一命中」，
 * 免得用户多打一个词就得到空白页。中文按子串匹配，无需分词。
 */
(function () {
  var form = document.getElementById('searchForm');
  var input = document.getElementById('searchInput');
  var list = document.getElementById('searchResults');
  var status = document.getElementById('searchStatus');
  if (!form || !input || !list || !status) return;

  /* 索引地址由页面给（带构建版本号，见 layouts/search/list.html）；
     拿不到属性时退回老写法，页面照常能搜。 */
  var INDEX_URL = form.getAttribute('data-index-url') || 'index.json';
  var MAX_RESULTS = 30;
  var index = null;
  var indexPromise = null;
  var timer = 0;

  function text(node, value) {
    node.textContent = value;
    return node;
  }

  function loadIndex() {
    if (indexPromise) return indexPromise;
    indexPromise = fetch(INDEX_URL, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var pages = (data && data.pages) || [];
        pages.forEach(function (p) {
          p._title = String(p.t || '').toLowerCase();
          p._tags = (p.g || []).map(function (t) { return String(t).toLowerCase(); });
          p._summary = String(p.x || '').toLowerCase();
          p._body = String(p.c || '').toLowerCase();
          p._date = String(p.d || '');
        });
        index = pages;
        return pages;
      })
      .catch(function () {
        index = [];
        status.textContent = '搜索索引没加载出来：确认站点是用主题的 /search/ 页生成的（构建产物里应有 /search/index.json）。';
        return index;
      });
    return indexPromise;
  }

  function countIn(haystack, needle) {
    if (!haystack || !needle) return 0;
    var n = 0;
    var at = haystack.indexOf(needle);
    while (at !== -1 && n < 4) {
      n++;
      at = haystack.indexOf(needle, at + needle.length);
    }
    return n;
  }

  function termsOf(query) {
    var seen = {};
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(function (t) {
        if (!t || seen[t]) return false;
        seen[t] = 1;
        return true;
      });
  }

  function scoreOf(page, terms) {
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      var s = countIn(page._title, t) * 12;
      if (!s) {
        for (var g = 0; g < page._tags.length; g++) {
          if (page._tags[g].indexOf(t) !== -1) { s += 6; break; }
        }
      }
      s += countIn(page._summary, t) * 3;
      s += Math.min(countIn(page._body, t), 4);
      if (!s) return 0;
      total += s;
    }
    return total;
  }

  function snippetOf(page, terms) {
    var body = String(page.c || '');
    var lower = page._body;
    var at = -1;
    for (var i = 0; i < terms.length && at === -1; i++) at = lower.indexOf(terms[i]);
    if (at === -1) return String(page.x || '');
    var from = Math.max(0, at - 50);
    var to = Math.min(body.length, at + 110);
    return (from > 0 ? '…' : '') + body.slice(from, to).trim() + (to < body.length ? '…' : '');
  }

  function sectionLabel(section) {
    var map = { posts: '文章', moments: '时刻', about: '关于', work: '工坊' };
    return map[section] || section || '';
  }

  function markInto(node, raw, terms) {
    var lower = raw.toLowerCase();
    var hits = [];
    terms.forEach(function (t) {
      var at = lower.indexOf(t);
      while (at !== -1) {
        hits.push([at, at + t.length]);
        at = lower.indexOf(t, at + t.length);
      }
    });
    if (!hits.length) return text(node, raw);
    hits.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    hits.forEach(function (h) {
      var last = merged[merged.length - 1];
      if (last && h[0] <= last[1]) last[1] = Math.max(last[1], h[1]);
      else merged.push([h[0], h[1]]);
    });
    var cursor = 0;
    merged.forEach(function (h) {
      if (h[0] > cursor) node.appendChild(document.createTextNode(raw.slice(cursor, h[0])));
      var mark = document.createElement('mark');
      mark.textContent = raw.slice(h[0], h[1]);
      node.appendChild(mark);
      cursor = h[1];
    });
    if (cursor < raw.length) node.appendChild(document.createTextNode(raw.slice(cursor)));
    return node;
  }

  function render(pages, query, terms) {
    list.textContent = '';
    if (!pages.length) {
      status.textContent = query ? '没有找到与「' + query + '」相关的内容。' : '';
      return;
    }
    status.textContent = '找到 ' + pages.length + ' 条结果' + (pages.length > MAX_RESULTS ? '（显示前 ' + MAX_RESULTS + ' 条）' : '');
    pages.slice(0, MAX_RESULTS).forEach(function (page) {
      var li = document.createElement('li');
      li.className = 'search-result';
      var a = document.createElement('a');
      a.className = 'search-result-link';
      a.href = page.u;
      var h = document.createElement('h2');
      h.className = 'search-result-title';
      markInto(h, String(page.t || ''), terms);
      a.appendChild(h);
      var meta = document.createElement('p');
      meta.className = 'search-result-meta';
      var bits = [page._date, sectionLabel(page.s)].filter(Boolean);
      if (page.g && page.g.length) bits.push(page.g.slice(0, 3).join(' / '));
      text(meta, bits.join(' · '));
      a.appendChild(meta);
      var snip = document.createElement('p');
      snip.className = 'search-result-snippet';
      markInto(snip, snippetOf(page, terms), terms);
      a.appendChild(snip);
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function run(query, syncUrl) {
    query = String(query || '').trim();
    if (syncUrl) {
      var next = query ? '?q=' + encodeURIComponent(query) : location.pathname;
      history.replaceState(null, '', next);
    }
    if (!query) {
      list.textContent = '';
      status.textContent = '';
      return;
    }
    var terms = termsOf(query);
    status.textContent = '搜索中…';
    loadIndex().then(function (pages) {
      if (!pages.length) return;
      var hits = [];
      pages.forEach(function (p) {
        var s = scoreOf(p, terms);
        if (s) hits.push({ p: p, s: s });
      });
      // 全部命中不够时退回任一命中：中文里多打一个字就全灭，体验很差
      if (!hits.length && terms.length > 1) {
        pages.forEach(function (p) {
          var s = 0;
          terms.forEach(function (t) { s += scoreOf(p, [t]); });
          if (s) hits.push({ p: p, s: s });
        });
      }
      hits.sort(function (a, b) {
        if (b.s !== a.s) return b.s - a.s;
        return String(b.p.d).localeCompare(String(a.p.d));
      });
      render(hits.map(function (h) { return h.p; }), query, terms);
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearTimeout(timer);
    run(input.value, true);
  });

  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { run(input.value, true); }, 160);
  });

  var initial = new URLSearchParams(location.search).get('q') || '';
  if (initial) {
    input.value = initial;
    run(initial, false);
  } else {
    loadIndex();
  }
})();
