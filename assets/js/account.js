// ============================================================
// account.js — 账号页（/account/）控制器
//
// 这一页是「登录 / 注册 / 找回密码」三个标签，找回密码走真流程（发码 → 填码 + 新密码）。
// 会话是 HttpOnly Cookie，所以每个请求都要带 credentials，由 ZeroStack.api
// 统一处理（解包 {data}、把 {error,message} 变成 Error，err.body 留着
// 给登录接口回的 {next:'totp'} 判断用）。
// 登录表单默认只有「邮箱 + 密码」：登录接口回 next:'totp' 时才补出动态码
// 输入框，要求带着 totp 重新提交一次。注册标签也只在 /api/config 的
// allowRegister 不为 false 时才插进标签行——后台关掉注册，页面上就没有它。
// 登录成功后本页不落地任何面板，一律跳转：
//   · 管理员 → 站点后台（CMS）首页
//   · 普通用户 → /account/me/
//
// 站点后台地址来源，优先级从高到低：
//   1) account/list.html 注入的 cmsBaseURL —— 站点 config 的 params.cmsBaseURL；
//   2) /api/config 的 cmsAdminUrl —— 管理员第一次从后台登录时后端记下的来源地址；
//   3) 模板按构建环境给出的 cmsURL —— hugo server 时是 zero-cms 的本地
//      vite 端口，正式构建是同域 /admin/；
//   4) 常量 CMS_ONLINE：以上都空时的兜底（与 account/list.html 里的
//      $cmsFallback 成对，改一处要改两处）。
// ============================================================
(function () {
  'use strict';

  var CMS_ONLINE = '/admin/';

  function start() {
    var box = document.getElementById('zeroAccountBox');
    var tabsEl = document.getElementById('zeroAccountTabs');
    var form = document.getElementById('accountForm');
    var content = document.getElementById('accountFormContent');
    var errEl = document.getElementById('accountError');
    var okEl = document.getElementById('accountSuccess');
    var btn = document.getElementById('accountSubmitBtn');
    var forgotBtn = document.getElementById('zaForgot');
    if (!box || !tabsEl || !form || !content || !btn) return;
    if (!window.ZeroStack || !window.ZeroStack.enabled) return;

    var T = readI18n();
    var tab = 'login';
    var cfg = {};
    var user = null;
    var busy = false;
    /** 站长邮箱：null = 还没取过；取到之后（哪怕是空串）就不再重复请求 */
    var adminMail = null;
    /** 登录接口回 next:'totp' 时，登录表单补出动态码这一项 */
    var needTotp = false;
    var nextPath = readNextParam();
    /** 带着有效会话直接进本页：只跳转，不再闪一句提示 */
    var silent = false;

    Promise.all([window.ZeroStack.config(), me()]).then(function (res) {
      cfg = res[0] || {};
      user = res[1];
      paint();
    });

    /** ?next=/account/me/ 只接受站内相对路径，防开放重定向 */
    function readNextParam() {
      var m = /[?&]next=([^&]+)/.exec(location.search);
      if (!m) return '';
      try {
        var raw = decodeURIComponent(m[1]);
        return /^\/(?!\/)[\w\-./?%&=#@~+]*$/.test(raw) ? raw : '';
      } catch (e) {
        return '';
      }
    }

    /* ---------------- 后台地址与登录分流 ---------------- */

    /** 站点后台入口：params.cmsBaseURL → 运行期后台自己记下的地址 → 模板按环境算好的地址 → 线上常量 */
    function cmsHref() {
      var fromParams = String(T.cmsBaseURL || '').trim();
      if (fromParams) return fromParams;
      var fromRuntime = String(cfg.cmsAdminUrl || '').trim();
      if (fromRuntime) return fromRuntime;
      var fromBuild = String(T.cmsURL || '').trim();
      return fromBuild || CMS_ONLINE;
    }

    /** 先认后端正在补的新字段 isAdmin，再兼容老响应的 user.role / 顶层 role */
    function isAdminPayload(payload) {
      if (!payload) return false;
      if (payload.isAdmin === true) return true;
      var inner = payload.user || {};
      return payload.role === 'admin' || inner.role === 'admin' || inner.isAdmin === true;
    }

    /**
     * 登录/注册成功后的分流：管理员 → 站点后台；普通用户 → 个人中心。
     * 返回 true 表示已经安排跳转，本页不再渲染表单。
     */
    function leave(payload) {
      var d = payload || {};
      var inner = d.user || d;
      var slug =
        d.account_slug || d.accountSlug || d.slug || inner.account_slug || inner.accountSlug || '';
      if (isAdminPayload(d)) {
        if (!silent) say(okEl, T.adminEnter || '登录成功，正在进入站点后台…');
        setTimeout(function () {
          window.location = cmsHref();
        }, 260);
        return true;
      }
      var target = nextPath || (slug ? '/account/me/?u=@' + encodeURIComponent(slug) : '/account/me/');
      if (!silent) say(okEl, T.loginOk || '登录成功。');
      setTimeout(function () {
        window.location = target;
      }, 260);
      return true;
    }

    /** 会话状态：/api/auth/me 的顶层身份字段（isAdmin / accountSlug）并到 user 上 */
    function me() {
      return window.ZeroStack.api('/api/auth/me')
        .then(function (d) {
          if (!d || !d.user) return null;
          var u = d.user;
          u.isAdmin = d.isAdmin === true || u.role === 'admin';
          u.accountSlug = d.accountSlug || u.accountSlug || d.account_slug || u.account_slug;
          return u;
        })
        .catch(function () {
          return null;
        });
    }

    /* ---------------- 渲染 ---------------- */

    /** 后台关掉整套前台账号系统：整页只剩提示，管理员走后台地址登录 */
    function showGate() {
      tabsEl.hidden = true;
      form.hidden = true;
      if (forgotBtn) forgotBtn.classList.remove('is-open');
      if (document.getElementById('zeroAccountGate')) return;
      var g = document.createElement('div');
      g.className = 'za-gate';
      g.id = 'zeroAccountGate';
      g.innerHTML =
        '<p class="za-gate-main">' + esc(T.gateTitle || '登录注册已关闭，如需访问请联系站长。') + '</p>';
      content.appendChild(g);
    }

    function paint() {
      // 导航栏的账号图标（header.html 里的 #navAccount）监听这个事件换头像
      document.dispatchEvent(new CustomEvent('zero:session', { detail: { user: user } }));
      if (user) {
        // 已登录不再在本页停留：管理员进后台，其他人进个人中心
        silent = true;
        leave(user);
        return;
      }
      if (cfg.accountSystemEnabled === false) {
        showGate();
        return;
      }
      tabsEl.hidden = false;
      form.hidden = false;
      syncTabs();
      renderForm();
    }

    /** 后台关掉注册时注册标签整块不出现：按钮不在 DOM 里，不是禁用 */
    function registerAllowed() {
      return cfg.allowRegister !== false;
    }

    /** 注册标签由这里按后台开关插入（静态输出里没有），关掉注册时把它摘掉 */
    function syncRegisterTab() {
      var registerTab = tabsEl.querySelector('button[data-tab="register"]');
      if (!registerAllowed()) {
        if (registerTab) registerTab.remove();
        return;
      }
      if (registerTab) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-tab', 'register');
      b.textContent = T.tabRegister || '注册';
      // 插在「找回密码」前面，保持 登录 / 注册 / 找回密码 的顺序
      tabsEl.insertBefore(b, forgotBtn || tabsEl.firstChild);
    }

    function syncTabs() {
      syncRegisterTab();
      if (!registerAllowed() && tab !== 'login') tab = 'login';
      Array.prototype.forEach.call(tabsEl.querySelectorAll('button[data-tab]'), function (b) {
        var on = b.dataset.tab === tab;
        b.classList.toggle('active-tab', on);
        /* 真 tab 语义：读屏要知道「现在在哪一档、这一档管的是下面哪块内容」 */
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.setAttribute('aria-controls', 'accountForm');
        b.setAttribute('tabindex', on ? '0' : '-1');
        if (!b.id) b.id = 'zaTab-' + b.dataset.tab;
      });
      var active = tabsEl.querySelector('button[data-tab="' + tab + '"]');
      if (active) form.setAttribute('aria-labelledby', active.id);
      // 找回密码这一档：登录页与它自己那一步都要显示，注册页不需要
      if (forgotBtn) {
        forgotBtn.hidden = tab !== 'login' && tab !== 'reset';
        forgotBtn.classList.toggle('is-open', tab === 'reset');
      }
    }

    /** 方向键在几档之间走（Tab 本身只停在当前档上，这是 tablist 的惯例） */
    function tabKeydown(e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
      var list = Array.prototype.filter.call(tabsEl.querySelectorAll('button[data-tab]'), function (b) {
        return !b.hidden;
      });
      if (!list.length) return;
      var i = list.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = list.length - 1;
      else i = (i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length;
      list[i].focus();
      list[i].click();
    }

    function field(name, label, type, attrs) {
      return (
        '<div class="form-group"><label for="za-' + name + '">' + esc(label) + '</label>' +
        '<input id="za-' + name + '" name="' + name + '" type="' + type + '" ' + (attrs || '') + ' autocomplete="' + auto(name) + '">' +
        '</div>'
      );
    }

    function auto(name) {
      if (name === 'email') return 'email';
      if (name === 'password' || name === 'confirm') return tab === 'login' ? 'current-password' : 'new-password';
      if (name === 'code') return 'one-time-code';
      if (name === 'name') return 'nickname';
      return 'off';
    }

    /** 找回密码表单底部那行退路文案：验证码收不到（邮件通道没配、邮箱写错）时让人知道还能找站长 */
    function forgotText() {
      var mail = (adminMail || '').trim();
      if (mail) return (T.forgotWithMail || '如密码遗失，可使用注册邮箱向管理员 {email} 发送邮件找回').replace('{email}', mail);
      return T.forgotNoMail || '请通过站内留言联系站长';
    }

    /**
     * 站长邮箱不在整站公开配置里了（那是给爬虫看的），改成访客真打开找回密码面板才取一次。
     * 取回来才重画表单，所以第一次渲染先显示「站内留言联系站长」这句兜底文案。
     */
    function ensureAdminMail() {
      if (adminMail !== null) return;
      window.ZeroStack.api('/api/config/admin-email')
        .then(function (d) {
          adminMail = String((d && d.data && d.data.email) || '');
          if (tab === 'reset') renderForm();
        })
        .catch(function () {
          adminMail = '';
        });
    }

    function renderForm() {
      clearMessages();
      btn.disabled = false;
      var html = field('email', T.labelEmail, 'email', 'required maxlength="200"');
      if (tab === 'login') {
        html += field('password', T.labelPassword, 'password', 'required maxlength="200"');
        if (needTotp) {
          html += field('code', T.labelTotp, 'text', 'required inputmode="numeric" maxlength="6"');
          html += '<p class="za-hint za-totp">' + esc(T.hintTotp || '本账号已开启两步验证，填身份验证器上当前的 6 位动态码。') + '</p>';
        }
        btn.textContent = T.btnLogin || '登 录';
      } else if (tab === 'reset') {
        html += field('code', T.labelCode || '邮箱验证码', 'text', 'required inputmode="numeric" maxlength="6"');
        html +=
          '<div class="form-group"><button type="button" class="btn-account" data-send-code>' +
          esc(T.btnSendCode || '发送验证码') +
          '</button><span class="za-hint" data-code-hint></span></div>';
        html += field('password', T.labelNewPassword || '新密码', 'password', 'required minlength="8" maxlength="200"');
        html += field('confirm', T.labelConfirm, 'password', 'required minlength="8" maxlength="200"');
        html += '<p class="za-hint">' + esc(forgotText()) + '</p>';
        ensureAdminMail();
        btn.textContent = T.btnReset || '重置密码';
      } else {
        html += field('name', T.labelName, 'text', 'maxlength="64"');
        html += field('password', T.labelPassword, 'password', 'required minlength="8" maxlength="200"');
        html += field('confirm', T.labelConfirm, 'password', 'required minlength="8" maxlength="200"');
        html += field('invite', T.labelInvite, 'text', (cfg.requireInviteCode ? 'required ' : '') + 'maxlength="64"');
        html += '<p class="za-hint">' + esc(cfg.requireInviteCode ? T.hintInvite : T.pwHint) + '</p>';
        btn.textContent = T.btnRegister || '注 册';
      }
      content.innerHTML = html;
    }

    /* ---------------- 提交 ---------------- */

    tabsEl.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]');
      if (!b || b.hidden) return;
      tab = b.dataset.tab;
      needTotp = false;
      syncTabs();
      renderForm();
    });
    tabsEl.addEventListener('keydown', tabKeydown);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      clearMessages();
      if (tab === 'login') return doLogin();
      if (tab === 'reset') return doReset();
      return doRegister();
    });

    function val(name) {
      var el = content.querySelector('[name="' + name + '"]');
      return el ? el.value.trim() : '';
    }

    function doLogin() {
      var email = val('email');
      var password = val('password');
      if (!email || !password) return say(errEl, T.fill || '请填写完整信息。');
      var body = { email: email, password: password };
      if (needTotp) {
        var code = val('code').replace(/\s/g, '');
        if (!/^\d{6}$/.test(code)) return say(errEl, T.codeBad || '请输入验证器上的 6 位动态码。');
        body.totp = code;
      }
      busy = true;
      window.ZeroStack.api('/api/auth/login', { method: 'POST', body: body })
        .then(function (d) {
          user = (d && d.user) || null;
          needTotp = false;
          if (user) leave(d || user);
          return null;
        })
        .catch(function (err) {
          // 第二因子：后端要身份验证器动态码时才补那一行输入框。
          // 邮箱验证码这一档只给后台管理员用（普通用户永远是邮箱 + 密码，策略管不到他们），
          // 站点这个表单没有那一步，遇到就直说去哪儿登录，别让人卡在「请输入邮箱收到的 6 位验证码」上。
          var next = err && err.body && err.body.next;
          var message = err.message || (T.network || '出错了');
          if (next === 'totp') needTotp = true;
          else if (next === 'email-code') message = T.adminEmailCodeOnly || message;
          paint2();
          say(errEl, message);
        })
        .then(function () {
          busy = false;
        });
    }

    /** 出错重画表单，但不重新请求接口 */
    function paint2() {
      syncTabs();
      renderForm();
    }

    function doRegister() {
      if (!registerAllowed()) return say(errEl, T.registerClosed || '站点当前关闭了注册');
      var email = val('email');
      var password = val('password');
      var confirmPassword = val('confirm');
      var invite = val('invite');
      if (!email || !password) return say(errEl, T.fill || '请填写完整信息。');
      if (cfg.requireInviteCode && !invite) return say(errEl, T.hintInvite || '本站需要邀请码才能注册。');
      if (password !== confirmPassword) return say(errEl, T.pwMatch || '两次输入的密码不一致。');
      if (password.length < 8) return say(errEl, T.pwShort || '密码长度至少 8 位。');

      var body = { email: email, password: password };
      var name = val('name');
      if (name) body.name = name;
      if (invite) body.invite = invite;

      busy = true;
      window.ZeroStack.api('/api/auth/register', { method: 'POST', body: body })
        .then(function (d) {
          // 注册成功即已登录，和登录走同一条分流；首个账号注册就是管理员，直接进后台
          leave(d || {});
          return null;
        })
        .catch(function (err) { say(errEl, err.message || (T.network || '出错了')); })
        .then(function () { busy = false; });
    }

    /* ---------------- 找回密码 ---------------- */

    /** 这一步的「发送验证码」：邮件通道没配好时后端直接回人话，不假装发出去了 */
    form.addEventListener('click', function (e) {
      var b = e.target.closest('[data-send-code]');
      if (!b || busy) return;
      var email = val('email');
      if (!email) return say(errEl, T.fill || '请填写完整信息。');
      clearMessages();
      busy = true;
      b.disabled = true;
      window.ZeroStack.api('/api/auth/send-code', { method: 'POST', body: { email: email, scene: 'reset' } })
        .then(function () {
          var hint = content.querySelector('[data-code-hint]');
          if (hint) hint.textContent = T.codeSent || '验证码已发出，10 分钟内有效；没收到的先去垃圾箱看一眼。';
          return null;
        })
        .catch(function (err) { say(errEl, err.message || (T.network || '网络出错了，请稍后再试。')); })
        .then(function () {
          busy = false;
          b.disabled = false;
        });
    });

    function doReset() {
      var email = val('email');
      var code = val('code').replace(/\s/g, '');
      var next = val('password');
      if (!email || !/^\d{6}$/.test(code) || !next) return say(errEl, T.fill || '请填写完整信息。');
      if (next.length < 8) return say(errEl, T.pwShort || '密码长度至少 8 位。');
      if (next !== val('confirm')) return say(errEl, T.pwMatch || '两次输入的密码不一致。');

      busy = true;
      window.ZeroStack.api('/api/auth/reset-password', { method: 'POST', body: { email: email, code: code, newPassword: next } })
        .then(function () {
          // 改完不该停在「找回密码」这一步：回到登录表单，让人直接用新密码进门
          tab = 'login';
          paint2();
          return say(okEl, T.resetDone || '密码已重置，请用新密码登录。');
        })
        .catch(function (err) { say(errEl, err.message || (T.network || '网络出错了，请稍后再试。')); })
        .then(function () {
          busy = false;
        });
    }

    /* ---------------- 小工具 ---------------- */

    function say(el, text) {
      if (!el) return;
      el.textContent = text || '';
      el.style.display = text ? 'block' : 'none';
      if (el === errEl && okEl && text) okEl.style.display = 'none';
      if (el === okEl && errEl && text) errEl.style.display = 'none';
    }

    function clearMessages() {
      if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
      if (okEl) { okEl.textContent = ''; okEl.style.display = 'none'; }
    }

    function readI18n() {
      var el = document.querySelector('.zero-account-i18n');
      if (!el) return {};
      try { return JSON.parse(el.textContent) || {}; } catch (e) { return {}; }
    }

    function esc(v) {
      return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
