// ============================================================
// zero-star.js — 文章页 / 时刻卡片的「收藏 ★」按钮（主题侧自己实现）
//
// 为什么不复用 <zero-like kind="star">：组件包里的点赞按钮点下去就是匿名指纹计数，
// 未登录访客点了只会以为自己收藏成功，回头在「我的收藏」里找不到东西。
// 收藏是要跟着账号走的，所以这里自己做：未登录先给一句读得懂的中文，
// 再给一个能点的「去登录」链接（跳 /account/），不把访客硬拽走。
//
// 挂载点（由 partials/zero/star.html 输出，时刻卡片由 shuo.js 现场造）：
//   <span class="zero-star" data-star-api="https://api…" data-star-slug="/posts/xxx/"></span>
// 可选 data 属性（都给了默认值，缺一个也不影响）：
//   data-star-label / data-star-active   按钮文字（未收藏 / 已收藏）
//   data-star-title                      悬停提示
//   data-star-login / data-star-login-link
//                                          未登录提示语 + 那句提示里链接的文字
//   data-star-account                    登录页地址，默认 /account/
// 按钮内部顺序：图标 → 计数 → 文字，和文章操作条左边那颗点赞胶囊一一对齐。
// 图标与点赞一颗完全同画法：没点过是空心（☆ / ♡），点下去变实心（★ / ♥）并弹一下，
// 收藏那颗用 --zero-star-fg（琥珀黄），与点赞的 --zero-react-fg 分开；形状、字号、弹跳动画两颗一致。
// 文案全部是中文字面量（站点已改成纯中文，模板不再走 i18n）。
//
// 用到的接口（都走 window.ZeroStack.api：同一个 /api/config 缓存、同一套 fetch）：
//   GET  /api/reactions?slugs=<slug>&kind=star  → { <slug>: { count, active } }
//   POST /api/reactions { slug, kind: 'star' }  → { active, count }
//   GET  /api/auth/me                            → { user } —— 判断登录态
// ============================================================
(function () {
  'use strict';

  var instances = [];

  /** 会话与登录态由 ZeroStack.me() 统一缓存（全站一次，zero:session 时作废） */
  function meOnce() {
    return window.ZeroStack.me();
  }

  /** 后台明确写 false 才算关掉；拿不到配置按「开」处理，别把按钮变成空白 */
  function isOff(v) {
    return v === false || v === 'false' || v === 0 || v === '0';
  }

  function featureFlags() {
    return window.ZeroStack.config().then(function (cfg) {
      var d = cfg || {};
      // accountSystemEnabled 关掉时整站无处登录，提示语里就不该再放「去登录」链接
      return { star: !isOff(d.starEnabled), accounts: !isOff(d.accountSystemEnabled) };
    });
  }

  function hostAttributes(host) {
    var d = host.dataset;
    return {
      api: (d.starApi || (window.ZeroStack && window.ZeroStack.base) || '').replace(/\/+$/, ''),
      slug: d.starSlug || location.pathname,
      label: d.starLabel || '收藏',
      active: d.starActive || '已收藏',
      title: d.starTitle || '收藏这篇文章',
      login: d.starLogin || '登录后才能收藏，点下面的链接去账号页登录一下。',
      loginLink: d.starLoginLink || '去登录',
      account: d.starAccount || '/account/',
      hideText: d.starHideText === '1' || d.starHideText === 'true',
    };
  }

  /** 按钮内部顺序：图标 → 计数 → 文字（bare 模式下不出文字，只靠 title 说明） */
  function build(host, o) {
    host.innerHTML =
      '<button type="button" class="zst-btn" aria-pressed="false" title="' + esc(o.title) + '">' +
        '<span class="zst-icon" aria-hidden="true">☆</span>' +
        '<span class="zst-count" hidden>0</span>' +
        (o.hideText ? '' : '<span class="zst-text">' + esc(o.label) + '</span>') +
      '</button>' +
      '<span class="zst-msg" role="status" aria-live="polite"></span>';
    return host.querySelector('.zst-btn');
  }

  /** 点下去弹一下：与 <zero-like> 影子 DOM 里那颗点赞按钮同一个动画 */
  function pop(btn) {
    btn.classList.remove('is-pop');
    void btn.offsetWidth;          /* 重新触发同名动画要先让浏览器重排一次 */
    btn.classList.add('is-pop');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function paint(btn, msgEl, state) {
    var on = !!state.active;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    var icon = btn.querySelector('.zst-icon');
    if (icon) icon.textContent = on ? '★' : '☆';   // 未点空心、点过实心
    var text = btn.querySelector('.zst-text');
    var count = btn.querySelector('.zst-count');
    if (text) text.textContent = on ? state.i18n.active : state.i18n.label;
    if (count) {
      /* 文章操作条（bare，只出图标与数字）里计数常显，包括 0：
         左边那颗点赞胶囊也是常显数字，两个都有 0 时宽度才对得上。
         时刻卡片带文字，仍按原来的做法 0 时不占位。 */
      count.hidden = !state.i18n.hideText && !(state.count > 0);
      count.textContent = state.count;
    }
    btn.title = on ? state.i18n.active : state.i18n.title;
    if (msgEl && state.message !== undefined) {
      msgEl.textContent = state.message;
      if (state.message) scheduleClear(msgEl);
      else if (msgEl.__zstT) {
        clearTimeout(msgEl.__zstT);
        msgEl.__zstT = null;
      }
    }
  }

  /** 账号页地址：带上 next，登录完能回到当前这篇 */
  function accountHref(o) {
    var base = document.documentElement.getAttribute('data-zero-account') || o.account;
    var next = encodeURIComponent(location.pathname + location.search);
    return base + (base.indexOf('?') === -1 ? '?' : '&') + 'next=' + next;
  }

  /**
   * 提示语十秒后自己收起：未登录那句话看一眼就懂了，一直挂着会把排版占住。
   * 再点一次收藏会重新计时（paint 里写入新内容时旧的定时器先清掉）。
   */
  function scheduleClear(msgEl) {
    if (msgEl.__zstT) clearTimeout(msgEl.__zstT);
    msgEl.__zstT = setTimeout(function () {
      msgEl.__zstT = null;
      msgEl.textContent = '';
    }, 10000);
  }

  /**
   * 未登录：给一句读得懂的中文 + 一个能点的「去登录」链接。
   * 不再把访客硬跳转到账号页 —— 人在读文章，突然被拽走很容易以为页面坏了。
   */
  function showLoginNotice(msgEl, o, accountsOn) {
    if (!msgEl) return;
    if (!accountsOn) {
      msgEl.textContent = '本站没有开放账号系统，暂时无法收藏。';
      scheduleClear(msgEl);
      return;
    }
    var link = accountHref(o);
    msgEl.innerHTML = esc(o.login) +
      ' <a class="zst-login-link" href="' + esc(link) + '">' + esc(o.loginLink) + '</a>';
    scheduleClear(msgEl);
  }

  function mount(host) {
    if (!host || host.dataset.zstBound === '1') return;
    if (!window.ZeroStack || !window.ZeroStack.enabled) return;
    host.dataset.zstBound = '1';

    var o = hostAttributes(host);
    var btn = build(host, o);
    var msgEl = host.querySelector('.zst-msg');
    var state = { active: false, count: 0, message: '', i18n: o };
    var flags = { star: true, accounts: true };
    paint(btn, msgEl, state);
    instances.push(host);

    featureFlags().then(function (f) {
      flags = f;
      if (f.star) host.removeAttribute('hidden');
      else host.setAttribute('hidden', '');
      if (!f.star) return;
      // 计数与「我是否收藏过」同一次请求拿回来（接口按登录用户或匿名指纹判定本人）
      return window.ZeroStack.api('/api/reactions?slugs=' + encodeURIComponent(o.slug) + '&kind=star')
        .then(function (data) {
          var d = (data && data[o.slug]) || null;
          if (!d) return;
          state.active = !!d.active;
          state.count = Number(d.count || 0);
          paint(btn, msgEl, state);
        })
        .catch(function () { /* 拿不到就只留一个空按钮，不影响读文章 */ });
    });

    var busy = false;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (busy) return;
      meOnce().then(function (user) {
        if (!user) { showLoginNotice(msgEl, o, flags.accounts); return; }
        busy = true;
        btn.disabled = true;
        state.message = '';
        var wasActive = state.active;
        var wasCount = state.count;
        // 先按预期改一下视觉，请求回来再校正，点起来不粘连
        state.active = !wasActive;
        state.count = Math.max(0, wasCount + (wasActive ? -1 : 1));
        paint(btn, msgEl, state);
        window.ZeroStack.api('/api/reactions', { method: 'POST', body: { slug: o.slug, kind: 'star' } })
          .then(function (d) {
            state.active = !!(d && d.active);
            state.count = Number((d && d.count) || 0);
          })
          .catch(function (err) {
            state.active = wasActive;
            state.count = wasCount;
            state.message = (err && err.message) || '';
          })
          .then(function () {
            busy = false;
            btn.disabled = false;
            paint(btn, msgEl, state);
            if (state.active !== wasActive) pop(btn);
          });
      });
    });
  }

  /** 扫描一遍（列表页会不断插入新卡片，接管脚本重绘后也要再扫一次） */
  function scan(root) {
    var scope = root || document;
    Array.prototype.slice.call(scope.querySelectorAll('.zero-star[data-star-slug]')).forEach(mount);
  }

  window.ZeroStar = { scan: scan, mount: mount };

  function start() { scan(document); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
