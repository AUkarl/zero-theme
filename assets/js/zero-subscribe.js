// ============================================================
// zero-subscribe.js — 邮箱订阅表单（主题自己实现，不依赖组件包）
//
// 为什么不用 <zero-subscribe>：那个组件把 api-base 为空的情况直接 return
// （点了没反应、也不给任何提示），失败时又只会把后端的原始 message 打出来
// （"确认邮件发送失败，请稍后再试或联系站主" / "请求失败 (404)"），访客看不懂。
// 这里复用 window.ZeroStack（同一个 /api/config 缓存、同一个 fetch 封装），
// 只把「文案」和「失败原因分类」换成访客能理解的话。
//
// 后端接口：
//   POST /api/subscribe            { email } → { status: 'pending' | 'confirmed' }
//     开了双确认（subscribeDoubleOptIn）时会发确认邮件；没配发信凭据就是 502
//   GET  /api/subscribe/status     ?email= → { status: 'none'|'pending'|'confirmed'|'unsubscribed' }
//   GET  /api/subscribe/unsub      ?token= → 邮件里的退订链接（点开即退）
// ============================================================
(function () {
  'use strict';

  function readI18n(form) {
    var host = form.querySelector('.zsf-i18n');
    if (!host) return {};
    try { return JSON.parse(host.textContent) || {}; } catch (e) { return {}; }
  }

  function msg(el, text, kind) {
    if (!el) return;
    el.textContent = text || '';
    el.className = el.className.replace(/\bzsf-is-\w+\b/g, '').trim() + (kind ? ' zsf-is-' + kind : '');
  }

  /** 后端返回的中文原因（{ error, message } 里的 message）能拿到就原样显示 */
  function backendText(err) {
    var raw = err && (err.message || (err.body && err.body.message));
    if (!raw || typeof raw !== 'string') return '';
    return raw.trim();
  }

  /**
   * 把失败翻译成访客能看懂的一句话。
   * 原则：后端已经把原因写清楚了（「确认邮件发送失败，请稍后再试或联系站主」），
   * 就别用一句笼统的兜底文案盖掉它；拿不到 message 才退回本地文案。
   */
  function explain(err, T) {
    var status = err && err.status;
    var fromApi = backendText(err);
    if (!status) return T.unreachable || '连不上订阅服务，请稍后再试或联系站长。';
    if (status === 502 || status === 503) {
      // 发信凭据没配 / 发信失败：把后端的中文原样带上，再补一句访客真正需要知道的结论
      return [fromApi || (T.mailUnconfigured || '服务未配置发信，请稍后再试或联系站长。'),
              T.mailHint || '站长需在后台配置发信服务后才能收到确认邮件。'].join(' ');
    }
    if (status === 403) return fromApi || T.closed || '订阅功能已关闭。';
    if (status === 400) return fromApi || T.badEmail || '邮箱格式不正确，请检查后再提交。';
    if (status === 404) return T.noService || '站点没有接通订阅服务，请联系站长。';
    if (status === 429) return fromApi || T.tooMany || '操作太频繁了，请过一会儿再试。';
    if (status === 401) return fromApi || '请先登录。';
    return fromApi || T.failed || '订阅没有成功，请稍后再试。';
  }

  function bind(form) {
    var input = form.querySelector('input[type="email"]');
    var button = form.querySelector('.zsf-btn');
    var out = form.querySelector('.zsf-msg');
    var T = readI18n(form);
    var busy = false;
    var label = button ? button.textContent.trim() : '';

    // apiBase 为空时以前是「点了没反应」，这里直接说明清楚
    if (!window.ZeroStack || !window.ZeroStack.enabled) {
      msg(out, T.noService || '站点没有接通订阅服务，请联系站长。', 'error');
      if (input) input.disabled = true;
      if (button) button.disabled = true;
      return;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy || !input) return;
      var email = String(input.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        msg(out, T.badEmail || '邮箱格式不正确，请检查后再提交。', 'error');
        return;
      }
      busy = true;
      if (button) { button.disabled = true; button.textContent = T.busy || '提交中…'; }
      msg(out, '', '');

      window.ZeroStack.api('/api/subscribe', { method: 'POST', body: { email: email } })
        .then(function (data) {
          var status = (data && data.status) || '';
          // 后端已经把话说清楚了（'订阅成功' / '该邮箱已订阅' / '确认邮件已发送，请在邮箱中点击确认'），
          // 优先原样显示；拿不到才用本地文案兜底
          var fromApi = data && typeof data.message === 'string' ? data.message.trim() : '';
          msg(out, fromApi || (status === 'confirmed'
            ? (T.already || '这个邮箱已经在订阅名单里了。')
            : (T.sent || '确认邮件已发出，请查收（含垃圾邮件箱）。')), 'success');
          input.value = '';
        })
        .catch(function (err) {
          msg(out, explain(err, T), 'error');
        })
        .then(function () {
          busy = false;
          if (button) { button.disabled = false; button.textContent = label; }
        });
    });
  }

  /** 已订阅状态查询：GET /api/subscribe/status?email= */
  function bindStatus(box) {
    var input = box.querySelector('input[type="email"]');
    var button = box.querySelector('.zs-query-btn');
    var out = box.querySelector('.zs-state');
    var T = readI18n(box) || {};
    if (!window.ZeroStack || !window.ZeroStack.enabled) {
      msg(out, T.noService || '站点没有接通订阅服务，请联系站长。', 'error');
      if (button) button.disabled = true;
      return;
    }
    var STATE = {
      none: T.stNone || '这个邮箱不在订阅名单里。',
      pending: T.stPending || '已提交但还没确认：去邮箱点一下确认链接才算订阅成功。',
      confirmed: T.stConfirmed || '已订阅，新文章会发到这个邮箱。',
      unsubscribed: T.stUnsubscribed || '此前已退订；想重新订阅就在上面再提交一次。',
    };
    button.addEventListener('click', function (e) {
      e.preventDefault();
      var email = String((input && input.value) || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        msg(out, T.badEmail || '邮箱格式不正确，请检查后再提交。', 'error');
        return;
      }
      button.disabled = true;
      msg(out, T.querying || '查询中…', '');
      window.ZeroStack.api('/api/subscribe/status?email=' + encodeURIComponent(email))
        .then(function (data) {
          var s = (data && data.status) || 'none';
          msg(out, STATE[s] || s, s === 'confirmed' ? 'success' : '');
        })
        .catch(function (err) { msg(out, explain(err, T), 'error'); })
        .then(function () { button.disabled = false; });
    });
  }

  function start() {
    Array.prototype.slice.call(document.querySelectorAll('form.zero-subscribe-form')).forEach(function (f) {
      if (f.dataset.zsfBound) return;
      f.dataset.zsfBound = '1';
      bind(f);
    });
    Array.prototype.slice.call(document.querySelectorAll('.zero-subscribe-query')).forEach(function (b) {
      if (b.dataset.zsqBound) return;
      b.dataset.zsqBound = '1';
      bindStatus(b);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
