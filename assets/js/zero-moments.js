// ============================================================
// zero-moments.js — 时刻页（卡片模式）评论系统的运行时接管
//
// 构建期 Hugo 按 params 里的 [moment] comment_provider 决定了卡片底栏走哪家；
// 后台把 momentCommentProvider 改成另一家时，这里负责更新 window.momentConfig
// 并让 shuo.js 按新的那家重绘，站点不需要重新构建。两边一致时什么都不做。
//
// 挂载点由 layouts/moments/list.html 输出：
//   #shuoWrapper[data-zero-moments]
//     data-build-provider  构建期用的 provider
//     data-component-src   zero-comment 组件脚本地址
//     data-short-base      正文里 [[短链]] 的前缀
// ============================================================
(function () {
  'use strict';

  var WALINE_CSS = 'https://cdn.jsdelivr.net/npm/@waline/client@latest/dist/waline.css';
  var TWIKOO_JS = 'https://cdn.jsdelivr.net/npm/twikoo@1/dist/twikoo.all.min.js';
  var ARTALK_CSS = 'https://cdn.jsdelivr.net/npm/artalk@2/dist/Artalk.css';
  var ARTALK_JS = 'https://cdn.jsdelivr.net/npm/artalk@2/dist/Artalk.js';

  /* 后台 commentProviders 里的驼峰名 ← 构建期 params 里的驼峰名 */
  var BUILD_KEYS = {
    waline: { serverURL: 'walineServerUrl', emoji: 'walineEmoji' },
    twikoo: { envId: 'twikooEnvId', region: 'twikooRegion' },
    artalk: { server: 'artalkServer', site: 'artalkSite' },
  };

  function boot() {
    var mount = document.querySelector('[data-zero-moments]');
    if (!mount) return;
    if (!window.ZeroStack || !window.ZeroStack.enabled) return;

    window.ZeroStack.ready(function (cfg) {
      var build = mount.getAttribute('data-build-provider') || '';
      var provider = String(cfg.momentCommentProvider || '').trim().toLowerCase();
      /* 评论总开关关掉时卡片底栏不再有点赞/评论，后台那一家的开关也不该把它拉回来 */
      if (cfg.commentEnabled === false) provider = '';

      var current = window.momentConfig || {};
      /* 时刻总开关：shuo.js 用它决定「卡片要不要绘制、<zero-comment> 要不要挂载」。
         构建期的 momentConfig 里没有这个键，只能从运行期 /api/config 补进来。 */
      var open = cfg.momentsEnabled !== false;
      var wasOpen = current.momentsEnabled !== false;
      current.momentsEnabled = open;
      window.momentConfig = current;

      /* provider 和开关都没变，才真的什么都不做 */
      if (provider === build && open === wasOpen) return;

      var patch = configFor(mount, provider, cfg);
      for (var k in patch) current[k] = patch[k];

      /* 外部系统拉不到资源（离线 / CDN 被墙）也要重绘，否则卡片还停在旧的那家 */
      loadAssets(provider, current)
        .catch(function (e) { console.warn('时刻页评论资源加载失败', provider, e); })
        .then(repaint);
    });
  }

  /** 把新的 provider 翻译成 shuo.js 认得的那几个字段 */
  function configFor(mount, provider, cfg) {
    var out = { commentProvider: provider };

    if (provider === 'zero') {
      out.commentEnabled = true;
      out.zeroApiBase = window.ZeroStack.base;
      out.componentSrc = mount.getAttribute('data-component-src') || '';
      out.shortBase = mount.getAttribute('data-short-base') || '/post/';
      out.likeEnabled = cfg.likeEnabled !== false;
      return out;
    }

    if (!provider) {
      out.commentEnabled = false;
      out.likeEnabled = false;
      return out;
    }

    var s = mergeSettings(provider, cfg);
    out.commentEnabled = true;
    if (provider === 'waline') {
      out.walineServerUrl = s.serverURL || '';
      if (s.emoji) out.walineEmoji = s.emoji;
      out.likeEnabled = !!s.serverURL && cfg.likeEnabled !== false;
    } else if (provider === 'twikoo') {
      out.twikooEnvId = s.envId || '';
      out.twikooRegion = s.region || '';
      out.likeEnabled = false;
    } else if (provider === 'artalk') {
      out.artalkServer = s.server || '';
      out.artalkSite = s.site || '';
      out.likeEnabled = false;
    } else {
      out.commentEnabled = false;
    }
    return out;
  }

  /** 后台填的优先，缺的字段用构建期 params 兜底 */
  function mergeSettings(provider, cfg) {
    var fromAdmin = parseJson(cfg.commentProviders) || {};
    var build = window.momentConfig || {};
    var map = BUILD_KEYS[provider] || {};
    var out = {};
    for (var camel in map) {
      if (build[map[camel]] !== undefined && build[map[camel]] !== '') out[camel] = build[map[camel]];
    }
    var admin = fromAdmin[provider] || {};
    for (var k in admin) {
      if (admin[k] !== '' && admin[k] !== null && admin[k] !== undefined) out[k] = admin[k];
    }
    return out;
  }

  function parseJson(text) {
    if (!text || typeof text !== 'string') return null;
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  /* 登录入口：不再往 #shuoWrapper 头部插 <zero-login>。
     LoginModal 现在只渲染「登录」按钮（show-entry 才显示）和弹窗，账号 chip / 「退出」
     那套 UI 已经删掉了；时刻页每张卡片都挂着 <zero-comment>，评论区就在页面里，
     所以未登录访客在编辑框里点「登录」即可，页头不需要再插一个控件。 */

  /* 外部评论系统的资源构建期只引了原来那一家的，切换后按需补 */
  function loadAssets(provider, cfg) {
    try {
      if (provider === 'waline') {
        window.ZeroStack.loadStyle(WALINE_CSS);
      } else if (provider === 'twikoo') {
        if (!cfg.twikooEnvId) return Promise.resolve();
        return window.ZeroStack.loadScript(TWIKOO_JS);
      } else if (provider === 'artalk') {
        if (!cfg.artalkServer) return Promise.resolve();
        window.ZeroStack.loadStyle(ARTALK_CSS);
        return window.ZeroStack.loadScript(ARTALK_JS);
      }
    } catch (e) {
      console.warn('时刻页评论资源加载失败', provider, e);
    }
    return Promise.resolve();
  }

  function repaint() {
    if (window.__ZERO_SHUO__ && window.__ZERO_SHUO__.reload) window.__ZERO_SHUO__.reload();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
