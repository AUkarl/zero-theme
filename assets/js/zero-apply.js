// ============================================================
// zero-apply.js — 友链在线申请
//
// 只做一件事：提交 /api/friends/apply，结果回显在表单里的 .za-msg。
// 表单是否显示由后台的 friendApplyEnabled / friendsEnabled 决定，
// 所以站主关掉申请入口不需要重新构建站点。
// ============================================================
(function () {
  'use strict';

  // 后端认的字段名（partials/zero/apply.html 的 name 属性与之一致）。
  // 表单里没有的（reason）也要出现在 payload 里补个空串，免得后端按缺字段处理。
  var FIELDS = ['name', 'url', 'email', 'rssUrl', 'avatar', 'friendLink', 'description', 'reason', 'hp'];

  function start() {
    var form = document.getElementById('zeroApplyForm');
    var msg = document.getElementById('zeroApplyMsg');
    var btn = document.getElementById('zeroApplyBtn');
    if (!form || !window.ZeroStack || !window.ZeroStack.enabled) return;

    var T = readI18n();
    var submitLabel = btn ? btn.textContent.trim() : '';
    var pending = false;

    window.ZeroStack.ready(function (cfg) {
      var open = cfg.friendsEnabled !== false && cfg.friendApplyEnabled !== false;
      if (!open) {
        form.hidden = true;
        note(form.parentElement || form, T.closed || '本站暂未开放友链申请。');
        return;
      }
      form.hidden = false;
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (pending) return;
      var payload = collect(form);
      if (!payload.name || !payload.url || !payload.email) {
        say(msg, T.fill || '站点名称、站点地址、站长邮箱都要填。', 'error');
        return;
      }
      if (!/^https?:\/\//i.test(payload.url)) {
        say(msg, T.urlBad || '站点地址要以 http:// 或 https:// 开头。', 'error');
        return;
      }
      pending = true;
      btn.disabled = true;
      btn.textContent = T.sending || '正在提交…';
      say(msg, '', '');

      window.ZeroStack.api('/api/friends/apply', { method: 'POST', body: payload })
        .then(function (data) {
          say(msg, (data && data.message) || T.ok || '已提交。', 'success');
          form.reset();
        })
        .catch(function (err) {
          say(msg, err.message || (T.network || '网络出错了，请稍后再试。'), 'error');
        })
        .then(function () {
          pending = false;
          btn.disabled = false;
          btn.textContent = submitLabel;
        });
    });
  }

  /** 收集表单 → 后端 payload：FIELDS 里的键一个不少，表单里没有的补空串 */
  function collect(form) {
    var out = {};
    var els = form.elements;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el.name) continue;
      out[el.name] = typeof el.value === 'string' ? el.value.trim() : el.value;
    }
    for (var j = 0; j < FIELDS.length; j++) {
      if (out[FIELDS[j]] === undefined) out[FIELDS[j]] = '';
    }
    return out;
  }

  function readI18n() {
    var el = document.querySelector('.zero-apply-i18n');
    if (!el) return {};
    try { return JSON.parse(el.textContent) || {}; } catch (e) { return {}; }
  }

  function say(el, text, kind) {
    if (!el) return;
    el.textContent = text || '';
    el.className = el.className.replace(/\bis-\w+\b/g, '').trim() + (kind ? ' is-' + kind : '');
  }

  /** 后台关了申请入口时，在原位置留一句话，免得面板空着像坏了 */
  function note(host, text) {
    if (!host || host.querySelector('.za-closed')) return;
    var p = document.createElement('p');
    p.className = 'za-closed';
    p.textContent = text;
    host.appendChild(p);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
