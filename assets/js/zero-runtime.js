// ============================================================
// zero-runtime.js — zero-stack 后端的前端运行时入口
//
// 由 partials/zero/boot.html 引入，全站一次。职责只有三件：
//   1. 记住 apiBase（构建期写死在 <html> 的 data 属性里）
//   2. 拉一次 /api/config 并缓存，暴露给评论区 / 时刻页 / 账号页 / 友链页
//   3. 统一 fetch：带 Cookie、解包 {data}、把 {error,message} 变成异常
//
// 后台改的开关要能在不重新构建站点的前提下生效，靠的就是这里。
// ============================================================
(function () {
  'use strict';

  if (window.ZeroStack) return;

  var root = document.documentElement;
  var base = (root.getAttribute('data-zero-api') || '').replace(/\/+$/, '');
  var CONFIG_KEY = 'zero:config:v1';
  var TTL = 60 * 1000;

  var cached = null;
  var pending = null;

  function readCache() {
    try {
      var raw = sessionStorage.getItem(CONFIG_KEY);
      if (!raw) return null;
      var box = JSON.parse(raw);
      if (!box || typeof box.at !== 'number' || Date.now() - box.at > TTL) return null;
      return box.config || null;
    } catch (e) {
      return null;
    }
  }

  function writeCache(config) {
    try {
      sessionStorage.setItem(CONFIG_KEY, JSON.stringify({ at: Date.now(), config: config }));
    } catch (e) {
      /* 隐私模式下 sessionStorage 会抛，缓存丢了无所谓 */
    }
  }

  /** 拉公开配置；多个调用点共享同一次请求 */
  function config(opts) {
    if (cached && !(opts && opts.force)) return Promise.resolve(cached);
    if (pending && !(opts && opts.force)) return pending;

    var fromCache = readCache();
    if (fromCache && !(opts && opts.force)) {
      cached = fromCache;
      return Promise.resolve(fromCache);
    }
    if (!base) return Promise.resolve(fromCache || {});

    pending = fetch(base + '/api/config', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('config ' + r.status)); })
      .then(function (body) {
        cached = (body && body.data) || {};
        writeCache(cached);
        pending = null;
        emit();
        return cached;
      })
      .catch(function (e) {
        pending = null;
        cached = cached || fromCache || {};
        return cached;
      });
    return pending;
  }

  function emit() {
    document.dispatchEvent(new CustomEvent('zero:config', { detail: cached || {} }));
  }

  /** 等配置到位后回调；配置已经拿到了就立刻回调 */
  function ready(fn) {
    config().then(function (cfg) { fn(cfg); });
  }

  function messageOf(body, status) {
    if (body && typeof body.message === 'string' && body.message) return body.message;
    if (status === 401) return '请先登录';
    if (status === 403) return '没有权限';
    if (status === 429) return '操作过于频繁，稍后再试';
    return '请求失败（' + status + '）';
  }

  /**
   * 统一请求：path 以 / 开头，相对 apiBase。
   * 成功返回响应里的 data；失败抛 Error，err.status / err.body 供调用方判断。
   */
  function api(path, options) {
    var opt = options || {};
    var headers = { Accept: 'application/json' };
    var body = opt.body;
    if (body !== undefined && body !== null && typeof body !== 'string') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    if (opt.headers) for (var k in opt.headers) headers[k] = opt.headers[k];

    return fetch(base + path, {
      method: opt.method || (body !== undefined ? 'POST' : 'GET'),
      headers: headers,
      body: body === undefined ? null : body,
      credentials: 'include',
    }).then(function (r) {
      return r.text().then(function (text) {
        var parsed = null;
        try { parsed = text ? JSON.parse(text) : null; } catch (e) { parsed = null; }
        if (!r.ok) {
          var err = new Error(messageOf(parsed, r.status));
          err.status = r.status;
          err.body = parsed;
          throw err;
        }
        return parsed && Object.prototype.hasOwnProperty.call(parsed, 'data') ? parsed.data : parsed;
      });
    });
  }

  /** 按需加载脚本，同一个 url 只加载一次（评论组件与外部系统都用它） */
  var scripts = {};
  function loadScript(url, asModule) {
    if (scripts[url]) return scripts[url];
    scripts[url] = new Promise(function (resolve, reject) {
      var el = document.createElement('script');
      el.src = url;
      if (asModule) el.type = 'module';
      el.defer = true;
      el.onload = function () { resolve(url); };
      el.onerror = function () { delete scripts[url]; reject(new Error('脚本加载失败：' + url)); };
      document.head.appendChild(el);
    });
    return scripts[url];
  }

  var styles = {};
  function loadStyle(url) {
    if (styles[url]) return;
    styles[url] = 1;
    var el = document.createElement('link');
    el.rel = 'stylesheet';
    el.href = url;
    document.head.appendChild(el);
  }

  /* 会话状态：登录 Cookie 是 HttpOnly 的，只能问后端。全站共用同一个在途请求，
     账号页派发 zero:session（登录 / 注销 / 改资料）时作废重问 ——
     导航栏图标、点赞收藏、评论区都读这一份，别各问各的（每问一次就多一次 Worker + D1 读）。 */
  var mePromise = null;
  function me() {
    if (!base) return Promise.resolve(null);
    if (!mePromise) {
      mePromise = api('/api/auth/me')
        .then(function (d) { return (d && d.user) || null; })
        .catch(function () { mePromise = null; return null; });
    }
    return mePromise;
  }
  document.addEventListener('zero:session', function () { mePromise = null; });

  window.ZeroStack = {
    base: base,
    enabled: !!base,
    config: config,
    ready: ready,
    api: api,
    me: me,
    loadScript: loadScript,
    loadStyle: loadStyle,
  };

  if (base) config();
})();
