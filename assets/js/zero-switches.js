// ============================================================
// zero-switches.js — 后台开关的通用运行时挂接
//
// 契约：GET /api/config 的 data 下是一批扁平键（subscribeEnabled / friendsEnabled /
// friendApplyEnabled / momentsEnabled / likeEnabled / starEnabled / commentEnabled …）。
// 模板里凡是受这些开关控制的区块，都用 partials/zero/switch.html 标注：
//
//   data-zero-switch="momentsEnabled"                    开关为真时显示
//   data-zero-switch="momentsEnabled" data-zero-when="off"   开关为假时显示（关闭提示）
//
// 关键点是「默认隐藏，拿到配置再露出」：构建期就把可能被关闭的区块写成 hidden，
// 后台关掉某功能时访客不会闪看到它（时刻 / 友链 / 订阅的导航入口尤其明显）。
// 反过来，只有 zeroEnabled（配了 params.apiBaseURL）时模板才加 hidden——
// 没配后端就是纯静态站点，脚本压根不加载，区块照旧显示。
//
// 拿不到配置（后端挂了、键不存在）时按「默认开」处理：cfg[key] 只有明确是
// false / "false" 才算关闭，页面不会因此变成空白。
// ============================================================
(function () {
  'use strict';

  var SELECTOR = '[data-zero-switch]';

  function isOn(cfg, key) {
    var v = cfg ? cfg[key] : undefined;
    if (v === undefined || v === null || v === '') return true;
    if (v === false || v === 'false' || v === 0 || v === '0') return false;
    return true;
  }

  function show(el, visible) {
    if (visible) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
    el.setAttribute('data-zero-switch-state', visible ? 'on' : 'off');
  }

  /** 应用一次配置；返回各键的最终状态，供别的脚本复用 */
  function apply(cfg) {
    var state = {};
    Array.prototype.slice.call(document.querySelectorAll(SELECTOR)).forEach(function (el) {
      var key = (el.getAttribute('data-zero-switch') || '').trim();
      if (!key) return;
      if (!(key in state)) state[key] = isOn(cfg, key);
      var wantOff = (el.getAttribute('data-zero-when') || 'on') === 'off';
      show(el, wantOff ? !state[key] : state[key]);
    });
    tidyNav();
    document.dispatchEvent(new CustomEvent('zero:switches', { detail: state }));
    return state;
  }

  /** 子菜单整组被关掉时，父项也一起收起来，免得留个展开后空荡荡的按钮 */
  function tidyNav() {
    Array.prototype.slice.call(document.querySelectorAll('.nav-item-sub')).forEach(function (item) {
      var menu = item.querySelector('.nav-submenu');
      if (!menu) return;
      var links = Array.prototype.slice.call(menu.querySelectorAll('.nav-submenu-link'));
      var any = links.some(function (a) { return !a.hasAttribute('hidden'); });
      show(item, any);
    });
  }

  function boot() {
    if (!window.ZeroStack || !window.ZeroStack.enabled) return;
    /* 先按构建期烘进来的快照定一次（data/switches.json → window.__zeroSwitches），
       再等 /api/config 回来校正。
       以前这里只能等那次接口：带 data-zero-switch 的区块在 HTML 里是 hidden 的，
       线上实测 /about/ 的 zero-switches.js → /api/config 串在关键路径上 4.8 秒，
       把本来就已经在 HTML 里的正文绘制一起拖成了 LCP。
       运行期这一路必须保留：后台改开关还是要当场生效（最迟几秒内翻转），
       快照只负责「首屏别排队」，不负责「说了算」。 */
    if (window.__zeroSwitches) apply(window.__zeroSwitches);
    window.ZeroStack.ready(apply);
    // 后台改完开关后同一页面里重新拉配置（zero-runtime 会广播）也要跟上
    document.addEventListener('zero:config', function (e) { apply(e.detail || {}); });
  }

  window.ZeroSwitches = { apply: apply, isOn: isOn };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
