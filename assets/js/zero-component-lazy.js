/* ============================================================
  zero-component-lazy.js — zero-comment 组件包按需加载
  ------------------------------------------------------------
  以前 zero/boot.html 每页都同步引一次 zero-comment.js（122KB / gzip 44KB / brotli 38KB），
  可这些组件全在页面下半部（文章底部的点赞收藏、评论区、时刻卡片的评论区），
  读者还没滚到就得先把它下完 —— 落地页、关于、归档、404 一枚都没有，纯白下。

  规则只有一条：页面里真有一枚 zero-* 进了视野附近（上下 400px）才下载。

  为什么不在脚本一执行就先量一次：那时图片还没到位，整页比最终高度矮得多，
  位于文章末尾的评论区会被算进「快到视野里」，等于一开页就把整包下下来，白延一次。
  所以这里等版式稳定（load 事件）之后再量，外加每次滚动/缩放重新量。

  · shuo.js 生成的时刻卡片是后插进来的 → load 之后两次补量 + 滚动时都会重新看
  · zero-comments.js / shuo.js 接管第三方评论时自己会用同一个 src 调 loadScript，
    ZeroStack 按地址缓存，最多多一个已完成的 Promise，不会重复下载
  · custom element 脚本晚到只是晚一点 upgrade，先出现的空壳不会坏，延后是安全的
  · 浏览器没有 addEventListener（老得离谱）→ 直接加载，别把评论区弄没
  ============================================================ */
(function () {
  var cur = document.currentScript;
  var src = cur && cur.getAttribute('data-component-src');
  if (!src) return;
  if (typeof window.addEventListener !== 'function') { inject(); return; }

  var SEL = 'zero-comment,zero-like,zero-subscribe,zero-moments,zero-login';
  var EDGE = 400;
  var started = false;
  var queued = false;

  function inject() {
    if (started) return;
    started = true;
    var Z = window.ZeroStack;
    if (Z && typeof Z.loadScript === 'function') {
      Z.loadScript(src);
      return;
    }
    var s = document.createElement('script');
    s.src = src;
    s.defer = true;
    document.head.appendChild(s);
  }

  /** 没 upgrade 的元素宽高都是 0，只能用 rect.top 判断它离视野多远 */
  function near(el) {
    /* 收起的评论框在 [hidden] 里，rect 是 0×0 且贴左上角；不排除它的话，
       时刻页首屏每一张卡都会命中一次，整包 154KB 又在没人点评论时先下了。 */
    if (el.offsetParent === null) return false;
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight || 800;
    return r.top <= vh + EDGE && r.bottom >= -EDGE;
  }

  function check() {
    if (started) return;
    var list = document.querySelectorAll(SEL);
    for (var i = 0; i < list.length; i++) {
      if (near(list[i])) {
        inject();
        unbind();
        return;
      }
    }
  }

  function tick() {
    if (started || queued) return;
    queued = true;
    /* 用 setTimeout 而不是 requestAnimationFrame 节流：后台标签页里 rAF 根本不跑，
       读者切去别的标签再切回来时组件就永远加载不了 */
    setTimeout(function () {
      queued = false;
      check();
    }, 80);
  }

  function unbind() {
    window.removeEventListener('scroll', tick);
    window.removeEventListener('resize', tick);
  }

  window.addEventListener('scroll', tick, { passive: true });
  window.addEventListener('resize', tick);
  window.addEventListener('load', function () {
    /* 版式稳定后量一次；时刻卡片是 /api/config 回来之后才插的，隔一会儿再补量两次 */
    tick();
    setTimeout(tick, 400);
    setTimeout(tick, 1500);
  });
  if (document.readyState === 'complete') {
    tick();
    setTimeout(tick, 400);
    setTimeout(tick, 1500);
  }
})();
