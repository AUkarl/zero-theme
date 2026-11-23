// ============================================================
// lightbox.js — 图片放大查看
//   · 文章正文（.article-body）、时刻卡片（.shuo-item）与 [data-lightbox] 容器
//   · 左右切换：按钮 / 键盘 / 滑动手势 + 缩略图条
//   · 滚轮缩放、放大后拖动平移、双击还原
//   · 缩略图直接用页面里的小图，不额外拉原图
// ============================================================
(function () {
  'use strict';

  var RULES = [
    { img: '.shuo-images img, .shuo-media img', scope: '.shuo-item' },
    { img: '.article-body img', scope: '.article-body' },
    { img: '[data-lightbox] img', scope: '[data-lightbox]' }
  ];

  var cur = document.currentScript;
  var T = {
    close: (cur && cur.dataset.close) || '关闭',
    prev: (cur && cur.dataset.prev) || '上一张',
    next: (cur && cur.dataset.next) || '下一张',
    view: (cur && cur.dataset.view) || '查看大图'
  };

  var box = null, stageEl = null, imgEl = null, countEl = null, thumbsEl = null;
  var list = [], idx = 0, opener = null, touchX = 0;
  var scale = 1, panX = 0, panY = 0, dragging = false, dragX = 0, dragY = 0, startX = 0, startY = 0;

  function source(img) {
    return img.getAttribute('data-orig') || img.getAttribute('data-src') || img.currentSrc || img.src || '';
  }

  function thumbSource(img) {
    return img.currentSrc || img.getAttribute('data-src') || img.getAttribute('src') || source(img);
  }

  function ruleFor(img) {
    for (var i = 0; i < RULES.length; i++) {
      if (img.matches && img.matches(RULES[i].img)) {
        var scope = img.closest(RULES[i].scope);
        if (scope) return { rule: RULES[i], scope: scope };
      }
    }
    return null;
  }

  function applyTransform() {
    if (!imgEl) return;
    imgEl.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + scale + ')';
    imgEl.style.cursor = scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in';
  }

  function resetZoom() {
    scale = 1;
    panX = 0;
    panY = 0;
    applyTransform();
  }

  function build() {
    box = document.createElement('div');
    box.className = 'lightbox';
    box.hidden = true;
    box.innerHTML =
      '<button type="button" class="lightbox-btn lightbox-close" aria-label="' + T.close + '">&times;</button>' +
      '<button type="button" class="lightbox-btn lightbox-prev" aria-label="' + T.prev + '">&#8249;</button>' +
      '<div class="lightbox-stage"><img class="lightbox-img" alt="" draggable="false"></div>' +
      '<button type="button" class="lightbox-btn lightbox-next" aria-label="' + T.next + '">&#8250;</button>' +
      '<span class="lightbox-count" aria-hidden="true"></span>' +
      '<div class="lightbox-thumbs" aria-label="缩略图"></div>';
    document.body.appendChild(box);
    stageEl = box.querySelector('.lightbox-stage');
    imgEl = box.querySelector('.lightbox-img');
    countEl = box.querySelector('.lightbox-count');
    thumbsEl = box.querySelector('.lightbox-thumbs');

    box.querySelector('.lightbox-close').addEventListener('click', close);
    box.querySelector('.lightbox-prev').addEventListener('click', function (e) { e.stopPropagation(); go(-1); });
    box.querySelector('.lightbox-next').addEventListener('click', function (e) { e.stopPropagation(); go(1); });
    imgEl.addEventListener('click', function (e) { e.stopPropagation(); });
    imgEl.addEventListener('dblclick', function (e) { e.preventDefault(); resetZoom(); });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });

    box.addEventListener('wheel', function (e) {
      if (box.hidden) return;
      e.preventDefault();
      var next = scale * (e.deltaY < 0 ? 1.12 : 0.89);
      next = Math.min(4, Math.max(1, next));
      scale = next;
      if (scale === 1) { panX = 0; panY = 0; }
      applyTransform();
    }, { passive: false });

    imgEl.addEventListener('pointerdown', function (e) {
      if (scale <= 1) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      dragX = panX;
      dragY = panY;
      try { imgEl.setPointerCapture(e.pointerId); } catch (err) {}
      applyTransform();
      e.preventDefault();
    });
    imgEl.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      panX = dragX + (e.clientX - startX);
      panY = dragY + (e.clientY - startY);
      applyTransform();
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      applyTransform();
    }
    imgEl.addEventListener('pointerup', endDrag);
    imgEl.addEventListener('pointercancel', endDrag);

    box.addEventListener('touchstart', function (e) { touchX = e.changedTouches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (scale > 1) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40 && list.length > 1) go(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function buildThumbs() {
    if (!thumbsEl) return;
    thumbsEl.innerHTML = '';
    thumbsEl.hidden = list.length < 2;
    if (list.length < 2) return;
    list.forEach(function (img, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lightbox-thumb';
      b.setAttribute('aria-label', '第 ' + (i + 1) + ' 张');
      var im = document.createElement('img');
      im.src = thumbSource(img);
      im.alt = '';
      im.loading = 'lazy';
      im.decoding = 'async';
      im.draggable = false;
      b.appendChild(im);
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        show(i, i > idx ? 1 : -1);
      });
      thumbsEl.appendChild(b);
    });
  }

  function markThumb() {
    if (!thumbsEl || thumbsEl.hidden) return;
    Array.prototype.forEach.call(thumbsEl.children, function (b, i) {
      b.classList.toggle('active', i === idx);
      if (i === idx && b.scrollIntoView) {
        try { b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } catch (e) {}
      }
    });
  }

  function animate(dir) {
    if (!stageEl) return;
    stageEl.classList.remove('lightbox-slide-left', 'lightbox-slide-right');
    void stageEl.offsetWidth;
    if (dir === 1) stageEl.classList.add('lightbox-slide-left');
    else if (dir === -1) stageEl.classList.add('lightbox-slide-right');
  }

  function show(i, dir) {
    idx = (i + list.length) % list.length;
    resetZoom();
    var src = source(list[idx]);
    imgEl.src = src;
    imgEl.alt = list[idx].getAttribute('alt') || '';
    countEl.textContent = list.length > 1 ? (idx + 1) + ' / ' + list.length : '';
    var multi = list.length > 1;
    box.querySelector('.lightbox-prev').hidden = !multi;
    box.querySelector('.lightbox-next').hidden = !multi;
    markThumb();
    animate(dir || 0);
    [-1, 1].forEach(function (d) {
      if (!multi) return;
      var n = list[(idx + d + list.length) % list.length];
      var s = source(n);
      if (s) { var im = new Image(); im.src = s; }
    });
  }

  function go(d) { show(idx + d, d); }

  function open(img) {
    var found = ruleFor(img);
    if (!found) return;
    list = Array.prototype.slice.call(found.scope.querySelectorAll(found.rule.img)).filter(function (i) {
      var s = source(i);
      return s && !/\.svg(\?|$)/i.test(s);
    });
    if (!list.length) return;
    if (!box) build();
    opener = img;
    box.hidden = false;
    document.body.classList.add('lightbox-open');
    buildThumbs();
    show(Math.max(0, list.indexOf(img)), 0);
    box.querySelector('.lightbox-close').focus();
  }

  function close() {
    if (!box || box.hidden) return;
    box.hidden = true;
    resetZoom();
    imgEl.removeAttribute('src');
    document.body.classList.remove('lightbox-open');
    if (opener && opener.focus) { try { opener.focus(); } catch (e) {} }
  }

  document.addEventListener('click', function (e) {
    var img = e.target && e.target.tagName === 'IMG' ? e.target : null;
    if (!img || !ruleFor(img)) return;
    var a = img.closest('a');
    if (a) e.preventDefault();
    e.stopPropagation();
    open(img);
  }, true);

  document.addEventListener('keydown', function (e) {
    if (!box || box.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  });
})();
