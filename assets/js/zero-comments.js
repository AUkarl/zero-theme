// ============================================================
// zero-comments.js — 评论系统的运行时接管
//
// 构建期 Hugo 按 params 里写的 provider 渲染了一份评论区（没有 JS 也能用）；
// 后台把 commentProvider 改成另一家时，这里负责把那一版换下来，
// 站点不需要重新构建。两边一致时什么都不做，保留服务端渲染的结果。
//
// 挂载点由 partials/comments/loader.html 输出：
//   #comments[data-zero-comment]
//     data-build-provider  构建期用的 provider
//     data-component-src   zero-comment 组件脚本地址
//     子节点 script.zero-comment-build-config   构建期 params 里的各家参数（兜底）
//     子节点 script.zero-comment-labels         各 provider 的标题（i18n 过）
// ============================================================
(function () {
  'use strict';

  // 第三方评论服务（Waline / Twikoo / Giscus / Artalk）的界面语言：站点只中文
  var COMMENT_LANG = 'zh-CN';

  function boot() {
    var mount = document.querySelector('[data-zero-comment]');
    if (!mount) return;
    if (!window.ZeroStack || !window.ZeroStack.enabled) return;

    window.ZeroStack.ready(function (cfg) {
      if (cfg.commentEnabled === false) {
        mount.remove();
        return;
      }
      var provider = normalizeProvider(cfg.commentProvider);
      var build = mount.getAttribute('data-build-provider') || '';
      if (!provider || provider === build) return;

      var settings = mergeSettings(provider, cfg, mount);
      render(mount, provider, settings);
    });
  }

  function normalizeProvider(v) {
    return String(v || '').trim().toLowerCase();
  }

  /** 后台填的 commentProviders 优先，缺字段时用构建期 params 兜底 */
  function mergeSettings(provider, cfg, mount) {
    var fromAdmin = parseJson(cfg.commentProviders) || {};
    var fromBuild = embedded(mount, 'zero-comment-build-config') || {};
    var admin = fromAdmin[provider] || {};
    var build = legacyKeys(fromBuild, provider);
    var out = {};
    for (var k in build) out[k] = build[k];
    for (var j in admin) if (admin[j] !== '' && admin[j] !== null && admin[j] !== undefined) out[j] = admin[j];
    return out;
  }

  // 构建期 params 用 waline_server_url 这种下划线名，运行时统一转成各家 init 的驼峰名
  var LEGACY = {
    waline: { serverURL: 'waline_server_url', emoji: 'waline_emoji', commentSorting: 'waline_comment_sorting', pageview: 'waline_pageview' },
    twikoo: { envId: 'twikoo_env_id', region: 'twikoo_region' },
    giscus: { repo: 'giscus_repo', repoId: 'giscus_repo_id', category: 'giscus_category', categoryId: 'giscus_category_id', mapping: 'giscus_mapping', label: 'giscus_label' },
    artalk: { server: 'artalk_server', site: 'artalk_site' },
  };

  function legacyKeys(build, provider) {
    var map = LEGACY[provider];
    var out = {};
    if (!map) return out;
    for (var camel in map) {
      var snake = map[camel];
      if (build[snake] !== undefined && build[snake] !== '') out[camel] = build[snake];
    }
    return out;
  }

  function parseJson(text) {
    if (!text || typeof text !== 'string') return null;
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  /** loader 把可能含引号的数据放在 <script type="application/json"> 里，避免撑坏标签 */
  function embedded(mount, cls) {
    var el = mount.querySelector('script.' + cls);
    if (!el) return null;
    return parseJson(el.textContent);
  }

  function render(mount, provider, s) {
    var slug = mount.getAttribute('data-slug') || location.pathname;
    var labels = embedded(mount, 'zero-comment-labels') || {};
    var title = labels.pageTitle || document.title;

    mount.setAttribute('data-provider', provider);
    mount.innerHTML = '';
    // Zero 自带评论组件自己会画标题（用的就是 labels.title），再补一个 h2 就成了两个「评论」
    if (provider !== 'zero') {
      var h = document.createElement('h2');
      h.className = 'comments-title';
      h.textContent = labels[provider] || labels.title || '评论';
      mount.appendChild(h);
    }

    var host = document.createElement('div');
    host.className = 'zero-comment-host';
    mount.appendChild(host);

    try {
      if (provider === 'zero') mountZero(host, slug, mount);
      else if (provider === 'waline') mountWaline(host, s);
      else if (provider === 'twikoo') mountTwikoo(host, s);
      else if (provider === 'giscus') mountGiscus(host, s);
      else if (provider === 'artalk') mountArtalk(host, s, slug, title);
      else fallback(host, provider, labels);
    } catch (e) {
      fallback(host, provider, labels, e && e.message);
    }
  }

  function fallback(host, provider, labels, reason) {
    host.innerHTML =
      '<p class="zero-comment-error">' +
      esc(labels.unavailable || '该评论系统暂时不可用') +
      (reason ? '（' + esc(reason) + '）' : '') +
      '</p>';
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------------- zero（自建） ---------------- */

  function mountZero(host, slug, mount) {
    var src = mount.getAttribute('data-component-src');
    var start = function () {
      var base = window.ZeroStack.base;
      var login = document.createElement('zero-login');
      login.setAttribute('api-base', base);
      var box = document.createElement('zero-comment');
      box.setAttribute('api-base', base);
      box.setAttribute('post-slug', slug);
      box.setAttribute('short-base', mount.getAttribute('data-short-base') || '/post/');
      host.appendChild(login);
      host.appendChild(box);
    };
    if (customElements.get('zero-comment')) return start();
    // 组件脚本由 loader 的 data-component-src 给出：优先加载，成功后再挂载
    var el = document.querySelector('script[src*="zero-comment"]');
    if (el) {
      el.addEventListener('load', function () { if (customElements.get('zero-comment')) start(); });
      return;
    }
    window.ZeroStack.loadScript(src).then(start).catch(function () {
      host.innerHTML = '<p class="zero-comment-error">' + esc('评论组件加载失败，请刷新页面') + '</p>';
    });
  }

  /* ---------------- Waline ---------------- */

  function mountWaline(host, s) {
    if (!s.serverURL) throw new Error('未配置 serverURL');
    host.id = 'waline';
    window.ZeroStack.loadStyle('https://cdn.jsdelivr.net/npm/@waline/client@latest/dist/waline.css');
    return import('https://cdn.jsdelivr.net/npm/@waline/client@latest/dist/waline.js')
      .then(function (m) {
        m.init({
          el: '#waline',
          serverURL: s.serverURL,
          emoji: s.emoji || ['https://cdn.jsdelivr.net/npm/@waline/emojis/weibo'],
          commentSorting: s.commentSorting || 'latest',
          pageview: s.pageview === false ? undefined : '.waline-pageview-count',
          lang: COMMENT_LANG,
        });
      });
  }

  /* ---------------- Twikoo ---------------- */

  function mountTwikoo(host, s) {
    if (!s.envId) throw new Error('未配置 envId');
    host.id = 'tcomment';
    return window.ZeroStack.loadScript('https://cdn.jsdelivr.net/npm/twikoo@1/dist/twikoo.all.min.js').then(function () {
      window.twikoo.init({ envId: s.envId, region: s.region || undefined, el: '#tcomment', lang: COMMENT_LANG });
    });
  }

  /* ---------------- Giscus ---------------- */

  function mountGiscus(host, s) {
    if (!s.repo || !s.repoId || !s.categoryId) throw new Error('未配置 repo / repoId / categoryId');
    host.id = 'giscus-container';
    var script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.setAttribute('data-repo', s.repo);
    script.setAttribute('data-repo-id', s.repoId);
    script.setAttribute('data-category', s.category || 'Announcements');
    script.setAttribute('data-category-id', s.categoryId);
    script.setAttribute('data-mapping', s.mapping || 'pathname');
    script.setAttribute('data-label', s.label || 'comment');
    script.setAttribute('data-strict', '0');
    script.setAttribute('data-reactions-enabled', '1');
    script.setAttribute('data-emit-metadata', '0');
    script.setAttribute('data-input-position', 'bottom');
    script.setAttribute('data-theme', giscusTheme());
    script.setAttribute('data-lang', COMMENT_LANG);
    script.crossOrigin = 'anonymous';
    script.async = true;
    host.appendChild(script);
    observeTheme();
  }

  function giscusTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark') return 'dark';
    if (t === 'light') return 'light';
    return 'preferred_color_scheme';
  }

  function observeTheme() {
    if (window.__zeroGiscusWatched) return;
    window.__zeroGiscusWatched = true;
    new MutationObserver(function () {
      var frame = document.querySelector('iframe.giscus-frame');
      if (frame) {
        frame.contentWindow.postMessage({ giscus: { setConfig: { theme: giscusTheme() } } }, 'https://giscus.app');
      }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* ---------------- Artalk ---------------- */

  function mountArtalk(host, s, slug, title) {
    if (!s.server) throw new Error('未配置 server');
    host.id = 'artalk';
    window.ZeroStack.loadStyle('https://cdn.jsdelivr.net/npm/artalk@2/dist/Artalk.css');
    return window.ZeroStack.loadScript('https://cdn.jsdelivr.net/npm/artalk@2/dist/Artalk.js').then(function () {
      window.Artalk.init({
        el: '#artalk',
        pageKey: slug,
        pageTitle: title || document.title,
        server: s.server,
        site: s.site || 'default',
        locale: COMMENT_LANG,
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
