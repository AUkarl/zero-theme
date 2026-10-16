// ============================================================
// account-me.js — 个人中心（/account/me/）控制器
//
// 左侧 tab + 右侧面板，数据全部走 window.ZeroStack.api()：
// 自动带 Cookie、把 {data} 解包、{error,message} 变成 Error。
// 账号定位靠 ?u=@<account_slug>（默认自己）。
//
// 面板：我的资料 / 我的评论 / 收藏与点赞 / 友链设置 / 我的投稿 /
//       作者认证 / 账号安全（邮箱验证·身份验证器·改密码）/ 账号注销
//
// 管理员不在此页停留：overview 里的账号角色是 admin 就只提示一句，然后跳
// 站点后台。后台地址来源与 account.js 一致，优先级从高到低：
//   1) account/me 模板注入的 cmsBaseURL（站点 params.cmsBaseURL）；
//   2) 模板按构建环境给出的 cmsURL；
//   3) 常量 CMS_ONLINE（与两个模板里的 $cmsFallback 成对，改一处要改两处）。
//
// 账号安全只有三块能力（后端保留但前端不再出现的入口一律不放）：
//   邮箱验证      POST /api/auth/send-code {email, scene:'login'} → POST /api/auth/verify-email {code}
//   身份验证器    POST /api/security/totp/setup|enable|disable
//   修改密码      POST /api/account/password {current, next, second:'totp', code}
// ============================================================
(function () {
  'use strict';

  var CMS_ONLINE = '/admin/';

  var PLATFORMS = ['GitHub', 'Twitter / X', '微博', '知乎', 'Bilibili', '小红书', 'Mastodon', '邮箱 / 其它'];

  function start() {
    var root = document.getElementById('zsMe');
    if (!root) return;

    var els = {
      side: root.querySelector('.zsme-side'),
      main: root.querySelector('.zsme-main'),
      tabs: document.getElementById('zsMeTabs'),
      pane: document.getElementById('zsMePane'),
      title: document.getElementById('zsMeTitle'),
      note: document.getElementById('zsMeNote'),
      msg: document.getElementById('zsMeMsg'),
      name: document.getElementById('zsMeName'),
      mail: document.getElementById('zsMeMail'),
      chips: document.getElementById('zsMeChips'),
      avatar: document.getElementById('zsMeAvatar'),
      logout: document.getElementById('zsMeLogout'),
      login: document.getElementById('zsMeLogin'),
    };

    if (root.getAttribute('data-api') !== '1' || !window.ZeroStack || !window.ZeroStack.enabled) {
      var noBackend = document.getElementById('zsMeNoBackend');
      if (noBackend) noBackend.hidden = false;
      if (els.pane) els.pane.innerHTML = '';
      guest();
      return;
    }

    var T = readI18n();
    var ov = null;
    /** /api/config 的内容：params 没填 cmsBaseURL 时，后台地址只能从这里拿 */
    var runtimeCfg = {};
    var tab = readTab();
    var kind = 'star';
    var status = 'all';
    var editingDraftId = '';

    boot();

    /* ---------------- 启动 ---------------- */

    function boot() {
      var cfgPromise = window.ZeroStack && window.ZeroStack.config ? window.ZeroStack.config() : Promise.resolve({});
      Promise.all([cfgPromise, api('/api/account/overview')])
        .then(function (res) {
          runtimeCfg = res[0] || {};
          ov = res[1] || {};
          if (!ov.account || !ov.account.id) throw new Error(T.needLogin || '请先登录');
          if (isAdmin(ov.account)) return paintAdmin();
          paintShell();
          showTab(tab);
          return null;
        })
        .catch(function (err) {
          if (err && (err.status === 401 || err.status === 403)) return guest(err.message);
          showTab(tab);
          msg(err && err.message ? err.message : T.net, true);
        });
    }

    function guest(text) {
      root.classList.add('zsme-guest');
      if (els.login) els.login.hidden = false;
      if (els.name) els.name.textContent = T.needLogin || '请先登录';
      if (text && els.note) els.note.textContent = text;
      if (els.pane) els.pane.innerHTML = '';
      if (els.tabs) els.tabs.innerHTML = '';
    }

    function readTab() {
      var m = /[?&]tab=([\w-]+)/.exec(location.search);
      return m ? m[1] : 'profile';
    }

    /* ---------------- 管理员：只提示一句，然后进站点后台 ---------------- */

    function isAdmin(a) {
      return Boolean(a) && (a.isAdmin === true || a.role === 'admin');
    }

    /** 站点后台入口：params.cmsBaseURL → 运行期后台自己记下的地址 → 模板按环境算好的地址 → 线上常量 */
    function cmsHref() {
      var fromParams = String(T.cmsBaseURL || '').trim();
      if (fromParams) return fromParams;
      var fromRuntime = String(runtimeCfg.cmsAdminUrl || '').trim();
      if (fromRuntime) return fromRuntime;
      var fromBuild = String(T.cmsURL || '').trim();
      return fromBuild || CMS_ONLINE;
    }

    /** 管理员没有自助面板：身份照旧、栏目清空，面板位置只放一行跳转说明 */
    function paintAdmin() {
      var a = ov.account || {};
      var text = T.adminEnter || '这个账号是站点管理员，请到站点后台管理；正在跳转…';
      paintIdentity(a);
      if (els.tabs) els.tabs.innerHTML = '';
      if (els.title) els.title.textContent = T.tabSecurity || '账号安全';
      if (els.note) els.note.textContent = '';
      if (els.pane) els.pane.innerHTML = '<p class="zsme-warn">' + esc(text) + '</p>';
      wireLogout();
      setTimeout(function () {
        window.location = cmsHref();
      }, 900);
    }

    /* ---------------- 外壳：身份卡 + tab ---------------- */

    /** 身份区顺序固定：昵称 → 注册邮箱 → @账号标识 → 用户组（后面才是状态 chip） */
    function paintIdentity(a) {
      if (els.name) els.name.textContent = a.name || a.email || (T.needLogin || '请先登录');
      if (els.mail) els.mail.textContent = a.email || '';
      if (els.avatar && a.avatar) {
        els.avatar.src = a.avatar;
        els.avatar.hidden = false;
      }
      var chips = [];
      chips.push(chip(a.accountSlug ? '@' + a.accountSlug : a.id, ''));
      chips.push(chip(groupText(a), a.isAdmin ? 'is-ok' : ''));
      if (a.authorVerified) chips.push(chip(T.verifiedBadge || '已认证作者', 'is-ok'));
      chips.push(chip(a.emailVerified ? (T.mailOk || '邮箱已验证') : (T.mailBad || '邮箱未验证'), a.emailVerified ? 'is-ok' : 'is-warn'));
      if (ov.security && ov.security.totpEnabled) chips.push(chip(T.totpOn || '已开启', 'is-ok'));
      if (els.chips) els.chips.innerHTML = chips.join('');
      if (els.logout) els.logout.hidden = false;
    }

    function paintShell() {
      var a = ov.account;
      paintIdentity(a);

      if (ov.deleteRequest && ov.deleteRequest.status === 'pending' && tab !== 'delete') tab = 'delete';
      if (!/^(profile|comments|reactions|friend|drafts|author|security|delete)$/.test(tab)) tab = 'profile';

      paintTabs();
      wireLogout();
    }

    function wireLogout() {
      if (!els.logout) return;
      els.logout.onclick = function () {
        api('/api/auth/logout', { method: 'POST', body: {} }).then(function () {
          location.href = '/account/';
        });
      };
    }

    /** 用户组的显示口径：管理员＝站长，其余按 user_group；一律「用户组：X」，不出现「读者」 */
    function groupText(a) {
      if (a.isAdmin || a.role === 'admin' || a.userGroup === 'owner') return T.groupAdmin || '用户组：站长';
      if (a.userGroup === 'coauthor') return T.groupCoauthor || '用户组：共创';
      return T.groupFriend || '用户组：朋友';
    }

    function tabs() {
      var c = ov.counts || {};
      var list = [
        ['profile', T.tabProfile || '我的资料', ''],
        ['comments', T.tabComments || '我的评论', c.comments],
        ['reactions', T.tabReactions || '收藏与点赞', (c.stars || 0) + (c.likes || 0)],
        ['friend', T.tabFriend || '友链设置', c.friendApplications],
        ['author', T.tabAuthor || '作者认证', c.authorRequests],
        ['security', T.tabSecurity || '账号安全', ''],
        ['delete', T.tabDelete || '账号注销', ''],
      ];
      if (ov.gates && ov.gates.draftsEnabled && (ov.gates.canPublish || ov.account.isAdmin)) {
        list.splice(5, 0, ['drafts', T.tabDrafts || '我的投稿', c.drafts]);
      }
      return list;
    }

    function paintTabs() {
      if (!els.tabs) return;
      els.tabs.innerHTML = tabs()
        .map(function (t) {
          return (
            '<button type="button" class="zsme-tab' + (t[0] === tab ? ' is-active' : '') + '" data-tab="' + t[0] + '">' +
            esc(t[1]) + (t[2] || t[2] === 0 ? '<small>' + t[2] + '</small>' : '') +
            '</button>'
          );
        })
        .join('');
      els.tabs.onclick = function (e) {
        var b = e.target.closest('button[data-tab]');
        if (b) showTab(b.getAttribute('data-tab'));
      };
    }

    function showTab(next) {
      tab = next || tab;
      var found = null;
      tabs().forEach(function (t) {
        if (t[0] === tab) found = t;
      });
      if (!found) tab = 'profile';
      paintTabs();
      if (els.title) els.title.textContent = (found || tabs()[0])[1];
      if (els.note) els.note.textContent = noteFor(tab);
      try {
        history.replaceState(null, '', centerWith(tab));
      } catch (err) {
        /* file:// 或隐私模式下 replaceState 会抛，不影响使用 */
      }
      els.pane.onclick = null;
      els.pane.onsubmit = null;
      els.pane.innerHTML = '<p class="zsme-loading">' + esc(T.loading || '正在加载…') + '</p>';
      var render = PANELS[tab];
      if (!render) return;
      Promise.resolve()
        .then(render)
        .catch(function (err) {
          els.pane.innerHTML = '<p class="zsme-warn">' + esc(err && err.message ? err.message : T.net) + '</p>';
        });
    }

    function noteFor(key) {
      var map = {
        profile: T.noteProfile,
        comments: T.noteComments,
        reactions: T.noteReactions,
        friend: T.noteFriend,
        drafts: T.noteDrafts,
        author: T.noteAuthor,
        security: T.noteSecurity,
        delete: T.noteDelete,
      };
      return map[key] || '';
    }

    function centerWith(next) {
      var slug = ov && ov.account && ov.account.accountSlug;
      var base = slug ? '/account/me/?u=@' + encodeURIComponent(slug) : '/account/me/';
      return base + '&tab=' + encodeURIComponent(next);
    }

    /* ---------------- 面板 ---------------- */

    var PANELS = {
      profile: panelProfile,
      comments: panelComments,
      reactions: panelReactions,
      friend: panelFriend,
      drafts: panelDrafts,
      author: panelAuthor,
      security: panelSecurity,
      delete: panelDelete,
    };

    /* ------ 我的资料 ------ */

    function panelProfile() {
      var a = ov.account;
      els.pane.innerHTML =
        '<div class="zsme-card"><form id="zsMeProfile">' +
        '<div class="zsme-fields">' +
        field('name', T.labelName, 'text', 'maxlength="64"', a.name) +
        field('image', T.labelImage, 'text', 'maxlength="300" placeholder="https://（留空按邮箱取头像）"', a.image) +
        field('website', T.labelWebsite, 'text', 'maxlength="300" placeholder="https://"', a.website) +
        field('slug', T.labelSlug, 'text', 'readonly', a.accountSlug ? '@' + a.accountSlug : '') +
        '<label class="zsme-field full"><span>' + esc(T.labelBio) + '</span><textarea name="bio" rows="3" maxlength="300">' + esc(a.bio || '') + '</textarea></label>' +
        '</div>' +
        '<p class="zsme-acts"><button type="submit" class="zsme-btn primary">' + esc(T.btnSave) + '</button>' +
        '<span class="zsme-meta">' + esc(T.labelEmail) + ' ' + esc(a.email) + ' · 注册于 ' + esc(fmt(a.createdAt)) + (a.handle ? ' · ' + esc(T.aHandle) + ' ' + esc(a.handle) : '') + '</span></p>' +
        '</form></div>';

      els.pane.querySelector('#zsMeProfile').onsubmit = function (e) {
        e.preventDefault();
        var body = {
          name: val(this, 'name'),
          bio: val(this, 'bio'),
          website: val(this, 'website'),
          image: val(this, 'image'),
        };
        if (!body.name) return msg(T.fill, true);
        if (body.website && !isUrl(body.website)) return msg(T.siteBad, true);
        if (body.image && !isUrl(body.image)) return msg(T.siteBad, true);
        guard(api('/api/user/profile', { method: 'PATCH', body: body }), T.saved, function () {
          ov.account.name = body.name;
          ov.account.bio = body.bio;
          ov.account.website = body.website;
          ov.account.image = body.image;
          paintShell();
        });
      };
    }

    /* ------ 我的评论 ------ */

    function panelComments() {
      els.pane.innerHTML =
        '<div class="zsme-card">' +
        '<p class="zsme-row" id="zsMeCf"></p>' +
        '<div id="zsMeCList"><p class="zsme-loading">' + esc(T.loading) + '</p></div>' +
        '</div>';
      var filters = [
        ['all', '全部'],
        ['approved', T.stApproved],
        ['pending', T.stPending],
        ['spam', T.stSpam],
        ['rejected', T.stRejected],
      ];
      els.pane.querySelector('#zsMeCf').innerHTML = filters
        .map(function (f) {
          return '<button type="button" class="zsme-btn sm' + (status === f[0] ? ' primary' : '') + '" data-st="' + f[0] + '">' + esc(f[1] || f[0]) + '</button>';
        })
        .join('');
      els.pane.querySelector('#zsMeCf').onclick = function (e) {
        var b = e.target.closest('button[data-st]');
        if (!b) return;
        status = b.getAttribute('data-st');
        showTab('comments');
      };
      return loadComments();
    }

    function loadComments() {
      return api('/api/account/comments?status=' + encodeURIComponent(status)).then(function (d) {
        var host = els.pane.querySelector('#zsMeCList');
        if (!host) return;
        var items = (d && d.items) || [];
        if (!items.length) {
          host.innerHTML = '<p class="zsme-empty">' + esc(T.noComments || T.empty) + '</p>';
          return;
        }
        host.innerHTML =
          '<p class="zsme-count">共 ' + items.length + ' 条</p><ul class="zsme-list">' +
          items
            .map(function (m) {
              return (
                '<li data-id="' + esc(m.id) + '">' +
                '<div class="zsme-line">' + statusChip(m.status) +
                '<a href="' + esc(m.postSlug) + '">' + esc(m.postSlug) + '</a>' +
                (m.editedAt ? '<span class="zsme-chip">' + esc(T.edited || '已编辑') + '</span>' : '') +
                '<span class="zsme-time">' + esc(fmt(m.createdAt)) + '</span></div>' +
                '<p class="zsme-text">' + esc(m.content) + '</p>' +
                (m.status !== 'approved' && m.spamReason ? '<p class="zsme-hint">' + esc(m.spamReason) + '</p>' : '') +
                '<div class="zsme-acts">' +
                '<button type="button" class="zsme-btn sm" data-act="edit">' + esc(T.btnEdit) + '</button>' +
                '<button type="button" class="zsme-btn sm is-danger" data-act="del">' + esc(T.btnDelete) + '</button>' +
                '</div><div class="zsme-editbox" hidden></div></li>'
              );
            })
            .join('') +
          '</ul>';

        /* 只有一个点击入口：编辑框的保存/取消不再挂第二层 onclick，
           免得外层把它当成「再点一次编辑」，当场把输入框收起清空。 */
        host.onclick = function (e) {
          var b = e.target.closest('button[data-act]');
          if (!b) return;
          var li = b.closest('li');
          if (!li) return;
          var id = li.getAttribute('data-id');
          var act = b.getAttribute('data-act');
          var box = li.querySelector('.zsme-editbox');

          if (act === 'del') {
            if (!confirm(T.delCommentConfirm || '删除这条评论？它下面的回复会一并删除。')) return;
            b.disabled = true;
            api('/api/account/comments/' + encodeURIComponent(id), { method: 'DELETE' }).then(
              function (res) {
                msg(res && res.deletedCount > 1 ? '已删除（含 ' + res.deletedCount + ' 条回复）。' : '已删除。', false);
                showTab('comments');
              },
              function (err) {
                b.disabled = false;
                msg(err.message, true);
              }
            );
            return;
          }
          if (act === 'cancel') {
            closeEdit(box);
            return;
          }
          if (act === 'edit') {
            if (box && !box.hidden) {
              closeEdit(box);
              return;
            }
            openCommentEdit(li, box, pick(items, id));
            return;
          }
          if (act === 'save') {
            var area = box && box.querySelector('textarea');
            var text = area ? area.value.trim() : '';
            if (!text) return msg(T.fill, true);
            b.disabled = true;
            api('/api/account/comments/' + encodeURIComponent(id), { method: 'PATCH', body: { content: text } }).then(
              function () {
                msg(T.editOk || T.saved, false);
                showTab('comments');
              },
              function (err) {
                b.disabled = false;
                msg(err.message, true);
              }
            );
          }
        };
      });
    }

    function pick(items, id) {
      for (var i = 0; i < items.length; i++) {
        if (String(items[i].id) === String(id)) return items[i];
      }
      return {};
    }

    function openCommentEdit(li, box, row) {
      if (!box) return;
      box.hidden = false;
      box.innerHTML =
        '<textarea rows="4" maxlength="5000"></textarea><div class="zsme-acts">' +
        '<button type="button" class="zsme-btn sm primary" data-act="save">' + esc(T.btnOk || '保存') + '</button>' +
        '<button type="button" class="zsme-btn sm" data-act="cancel">' + esc(T.btnCancel || '取消') + '</button></div>';
      var area = box.querySelector('textarea');
      area.value = row && row.content != null ? row.content : (li.querySelector('.zsme-text') || {}).textContent || '';
      area.focus();
      area.setSelectionRange(area.value.length, area.value.length);
    }

    function closeEdit(box) {
      if (!box) return;
      box.hidden = true;
      box.innerHTML = '';
    }

    /* ------ 收藏与点赞 ------ */

    function panelReactions() {
      els.pane.innerHTML =
        '<div class="zsme-card">' +
        '<p class="zsme-row">' +
        '<button type="button" class="zsme-btn sm' + (kind === 'star' ? ' primary' : '') + '" data-kind="star">' + esc(T.kindStar || '收藏') + '</button>' +
        '<button type="button" class="zsme-btn sm' + (kind === 'like' ? ' primary' : '') + '" data-kind="like">' + esc(T.kindLike || '点赞') + '</button>' +
        '</p><div id="zsMeRList"><p class="zsme-loading">' + esc(T.loading) + '</p></div></div>';
      els.pane.querySelector('.zsme-row').onclick = function (e) {
        var b = e.target.closest('button[data-kind]');
        if (!b) return;
        kind = b.getAttribute('data-kind');
        showTab('reactions');
      };
      return api('/api/account/reactions?kind=' + kind).then(function (d) {
        var host = els.pane.querySelector('#zsMeRList');
        var items = (d && d.items) || [];
        if (!items.length) {
          host.innerHTML = '<p class="zsme-empty">' + esc(kind === 'star' ? T.noStars : T.noReactions) + '</p>';
          return;
        }
        host.innerHTML =
          '<p class="zsme-count">共 ' + items.length + ' 条</p><ul class="zsme-list">' +
          items
            .map(function (r) {
              return (
                '<li><div class="zsme-line"><a href="' + esc(r.slug) + '">' + esc(r.title || r.slug) + '</a>' +
                (r.title ? '' : '<span class="zsme-chip is-warn">' + esc(T.notArchived || '未同步标题') + '</span>') +
                '<span class="zsme-chip">' + esc(r.kind === 'star' ? T.kindStar : T.kindLike) + '</span>' +
                '<span class="zsme-time">' + esc(fmt(r.createdAt)) + '</span>' +
                '<button type="button" class="zsme-btn sm" data-id="' + esc(r.id) + '">' + esc(T.btnWithdraw || '撤回') + '</button></div></li>'
              );
            })
            .join('') +
          '</ul>';
        host.onclick = function (e) {
          var b = e.target.closest('button[data-id]');
          if (!b) return;
          api('/api/account/reactions/' + b.getAttribute('data-id') + '/withdraw', { method: 'POST', body: {} }).then(
            function () {
              msg('已撤回。', false);
              showTab('reactions');
            },
            function (err) { msg(err.message, true); }
          );
        };
      });
    }

    /* ------ 友链设置 ------ */

    function friendForm(row) {
      row = row || {};
      return (
        '<div class="zsme-fields">' +
        field('name', T.fName, 'text', 'maxlength="60"', row.name) +
        field('url', T.fUrl, 'text', 'maxlength="300" placeholder="https://"', row.url) +
        field('email', T.fEmail, 'email', 'maxlength="120"', row.email) +
        field('rssUrl', T.fRss, 'text', 'maxlength="300" placeholder="https://"', row.rssUrl) +
        field('avatar', T.fAvatar, 'text', 'maxlength="300" placeholder="https://"', row.avatar) +
        field('description', T.fDesc, 'text', 'maxlength="200"', row.description) +
        '<label class="zsme-field full"><span>' + esc(T.fReason) + '</span><textarea name="reason" rows="2" maxlength="500">' + esc(row.reason || '') + '</textarea></label>' +
        '</div>'
      );
    }

    function collectFriend(scope) {
      var body = {};
      ['name', 'url', 'email', 'rssUrl', 'avatar', 'description', 'reason'].forEach(function (k) {
        var el = scope.querySelector('[name="' + k + '"]');
        if (el) body[k] = el.value.trim();
      });
      return body;
    }

    function panelFriend() {
      return api('/api/account/friend-application').then(function (d) {
        var items = (d && d.items) || [];
        els.pane.innerHTML =
          '<div class="zsme-card"><h3>' + esc(T.fNew || '新建申请') + '</h3><form id="zsMeFriend">' +
          friendForm(null) +
          '<p class="zsme-acts"><button type="submit" class="zsme-btn primary">' + esc(T.fSubmit) + '</button></p></form></div>' +
          '<div class="zsme-card" id="zsMeFList">' +
          (items.length
            ? '<ul class="zsme-list">' +
              items
                .map(function (r) {
                  return (
                    '<li data-id="' + esc(r.id) + '"><div class="zsme-line">' + statusChip(r.status) +
                    '<a href="' + esc(r.url) + '" target="_blank" rel="noreferrer">' + esc(r.name) + '</a>' +
                    '<span class="zsme-time">' + esc(fmt(r.createdAt)) + '</span></div>' +
                    (r.reviewNote ? '<p class="zsme-hint">' + esc(T.fNote) + '：' + esc(r.reviewNote) + '</p>' : '') +
                    '<div class="zsme-acts">' +
                    (r.status === 'pending' ? '' : '<button type="button" class="zsme-btn sm" data-act="edit">' + esc(T.btnEdit) + '</button>') +
                    (r.status === 'approved' ? '' : '<button type="button" class="zsme-btn sm is-danger" data-act="del">' + esc(T.btnWithdraw) + '</button>') +
                    '</div><div class="zsme-editbox" hidden></div></li>'
                  );
                })
                .join('') +
              '</ul>'
            : '<p class="zsme-empty">' + esc(T.noFriends) + '</p>') +
          '</div>';

        els.pane.querySelector('#zsMeFriend').onsubmit = function (e) {
          e.preventDefault();
          var body = collectFriend(this);
          if (!body.name || !body.url) return msg(T.fill, true);
          guard(api('/api/account/friend-application', { method: 'POST', body: body }), T.fOk, function () {
            showTab('friend');
          });
        };

        els.pane.querySelector('#zsMeFList').onclick = function (e) {
          var b = e.target.closest('button[data-act]');
          if (!b) return;
          var li = b.closest('li');
          if (!li) return;
          var id = li.getAttribute('data-id');
          var act = b.getAttribute('data-act');
          var box = li.querySelector('.zsme-editbox');

          if (act === 'del') {
            if (!confirm(T.fWithdrawConfirm || '撤回这条友链申请？')) return;
            b.disabled = true;
            api('/api/account/friend-application/' + encodeURIComponent(id), { method: 'DELETE' }).then(
              function () {
                msg('已撤回这条友链申请。', false);
                showTab('friend');
              },
              function (err) {
                b.disabled = false;
                msg(err.message, true);
              }
            );
            return;
          }
          if (act === 'cancel') {
            closeEdit(box);
            return;
          }
          if (act === 'edit') {
            if (!box || !box.hidden) {
              closeEdit(box);
              return;
            }
            box.hidden = false;
            box.innerHTML = friendForm(pick(items, id)) +
              '<div class="zsme-acts"><button type="button" class="zsme-btn sm primary" data-act="save">' + esc(T.btnOk) + '</button>' +
              '<button type="button" class="zsme-btn sm" data-act="cancel">' + esc(T.btnCancel) + '</button></div>';
            var first = box.querySelector('input');
            if (first) first.focus();
            return;
          }
          if (act === 'save') {
            var body = collectFriend(box);
            if (!body.name || !body.url) return msg(T.fill, true);
            b.disabled = true;
            api('/api/account/friend-application/' + encodeURIComponent(id), { method: 'PATCH', body: body }).then(
              function () {
                msg(T.fOk || T.saved, false);
                showTab('friend');
              },
              function (err) {
                b.disabled = false;
                msg(err.message, true);
              }
            );
          }
        };
      });
    }

    /* ------ 我的投稿（复用 cms 编辑器交互：工具条 + Markdown 文本域） ------ */

    function draftEditor(row) {
      row = row || {};
      var tags = (row.tags || []).join(', ');
      return (
        '<div class="zsme-fields">' +
        field('title', T.dTitle, 'text', 'maxlength="120"', row.title) +
        field('slug', T.dSlug, 'text', 'maxlength="80"', row.slug) +
        field('category', T.dCategory, 'text', 'maxlength="60"', row.category) +
        field('tags', T.dTags, 'text', 'maxlength="400"', tags) +
        field('summary', T.dSummary, 'text', 'maxlength="300"', row.summary) +
        field('cover', T.dCover, 'text', 'maxlength="300" placeholder="https://"', row.cover) +
        '</div>' +
        '<div class="zsme-tools">' +
        tool('md-b', 'B', '加粗', '**', '**') + tool('md-i', 'I', '斜体', '*', '*') + tool('md-code', '代码', '行内代码', '`', '`') +
        tool('md-h2', 'H2', '标题', '## ', '') + tool('md-quote', '引用', '引用', '> ', '') + tool('md-li', '列表', '列表项', '- ', '') +
        tool('md-link', '链接', '链接文字', '[', '](https://)') + tool('md-img', '图片', '图片说明', '![', '](https://)') +
        '<span class="zsme-meta" data-role="words"></span></div>' +
        '<label class="zsme-body"><span>' + esc(T.dBody) + '</span>' +
        '<textarea data-d="content" rows="14">' + esc(row.content || '') + '</textarea></label>' +
        '<p class="zsme-acts"><button type="button" class="zsme-btn" data-d-act="draft">' + esc(T.dSaveDraft) + '</button>' +
        '<button type="button" class="zsme-btn primary" data-d-act="submit">' + esc(T.dSubmit) + '</button>' +
        '<button type="button" class="zsme-btn" data-d-act="close">' + esc(T.btnCancel) + '</button></p>'
      );

      function tool(key, label, title, before, after) {
        return '<button type="button" class="zsme-tool" data-tool="' + key + '" data-before="' + esc(before) + '" data-after="' + esc(after) + '" title="' + esc(title) + '">' + esc(label) + '</button>';
      }
    }

    function collectDraft(scope) {
      var body = {};
      ['title', 'slug', 'category', 'summary', 'cover', 'content'].forEach(function (k) {
        var el = scope.querySelector('[data-d="' + k + '"]');
        if (el) body[k] = el.value.trim();
      });
      var tags = scope.querySelector('[data-d="tags"]');
      body.tags = tags && tags.value.trim() ? tags.value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean) : [];
      return body;
    }

    function bindEditor(scope) {
      var area = scope.querySelector('[data-d="content"]');
      var words = scope.querySelector('[data-role="words"]');
      var tick = function () {
        if (words) words.textContent = (T.dWords || '字数') + ' ' + (area.value ? area.value.trim().length : 0);
      };
      area.addEventListener('input', tick);
      tick();

      scope.addEventListener('click', function (e) {
        var b = e.target.closest('.zsme-tool');
        if (!b) return;
        var before = b.getAttribute('data-before') || '';
        var after = b.getAttribute('data-after') || '';
        var start = area.selectionStart;
        var end = area.selectionEnd;
        var sel = area.value.slice(start, end) || '文字';
        area.value = area.value.slice(0, start) + before + sel + after + area.value.slice(end);
        area.focus();
        area.setSelectionRange(start + before.length, start + before.length + sel.length);
        tick();
      });
    }

    function panelDrafts() {
      return api('/api/account/drafts').then(function (d) {
        var items = (d && d.items) || [];
        els.pane.innerHTML =
          '<div class="zsme-card"><h3><button type="button" class="zsme-btn sm primary" id="zsMeNewDraft">' + esc(T.dNew) + '</button></h3>' +
          '<div id="zsMeDraftEdit" hidden></div></div>' +
          '<div class="zsme-card" id="zsMeDList">' +
          (items.length
            ? '<ul class="zsme-list">' +
              items
                .map(function (r) {
                  var editable = r.status === 'draft' || r.status === 'rejected';
                  return (
                    '<li data-id="' + esc(r.id) + '"><div class="zsme-line">' + statusChip(r.status) +
                    '<b>' + esc(r.title) + '</b><span class="zsme-chip">' + esc(r.slug) + '</span>' +
                    '<span class="zsme-time">' + esc(fmt(r.updatedAt)) + '</span></div>' +
                    (r.reviewNote ? '<p class="zsme-hint">' + esc(T.dNote) + '：' + esc(r.reviewNote) + '</p>' : '') +
                    (r.publishedPath ? '<p class="zsme-hint">' + esc(T.dPath) + '：' + esc(r.publishedPath) + '</p>' : '') +
                    '<div class="zsme-acts">' +
                    (editable ? '<button type="button" class="zsme-btn sm" data-act="edit">' + esc(T.dEdit || T.btnEdit) + '</button>' : '') +
                    (r.status === 'draft' ? '<button type="button" class="zsme-btn sm primary" data-act="submit">' + esc(T.dSubmit) + '</button>' : '') +
                    (r.status === 'pending' || r.status === 'approved' ? '<button type="button" class="zsme-btn sm" data-act="withdraw">' + esc(T.dWithdraw) + '</button>' : '') +
                    (editable ? '<button type="button" class="zsme-btn sm is-danger" data-act="del">' + esc(T.btnDelete) + '</button>' : '') +
                    '</div></li>'
                  );
                })
                .join('') +
              '</ul>'
            : '<p class="zsme-empty">' + esc(T.noDrafts) + '</p>') +
          '</div>';

        var editorHost = els.pane.querySelector('#zsMeDraftEdit');
        var newBtn = els.pane.querySelector('#zsMeNewDraft');
        newBtn.onclick = function () {
          editingDraftId = '';
          openEditor(editorHost, null);
        };

        els.pane.querySelector('#zsMeDList').onclick = function (e) {
          var b = e.target.closest('button[data-act]');
          if (!b) return;
          var li = b.closest('li');
          if (!li) return;
          var id = li.getAttribute('data-id');
          var act = b.getAttribute('data-act');
          var row = pick(items, id);

          if (act === 'del') {
            if (!confirm(T.dDelConfirm || '删除这篇投稿？')) return;
            b.disabled = true;
            api('/api/account/drafts/' + encodeURIComponent(id), { method: 'DELETE' }).then(
              function () {
                msg('已删除这篇投稿。', false);
                showTab('drafts');
              },
              function (err) {
                b.disabled = false;
                msg(err.message, true);
              }
            );
            return;
          }
          if (act === 'submit') {
            b.disabled = true;
            api('/api/account/drafts/' + encodeURIComponent(id) + '/submit', { method: 'POST', body: {} }).then(
              function (res) {
                msg(res && res.message ? res.message : T.fOk, false);
                showTab('drafts');
              },
              function (err) {
                b.disabled = false;
                msg(err.message, true);
              }
            );
            return;
          }
          if (act === 'withdraw') {
            var reason = window.prompt(T.dWithdrawAsk || '撤回原因（可留空）', '') || '';
            b.disabled = true;
            api('/api/account/drafts/' + encodeURIComponent(id) + '/withdraw-request', { method: 'POST', body: { reason: reason } }).then(
              function (res) { msg(res && res.message ? res.message : '已提交撤回申请', false); showTab('drafts'); },
              function (err) {
                b.disabled = false;
                msg(err.message, true);
              }
            );
            return;
          }
          if (act === 'edit') {
            editingDraftId = id;
            openEditor(editorHost, row, true);
            return;
          }
        };

        function openEditor(host, row, needFetch) {
          host.hidden = false;
          host.innerHTML = '<p class="zsme-loading">' + esc(T.loading) + '</p>';
          var fill = function (data) {
            host.innerHTML = draftEditor(data);
            bindEditor(host);
            host.querySelectorAll('[data-d-act]').forEach(function (btn) {
              btn.onclick = function () {
                var act = btn.getAttribute('data-d-act');
                if (act === 'close') {
                  host.hidden = true;
                  host.innerHTML = '';
                  return;
                }
                var body = collectDraft(host);
                if (!body.title || !body.content) return msg(T.fill, true);
                btn.disabled = true;
                var wantSubmit = act === 'submit';
                var savedId = editingDraftId;
                var req = savedId
                  ? api('/api/account/drafts/' + encodeURIComponent(savedId), { method: 'PATCH', body: body })
                  : api('/api/account/drafts', { method: 'POST', body: body });
                req
                  .then(function (res) {
                    if (!wantSubmit) return res;
                    if (res && res.status === 'pending') return res;
                    savedId = savedId || (res && res.id);
                    if (!savedId) return res;
                    return api('/api/account/drafts/' + encodeURIComponent(savedId) + '/submit', { method: 'POST', body: {} });
                  })
                  .then(
                    function (res) {
                      editingDraftId = '';
                      host.hidden = true;
                      host.innerHTML = '';
                      msg((res && res.message) || (wantSubmit ? '已提交，等待站主审核。' : '草稿已保存。'), false);
                      showTab('drafts');
                    },
                    function (err) {
                      btn.disabled = false;
                      msg(err.message, true);
                    }
                  );
              };
            });
          };
          if (needFetch && row && !row.content) {
            api('/api/account/drafts/' + row.id).then(fill, function (err) {
              host.innerHTML = '<p class="zsme-warn">' + esc(err.message) + '</p>';
            });
            return;
          }
          fill(row || {});
        }
      });
    }

    /* ------ 作者认证 ------ */

    function socialRow(item) {
      item = item || {};
      return (
        '<div class="zsme-dynrow" data-social>' +
        '<select data-k="platform">' +
        PLATFORMS.map(function (p) {
          return '<option value="' + esc(p) + '"' + (item.platform === p ? ' selected' : '') + '>' + esc(p) + '</option>';
        }).join('') +
        '</select>' +
        '<input data-k="handle" maxlength="120" placeholder="账号 / 昵称" value="' + esc(item.handle || '') + '">' +
        '<input data-k="proof" maxlength="300" placeholder="可核验链接 https://" value="' + esc(item.proof || '') + '">' +
        '<button type="button" class="zsme-btn sm is-danger" data-remove>删除</button>' +
        '</div>'
      );
    }

    function panelAuthor() {
      return api('/api/account/author-request').then(function (d) {
        d = d || {};
        var head =
          '<p class="zsme-count">' +
          esc(d.verified ? T.aVerified : d.pending ? T.aPending : T.aNone) +
          (d.handle ? ' · ' + esc(T.aHandle) + ' ' + esc(d.handle) : '') +
          '</p>';
        var history = (d.history || []).length
          ? '<ul class="zsme-list">' +
            d.history
              .map(function (h) {
                return (
                  '<li><div class="zsme-line">' + statusChip(h.status) + '<b>' + esc(h.penName) + '</b>' +
                  '<span class="zsme-time">' + esc(fmt(h.createdAt)) + '</span></div>' +
                  (h.adminNote ? '<p class="zsme-hint">' + esc(h.adminNote) + '</p>' : '') + '</li>'
                );
              })
              .join('') +
            '</ul>'
          : '';

        if (d.verified || d.pending || !d.canApply) {
          var lockText = d.blocked || T.aLocked;
          els.pane.innerHTML = '<div class="zsme-card">' + head + history + (d.canApply ? '' : '<p class="zsme-warn">' + esc(lockText) + '</p>') + '</div>';
          return;
        }

        var latest = d.latest || {};
        els.pane.innerHTML =
          '<div class="zsme-card"><h3>' + esc(T.aSubmit) + '</h3>' + head + history +
          '<div class="zsme-fields">' +
          field('penName', T.aPen, 'text', 'maxlength="64"', latest.penName) +
          field('avatar', T.aAvatar, 'text', 'maxlength="300" placeholder="https://（留空按邮箱取）"', latest.avatar) +
          field('website', T.aSite, 'text', 'maxlength="300" placeholder="https://"', latest.website) +
          '<label class="zsme-field full"><span>' + esc(T.aBio) + '</span><textarea data-a="bio" rows="3" maxlength="300">' + esc(latest.bio || '') + '</textarea></label>' +
          '</div>' +
          '<p class="zsme-body"><span>' + esc(T.aSocial) + '</span></p>' +
          '<div class="zsme-dyn" id="zsMeSocial">' +
          ((latest.social && latest.social.length ? latest.social : [{}]).map(socialRow).join('')) +
          '</div>' +
          '<p class="zsme-acts"><button type="button" class="zsme-btn sm" id="zsMeAddSocial">+ 平台</button></p>' +
          '<p class="zsme-body"><span>' + esc(T.aDonate) + '</span></p>' +
          '<div class="zsme-dyn" id="zsMeDonate">' +
          [0, 1, 2].map(function (i) {
            var imgs = latest.donateImages || [];
            return '<div class="zsme-dynrow" data-donate><input data-k="img" maxlength="300" placeholder="第 ' + (i + 1) + ' 张赞赏图 https://" value="' + esc(imgs[i] || '') + '"></div>';
          }).join('') +
          '</div>' +
          '<label class="zsme-body"><span>' + esc(T.aReason) + '</span><textarea data-a="reason" rows="3" maxlength="500">' + esc(latest.reason || '') + '</textarea></label>' +
          '<p class="zsme-acts"><button type="button" class="zsme-btn primary" id="zsMeAuthorSubmit">' + esc(T.aSubmit) + '</button></p>' +
          '</div>';

        var socialHost = els.pane.querySelector('#zsMeSocial');
        socialHost.onclick = function (e) {
          var b = e.target.closest('button[data-remove]');
          if (!b) return;
          b.closest('[data-social]').remove();
        };
        els.pane.querySelector('#zsMeAddSocial').onclick = function () {
          if (socialHost.querySelectorAll('[data-social]').length >= 8) return msg(T.aSocialMax || '最多 8 个平台', true);
          socialHost.insertAdjacentHTML('beforeend', socialRow({}));
        };

        els.pane.querySelector('#zsMeAuthorSubmit').onclick = function () {
          var self = this;
          var body = {
            penName: valOf(els.pane, 'penName'),
            bio: valOf(els.pane, 'bio'),
            avatar: valOf(els.pane, 'avatar'),
            website: valOf(els.pane, 'website'),
            reason: valOf(els.pane, 'reason'),
            social: [].map.call(socialHost.querySelectorAll('[data-social]'), function (row) {
              return {
                platform: row.querySelector('[data-k="platform"]').value,
                handle: row.querySelector('[data-k="handle"]').value.trim(),
                proof: row.querySelector('[data-k="proof"]').value.trim(),
              };
            }).filter(function (s) { return s.handle; }),
            donateImages: [].map.call(els.pane.querySelectorAll('#zsMeDonate [data-k="img"]'), function (i) { return i.value.trim(); }).filter(Boolean).slice(0, 3),
          };
          if (!body.penName) return msg(T.fill, true);
          if (body.website && !isUrl(body.website)) return msg(T.siteBad, true);
          if (body.avatar && !isUrl(body.avatar)) return msg(T.siteBad, true);
          self.disabled = true;
          api('/api/account/author-request', { method: 'POST', body: body }).then(
            function () {
              msg(T.aOk, false);
              showTab('author');
            },
            function (err) {
              self.disabled = false;
              msg(err.message, true);
            }
          );
        };
      });
    }

    /* ------ 账号安全：只有邮箱验证 / 身份验证器 / 改密码三块 ------ */

    function panelSecurity() {
      return api('/api/security').then(function (sec) {
        sec = sec || {};
        var a = ov.account || {};
        var email = sec.email || a.email || '';
        var verified = sec.emailVerified === undefined ? Boolean(a.emailVerified) : Boolean(sec.emailVerified);
        var totpOn = Boolean(sec.totpEnabled);
        var atLogin = sec.totpAtLogin !== false;

        els.pane.innerHTML =
          '<div class="zsme-card"><h3>' + esc(T.secMail || '邮箱验证') + '</h3>' + mailSec(verified, email) + '</div>' +

          '<div class="zsme-card zsme-sec"><h3>' + esc(T.secTotp || '两步验证（身份验证器 TOTP）') + '</h3>' +
          (totpOn ? '' : '<p class="zsme-hint">' + esc(T.secTotpOff || '验证器未开启。生成密钥后用身份验证器扫码，再填当前 6 位码启用。') + '</p>') +
          (sec.notice ? '<p class="zsme-warn">' + esc(sec.notice) + '</p>' : '') +
          (totpOn ? totpOnForm(atLogin) : totpSetupForm()) +
          '<div id="zsMeTotpBox" class="zsme-sec"></div></div>' +

          '<div class="zsme-card zsme-sec"><h3>' + esc(T.secPassword || '修改密码') + '</h3>' + pwForm(totpOn) + '</div>';

        bindMailSec(verified, email);
        bindTotpSec(totpOn, atLogin);
        bindPwSec(totpOn);
      });
    }

    /* ① 邮箱验证 */

    function mailSec(verified, email) {
      if (verified) {
        return '<p class="zsme-hint">' +
          esc(fill(T.secMailVerified || '注册邮箱 {email} 已验证，无需再操作。', { email: email })) + '</p>';
      }
      return '<p class="zsme-hint">' +
        esc(fill(T.secMailUnverified || '注册邮箱 {email} 还没验证。点下面按钮发验证邮件，收到 6 位码后填回来即可。', { email: email })) +
        '</p><div id="zsMeMailBox"><p class="zsme-acts">' +
        '<button type="button" class="zsme-btn primary" id="zsMeMailSend">' + esc(T.secMailSend || '发送验证邮件') + '</button>' +
        '</p></div>';
    }

    function bindMailSec(verified, email) {
      if (verified) return;
      var send = els.pane.querySelector('#zsMeMailSend');
      if (!send) return;
      send.onclick = function () {
        send.disabled = true;
        /* scene 用 'login'：后端把「登录邮箱的验证码」这一条也用作已登录时的邮箱验证 */
        api('/api/auth/send-code', { method: 'POST', body: { email: email, scene: 'login' } }).then(
          function () {
            msg(fill(T.secMailSent || '验证邮件已发到 {email}，10 分钟内有效。', { email: email }), false);
            var box = els.pane.querySelector('#zsMeMailBox');
            if (!box) return;
            box.innerHTML =
              '<div class="zsme-fields">' +
              field('mailcode', T.secMailCode || '6 位验证码', 'text', 'inputmode="numeric" maxlength="6" autocomplete="one-time-code"', '') +
              '</div><p class="zsme-acts"><button type="button" class="zsme-btn primary" id="zsMeMailConfirm">' +
              esc(T.secMailConfirm || '确认验证') + '</button></p>';
            var ok = box.querySelector('#zsMeMailConfirm');
            ok.onclick = function () {
              var code = (box.querySelector('[name="mailcode"]').value || '').trim();
              if (!/^\d{6}$/.test(code)) return msg(T.fill, true);
              ok.disabled = true;
              verifyEmailCode(code).then(
                function (res) {
                  msg((res && res.message) || T.secMailOk || '邮箱已验证。', false);
                  refreshOverview(function () { showTab('security'); });
                },
                function (err) {
                  ok.disabled = false;
                  msg(err.message, true);
                }
              );
            };
          },
          function (err) { msg(err.message, true); }
        ).then(function () { send.disabled = false; });
      };
    }

    /** 已登录态把码交回专用接口，验过即完成邮箱验证 */
    function verifyEmailCode(code) {
      return api('/api/auth/verify-email', { method: 'POST', body: { code: code } });
    }

    /* ② 两步验证 / 身份验证器绑定 */

    function bindTotpSec(on, atLogin) {
      if (on) {
        /* 「登录时要动态码」由账号主人自己定；POST 失败就把勾选退回原值 */
        var atEl = els.pane.querySelector('#zsMeTotpAtLogin');
        if (atEl) {
          atEl.onchange = function () {
            atEl.disabled = true;
            api('/api/security/totp/at-login', { method: 'POST', body: { atLogin: atEl.checked } }).then(
              function (res) {
                msg((res && res.message) || (atEl.checked ? '已开启：登录时要动态码。' : '已关闭：登录只填邮箱与密码。'), false);
                atEl.disabled = false;
              },
              function (err) {
                atEl.checked = atLogin;
                atEl.disabled = false;
                msg(err.message, true);
              }
            );
          };
        }
        var offBtn = els.pane.querySelector('#zsMeTotpOff');
        if (!offBtn) return;
        offBtn.onclick = function () {
          var code = val(els.pane, 'totpOffCode');
          var pw = val(els.pane, 'totpOffPw');
          if (!code && !pw) return msg(T.fill, true);
          var body = {};
          if (code) body.code = code;
          if (pw) body.password = pw;
          offBtn.disabled = true;
          api('/api/security/totp/disable', { method: 'POST', body: body }).then(
            function (res) {
              msg((res && res.message) || '身份验证器已关闭。', Boolean(res && res.notice));
              refreshOverview(function () { showTab('security'); });
            },
            function (err) {
              offBtn.disabled = false;
              msg(err.message, true);
            }
          );
        };
        return;
      }

      var setupBtn = els.pane.querySelector('#zsMeTotpSetup');
      if (!setupBtn) return;
      setupBtn.onclick = function () {
        setupBtn.disabled = true;
        api('/api/security/totp/setup', { method: 'POST', body: {} }).then(
          function (d) {
            d = d || {};
            var box = els.pane.querySelector('#zsMeTotpBox');
            if (!box) return;
            box.innerHTML =
              '<p class="zsme-hint">' + esc(d.message || '') + '</p>' +
              '<p class="zsme-field"><span>' + esc(T.secManual || '手动输入密钥') + '</span>' +
              '<code class="zsme-key" id="zsMeTotpSecret">' + esc(d.secret || '') + '</code></p>' +
              '<p class="zsme-field"><span>' + esc(T.secTotpLink || '验证器链接（otpauth://）') + '</span>' +
              '<code class="zsme-key" id="zsMeTotpUrl">' + esc(d.otpauthUrl || '') + '</code></p>' +
              '<p class="zsme-acts">' +
              '<button type="button" class="zsme-btn sm" id="zsMeTotpCopy">' + esc(T.secCopySecret || '复制密钥') + '</button>' +
              '<button type="button" class="zsme-btn sm" id="zsMeTotpCopyUrl">' + esc(T.secCopyLink || '复制验证器链接') + '</button>' +
              '</p>' +
              '<div class="zsme-fields">' +
              field('totpCode', T.secTotpCode || '验证器上的 6 位动态码', 'text', 'inputmode="numeric" maxlength="6" autocomplete="one-time-code"', '') +
              '</div><p class="zsme-acts">' +
              '<button type="button" class="zsme-btn primary" id="zsMeTotpOn">' + esc(T.secEnable || '确认启用') + '</button></p>';

            box.querySelector('#zsMeTotpCopy').onclick = function () { copy(d.secret || ''); };
            box.querySelector('#zsMeTotpCopyUrl').onclick = function () { copy(d.otpauthUrl || ''); };
            box.querySelector('#zsMeTotpSecret').onclick = function () { copy(d.secret || ''); };
            box.querySelector('#zsMeTotpUrl').onclick = function () { copy(d.otpauthUrl || ''); };

            var onBtn = box.querySelector('#zsMeTotpOn');
            onBtn.onclick = function () {
              var code = (box.querySelector('[name="totpCode"]').value || '').trim();
              if (!/^\d{6}$/.test(code)) return msg(T.fill, true);
              onBtn.disabled = true;
              /* 顺手把刚拿到的密钥带上：KV 不可用的环境也能绑成功 */
              api('/api/security/totp/enable', { method: 'POST', body: { code: code, secret: d.secret || '' } }).then(
                function (res) {
                  msg((res && res.message) || T.secOk || '身份验证器已开启。', false);
                  refreshOverview(function () { showTab('security'); });
                },
                function (err) {
                  onBtn.disabled = false;
                  msg(err.message, true);
                }
              );
            };
          },
          function (err) { msg(err.message, true); }
        ).then(function () { setupBtn.disabled = false; });
      };
    }

    /* ③ 修改密码：当前密码 + 身份验证器动态码，两项都要 */

    function pwForm(on) {
      if (on) {
        return (
          '<p class="zsme-hint">' + esc(T.secPwNeed || '修改密码必须同时交两样凭据：当前密码 + 身份验证器的 6 位动态码。') + '</p>' +
          '<form id="zsMePw"><div class="zsme-fields">' +
          field('current', T.secCur || '当前密码', 'password', 'maxlength="200" required autocomplete="current-password"', '') +
          field('next', T.secNew || '新密码', 'password', 'required minlength="8" maxlength="200" placeholder="至少 8 位" autocomplete="new-password"', '') +
          field('totp', T.secTotpCode || '验证器上的 6 位动态码', 'text', 'required inputmode="numeric" maxlength="6" autocomplete="one-time-code"', '') +
          '</div><p class="zsme-acts"><button type="submit" class="zsme-btn primary">' +
          esc(T.secChange || '修改密码') + '</button></p></form>'
        );
      }
      return (
        '<p class="zsme-warn">' + esc(T.secPwNoTotp || '本账号还没启用身份验证器，请先在上面完成绑定。') + '</p>' +
        '<p class="zsme-hint">' + esc(T.secPwNeed || '修改密码必须同时交两样凭据：当前密码 + 身份验证器的 6 位动态码。') + '</p>' +
        '<div class="zsme-fields">' +
        field('current', T.secCur || '当前密码', 'password', 'maxlength="200" disabled', '') +
        field('next', T.secNew || '新密码', 'password', 'maxlength="200" disabled', '') +
        field('totp', T.secTotpCode || '验证器上的 6 位动态码', 'text', 'maxlength="6" disabled', '') +
        '</div><p class="zsme-acts"><button type="button" class="zsme-btn primary" disabled>' +
        esc(T.secChange || '修改密码') + '</button></p>'
      );
    }

    function bindPwSec(on) {
      var form = els.pane.querySelector('#zsMePw');
      if (!form) return;
      form.onsubmit = function (e) {
        e.preventDefault();
        var body = {
          current: val(form, 'current'),
          next: val(form, 'next'),
          /* 第二凭据固定走验证器：邮箱码与 GitHub 这两条入口这里不再提供 */
          second: 'totp',
          code: val(form, 'totp').replace(/\s/g, ''),
        };
        if (!body.current) return msg(T.fill, true);
        if (!body.next || body.next.length < 8) return msg(T.pwShort || '新密码至少 8 位', true);
        if (!/^\d{6}$/.test(body.code)) return msg(T.secTotpCode || '验证器上的 6 位动态码', true);
        var btn = form.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
        guard(api('/api/account/password', { method: 'POST', body: body }), T.secOk || '密码已更新，其它设备需要重新登录。', function () {
          form.reset();
        }).then(function () {
          if (btn) btn.disabled = false;
        });
      };
    }

    function totpSetupForm() {
      return '<p class="zsme-acts"><button type="button" class="zsme-btn primary" id="zsMeTotpSetup">' +
        esc(T.secSetup || '生成密钥') + '</button></p>';
    }

    function totpOnForm(atLogin) {
      return '<p class="zsme-hint">' + esc(T.secTotpOn || '验证器已开启，登录时需要补 6 位动态码。') + '</p>' +
        '<p class="zsme-check"><label><input type="checkbox" id="zsMeTotpAtLogin"' + (atLogin ? ' checked' : '') + '>' +
        '<span>' + esc(T.secTotpAtLogin || '登录时要这枚动态码') + '</span></label>' +
        '<span class="zsme-check-hint">' +
        esc(T.secTotpAtLoginHint || '关掉后这个账号登录只填邮箱与密码。站点那条「管理员登录方式」只管后台管理员，管不到这里。') +
        '</span></p>' +
        '<div class="zsme-fields">' +
        field('totpOffCode', T.secTotpOffCode || '当前动态码', 'text', 'inputmode="numeric" maxlength="6" autocomplete="one-time-code"', '') +
        field('totpOffPw', T.secTotpOffPw || '或当前密码', 'password', 'maxlength="200" autocomplete="current-password"', '') +
        '</div><p class="zsme-acts"><button type="button" class="zsme-btn is-danger" id="zsMeTotpOff">' +
        esc(T.secDisable || '关闭验证器') + '</button></p>';
    }

    /* ------ 账号注销：点「确认注销」→ 说明 +「提交申请」→ 浏览器二次确认 → 提交；
                confirm 字段由前端自动带上账号标识，不需要用户打字 ------ */

    function panelDelete() {
      return api('/api/account/delete-request').then(function (d) {
        d = d || {};
        var req = d.request;
        var state = '';
        if (req && req.status === 'pending') state = '<p class="zsme-warn">' + esc(T.delPending) + '（' + esc(fmt(req.createdAt)) + '）</p>';
        else if (req && req.status === 'approved') state = '<p class="zsme-danger-text">' + esc(T.delApproved) + '</p>';
        else if (req && req.status === 'rejected') state = '<p class="zsme-hint">' + esc(T.delRejected) + (req.reviewNote ? '：' + esc(req.reviewNote) : '') + '</p>';

        var blocked = d.canSelfDelete === false;
        var pending = Boolean(req && req.status === 'pending');

        els.pane.innerHTML =
          '<div class="zsme-card"><h3>' + esc(T.tabDelete) + '</h3>' + state +
          (blocked ? '<p class="zsme-warn">' + esc(T.delAdmin) + '</p>' : '') +
          willDeleteTable(d.willDelete) +
          '<div id="zsMeDelBox">' +
          (blocked || pending
            ? ''
            : '<p class="zsme-acts"><button type="button" class="zsme-btn is-danger" id="zsMeDelStart">' +
              esc(T.delSubmit || '确认注销') + '</button></p>') +
          '</div></div>';

        var box = els.pane.querySelector('#zsMeDelBox');
        if (!box) return;
        var start = box.querySelector('#zsMeDelStart');
        if (!start) return;
        start.onclick = function () {
          box.innerHTML =
            '<p class="zsme-warn">' + nl2br(esc(fill(T.delAsk || '注销是不可撤销的：站主通过后，你的评论、收藏与点赞、投稿、认证资料、友链申请与登录会话都会被删除，无法找回。'))) + '</p>' +
            '<label class="zsme-field full"><span>' + esc(T.delReason || '注销原因（可留空）') + '</span>' +
            '<textarea name="reason" rows="2" maxlength="500"></textarea></label>' +
            '<p class="zsme-acts"><button type="button" class="zsme-btn is-danger" id="zsMeDelGo">' +
            esc(T.delConfirmBtn || '提交申请') + '</button>' +
            '<button type="button" class="zsme-btn sm" id="zsMeDelCancel">' + esc(T.btnCancel || '取消') + '</button></p>';

          box.querySelector('#zsMeDelCancel').onclick = function () { showTab('delete'); };
          box.querySelector('#zsMeDelGo').onclick = function () {
            var self = this;
            var proof = deleteConfirm(d);
            if (!proof) return msg('还没读到你的账号标识或注册邮箱，请刷新页面再试。', true);
            if (!confirm(T.delAsk2 || '确定要提交注销申请？这一步之后才会真正发给站主。')) return;
            self.disabled = true;
            msg(T.busy || '正在处理…', false);
            api('/api/account/delete-request', {
              method: 'POST',
              body: { reason: val(box, 'reason'), confirm: proof },
            }).then(
              function (res) {
                msg((res && res.message) || T.delOk || '注销申请已提交，等待站主审核。', false);
                refreshOverview(function () { showTab('delete'); });
              },
              function (err) {
                self.disabled = false;
                msg(err.message, true);
              }
            );
          };
        };
      });
    }

    /** 后端的 confirm 要原样等于账号标识或注册邮箱，这里一律由前端自动带上，不要用户打字 */
    function deleteConfirm(d) {
      var a = (ov && ov.account) || {};
      if (a.accountSlug) return String(a.accountSlug);
      if (a.email) return String(a.email);
      if (d && d.email) return String(d.email);
      var need = d && d.confirmWith;
      return need ? String(need).replace(/^@/, '') : '';
    }

    function willDeleteTable(will) {
      var labels = {
        comments: '我的评论',
        commentLikes: '评论的点赞',
        reactions: '点赞与收藏',
        commenters: '评论者档案',
        postDrafts: '投稿',
        authorRequests: '认证申请',
        friendApplications: '友链申请',
        sessions: '登录会话',
        accounts: '账号绑定记录',
        subscribers: '邮件订阅',
        verifications: '验证码记录',
      };
      var rows = Object.keys(labels).filter(function (k) { return will && typeof will[k] === 'number'; });
      if (!rows.length) return '';
      return (
        '<p class="zsme-hint">' + esc(T.delWillDelete || '注销会一并删除') + '：' +
        rows.map(function (k) { return esc(labels[k]) + ' ' + will[k] + ' 项'; }).join('、') +
        '</p>'
      );
    }

    /* ---------------- 小工具 ---------------- */

    function api(path, opt) {
      return window.ZeroStack.api(path, opt);
    }

    function refreshOverview(done) {
      api('/api/account/overview')
        .then(function (d) {
          ov = d || ov;
          paintShell();
        })
        .catch(function () {})
        .then(function () { if (done) done(); });
    }

    function msg(text, isError) {
      if (!els.msg) return;
      els.msg.textContent = text || '';
      els.msg.hidden = !text;
      els.msg.className = 'zsme-msg' + (isError ? ' is-err' : '');
    }

    function guard(promise, okText, after) {
      msg(T.busy || '正在处理…', false);
      return promise
        .then(function () {
          msg(okText || T.saved, false);
          if (after) after();
        })
        .catch(function (err) {
          msg((err && err.message) || T.net, true);
        });
    }

    function field(name, label, type, attrs, value) {
      return (
        '<label class="zsme-field"><span>' + esc(label || name) + '</span>' +
        '<input name="' + name + '" data-d="' + name + '" type="' + type + '" ' + (attrs || '') + ' value="' + esc(value == null ? '' : value) + '"></label>'
      );
    }

    /** 文案里的 {占位} 用真实数据填掉（邮箱、账号标识这些后端已经给了） */
    function fill(text, map) {
      return String(text == null ? '' : text).replace(/\{(\w+)\}/g, function (m, k) {
        return map && map[k] != null && map[k] !== '' ? String(map[k]) : m;
      });
    }

    function nl2br(html) {
      return String(html).replace(/\n/g, '<br>');
    }

    function val(form, name) {
      var el = form.elements ? form.elements[name] : form.querySelector('[name="' + name + '"]');
      return el ? String(el.value).trim() : '';
    }

    function valOf(scope, name) {
      var el = scope.querySelector('[data-a="' + name + '"], [name="' + name + '"]');
      return el ? String(el.value).trim() : '';
    }

    function isUrl(v) {
      return /^https?:\/\/[^\s]+\.[^\s]+/i.test(v);
    }

    function chip(text, cls) {
      return '<span class="zsme-chip ' + (cls || '') + '">' + esc(text) + '</span>';
    }

    function statusChip(s) {
      var map = {
        approved: T.stApproved,
        pending: T.stPending,
        spam: T.stSpam,
        rejected: T.stRejected,
        draft: T.stDraft,
        withdrawn: T.stWithdrawn,
        withdraw_requested: T.stWithdraw,
      };
      var cls = s === 'approved' ? 'is-ok' : s === 'pending' || s === 'withdraw_requested' ? 'is-warn' : s === 'spam' || s === 'rejected' ? 'is-bad' : '';
      return chip(map[s] || s || '—', cls);
    }

    function fmt(ts) {
      if (!ts) return '';
      var d = new Date(ts * 1000);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function pad(n) {
      return n < 10 ? '0' + n : String(n);
    }

    function copy(text) {
      var v = String(text == null ? '' : text);
      var done = T.copied || '已复制到剪贴板';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(v).then(function () { msg(done, false); }, function () { msg(v, false); });
        return;
      }
      msg(v, false);
    }

    function readI18n() {
      var el = document.querySelector('.zero-me-i18n');
      if (!el) return {};
      try {
        return JSON.parse(el.textContent) || {};
      } catch (e) {
        return {};
      }
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
