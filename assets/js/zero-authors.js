// ============================================================
// zero-authors.js — 文章署名、底部作者框与作者页的运行时补充
//
// 静态渲染（Hugo + data/authors.yaml）负责名字和头像；这里只做一件事：
// 补资料 —— yaml 里没登记的新作者（投稿制进来的），拿 D1 的昵称、头像、
// 简介与个人站点顶上。作者标识（users.handle）就是 front matter 里 author 写的值。
// 认证徽章已经连作者认证一起删掉，这里不再读 /api/authors 的 verified。
// ============================================================
(function () {
  'use strict';

  function start() {
    if (!window.ZeroStack || !window.ZeroStack.enabled) return;
    var bylines = [].slice.call(document.querySelectorAll('.author-byline[data-author-ids]'));
    var boxes = [].slice.call(document.querySelectorAll('.article-author[data-author]'));
    var profile = document.querySelector('.author-profile[data-author-id]');
    if (!bylines.length && !boxes.length && !profile) return;

    var ids = [];
    function push(v) {
      v = (v || '').trim();
      if (v && ids.indexOf(v) < 0 && ids.length < 20) ids.push(v);
    }
    bylines.forEach(function (el) {
      (el.dataset.authorIds || '').split(',').forEach(push);
    });
    boxes.forEach(function (el) { push(el.dataset.author); });
    if (profile) push(profile.dataset.authorId);
    if (!ids.length) return;

    window.ZeroStack.api('/api/authors?ids=' + ids.map(encodeURIComponent).join(',')).then(function (list) {
      var map = {};
      (list || []).forEach(function (a) {
        if (!a) return;
        if (a.id) map[a.id] = a;
        if (a.handle) map[a.handle] = a;
      });

      [].forEach.call(document.querySelectorAll('.byline-item[data-raw="1"]'), function (item) {
        var a = map[item.dataset.author];
        if (!a) return;
        var name = item.querySelector('.byline-name');
        if (name && a.name) { name.textContent = a.name; item.dataset.initial = String(a.name).slice(0, 1); }
        var img = item.querySelector('.byline-avatar');
        if (img && a.image) { img.src = a.image; item.classList.remove('is-fallback'); }
        item.dataset.raw = '0';
      });

      if (profile) fillProfile(profile, map[profile.dataset.authorId]);

      // 底部作者框与顶部署名用同一份 D1 资料，yaml 滞后时两处一起补
      boxes.forEach(function (box) {
        if (box.dataset.raw !== '1') return;
        var a = map[box.dataset.author];
        if (!a) return;
        var name = box.querySelector('.author-name');
        var holder = box.querySelector('.author-avatar');
        if (name && a.name) {
          name.textContent = a.name;
          if (holder) holder.dataset.initial = String(a.name).slice(0, 1);
        }
        var img = box.querySelector('.author-avatar img');
        if (img && a.image) { img.src = a.image; if (holder) holder.classList.remove('is-fallback'); }
        var bio = box.querySelector('.author-bio');
        if (bio && a.bio) bio.textContent = a.bio;
        box.dataset.raw = '0';
      });
    }).catch(function () { /* 后端不可达就保持静态渲染的样子 */ });
  }

  function fillProfile(el, a) {
    if (!a) return;
    if (el.dataset.known === '1') return;
    var name = el.querySelector('.ap-name-text');
    var head = el.querySelector('.ap-head');
    if (name && a.name) {
      name.textContent = a.name;
      if (head) head.dataset.initial = String(a.name).slice(0, 1);
    }
    var img = el.querySelector('.ap-avatar');
    if (img && a.image) { img.src = a.image; if (head) head.classList.remove('is-fallback'); }
    var bio = el.querySelector('.ap-bio:not(.ap-rich)');
    if (bio && a.bio) bio.textContent = a.bio;
    var site = el.querySelector('.ap-site');
    if (site && a.website) {
      site.hidden = false;
      site.href = a.website;
      var label = site.querySelector('span');
      if (label) label.textContent = a.website.replace(/^https?:\/\//, '');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
