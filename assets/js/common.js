// ============================================================
// common.js - 全局功能：主题切换、导航、滚动按钮
// 适用于 Hugo 主题，保留所有原有交互逻辑
// ============================================================

document.addEventListener('DOMContentLoaded', function() {

  // ==================== 导航高亮 ====================
  // 服务端（header.html）已经按当前页面写好 active / aria-current，
  // 这里只做补充：万一某页没匹配上，再按路径最后一段补一次。
  // 注意别再删服务端给的结果——之前那样做会把 /work/ 这类页面的高亮清掉，
  // 新的导航下划线（.nav-underline）就找不到"当前项"了。
  function highlightNav() {
    const segments = window.location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    const current = segments.length ? segments[segments.length - 1] : '';
    document.querySelectorAll('.nav-link:not(.blog-link)').forEach(link => {
      if (link.classList.contains('active')) return;
      const href = (link.getAttribute('href') || '').replace(/\/+$/, '');
      const tail = href.split('/').filter(Boolean).pop() || '';
      if (current && tail && tail === current) link.classList.add('active');
    });
  }
  highlightNav();

  // ==================== 导航活跃下划线（桌面端滑动） ====================
  // 一根共用的下划线：当前页默认停在 active 项下面，鼠标移到别的项时滑过去，
  // 移开后滑回来。移动端抽屉里不显示（CSS 里隐藏）。
  (function navUnderline() {
    const container = document.querySelector('.nav-links');
    // 注意：这里要包含外链项（.blog-link，例如「开往」）。之前用 :not(.blog-link)
    // 把它们排除了，导致后加的导航项鼠标移上去没有下划线动画。
    // 只有"当前页标记"才需要排除外链（外链不可能是当前页，见下面的 activeLink）。
    const links = Array.from(document.querySelectorAll('.nav-link'));
    if (!container || links.length < 2) return;

    const bar = document.createElement('span');
    bar.className = 'nav-underline';
    bar.setAttribute('aria-hidden', 'true');
    container.appendChild(bar);

    // [motion].reduced_motion_respect = false 时 <html> 带 data-motion-force，系统的「减少动态效果」不再影响本页
    const reduceMotion = !document.documentElement.hasAttribute('data-motion-force')
      && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const activeLink = () => document.querySelector('.nav-link.active:not(.blog-link)') || null;

    function place(link, animate) {
      if (!link) { bar.style.opacity = '0'; return; }
      const c = container.getBoundingClientRect();
      const r = link.getBoundingClientRect();
      if (!r.width) { bar.style.opacity = '0'; return; }
      if (!animate) bar.style.transition = 'none';
      bar.style.opacity = '1';
      bar.style.width = r.width + 'px';
      bar.style.transform = 'translate3d(' + (r.left - c.left) + 'px,0,0)';
      if (!animate) {
        void bar.offsetWidth;                     // 强制回流，让下面的过渡重新生效
        bar.style.transition = '';
      }
    }

    // 首次定位不要有动画（避免页面一打开下划线从左边滑过来）
    requestAnimationFrame(() => place(activeLink(), false));

    links.forEach(link => {
      link.addEventListener('mouseenter', () => place(link, !reduceMotion));
      link.addEventListener('focus', () => place(link, !reduceMotion));
    });
    container.addEventListener('mouseleave', () => place(activeLink(), !reduceMotion));
    container.addEventListener('focusout', (e) => {
      if (!container.contains(e.relatedTarget)) place(activeLink(), !reduceMotion);
    });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => place(activeLink(), false), 120);
    });
    // 网络字体/图标加载完成后文字宽度会变，也要重新对一次（否则下划线会偏）
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => place(activeLink(), false));
    }
    window.addEventListener('load', () => place(activeLink(), false));
  })();

  // ==================== 导航子菜单（点击展开/收起） ====================
  // 菜单项在 config 里写 identifier / parent 就会生成子菜单；
  // 这里负责点击展开、点击别处或按 Esc 收起、同步 aria-expanded，键盘也能用。
  // 桌面端下拉用 position: fixed（导航条有 overflow 会裁掉绝对定位的下拉），
  // 所以展开时要由 JS 把它贴到父项正下方，并在窗口尺寸变化时重新贴一次。
  (function navSubmenus() {
    const parents = Array.from(document.querySelectorAll('[data-nav-parent]'));
    if (!parents.length) return;

    const isDrawer = () => window.matchMedia('(max-width: 768px)').matches;

    function placeMenu(btn, menu) {
      if (!btn || !menu || isDrawer()) {
        if (menu) { menu.style.left = ''; menu.style.top = ''; }
        return;
      }
      const r = btn.getBoundingClientRect();
      const bar = document.querySelector('.site-nav');
      const barBottom = bar ? bar.getBoundingClientRect().bottom : r.bottom;
      menu.style.left = Math.round(r.left) + 'px';
      // 贴着按钮下沿；但不要压到导航条本身，至少落到导航条下沿之外
      menu.style.top = Math.round(Math.max(r.bottom + 6, barBottom + 4)) + 'px';
      // 贴右边界时向左回避，避免被视口裁掉
      const w = menu.getBoundingClientRect().width;
      const over = r.left + w - (window.innerWidth - 8);
      if (over > 0) menu.style.left = Math.round(r.left - over) + 'px';
    }

    function closeAll(except) {
      parents.forEach(btn => {
        if (btn === except) return;
        btn.setAttribute('aria-expanded', 'false');
        const item = btn.closest('.nav-item');
        if (!item) return;
        item.classList.remove('is-open');
        const menu = item.querySelector('.nav-submenu');
        if (menu) menu.hidden = true;
      });
    }

    parents.forEach(btn => {
      const item = btn.closest('.nav-item');
      const menu = item && item.querySelector('.nav-submenu');
      if (!menu) return;

      function openMenu() {
        closeAll(btn);                                  // 同时只开一个
        btn.setAttribute('aria-expanded', 'true');
        item.classList.add('is-open');
        menu.hidden = false;
        placeMenu(btn, menu);                           // 先摆好位置再显示，避免闪一下
      }
      function closeMenu() {
        btn.setAttribute('aria-expanded', 'false');
        item.classList.remove('is-open');
        menu.hidden = true;
      }

      // 桌面端：鼠标移入展开、移开收起（下拉菜单本身在 .nav-item 内，
      // 所以从按钮移到菜单上不会触发真正的移出；留一点延迟更稳）
      let hoverTimer = null;
      item.addEventListener('mouseenter', () => {
        if (isDrawer()) return;
        clearTimeout(hoverTimer);
        openMenu();
      });
      item.addEventListener('mouseleave', () => {
        if (isDrawer()) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(closeMenu, 140);
      });

      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = btn.getAttribute('aria-expanded') === 'true';
        // 桌面端鼠标点击交给 hover 管（点了不要反而关掉）；键盘回车（detail === 0）与移动端仍走切换
        if (!isDrawer() && e.detail !== 0) {
          if (!isOpen) openMenu();
          return;
        }
        closeAll(btn);                                  // 同时只开一个
        if (isOpen) { closeMenu(); return; }
        openMenu();
      });
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('.nav-item-sub')) closeAll(null);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAll(null);
    });

    let rt = null;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        const item = document.querySelector('.nav-item.is-open');
        if (item) placeMenu(item.querySelector('.nav-parent'), item.querySelector('.nav-submenu'));
      }, 120);
    });
  })();

  // ==================== 抽屉菜单 ====================
  // 移动端侧滑导航，768px 断点以下生效
  const navToggle = document.querySelector('.nav-toggle');
  const navLinksContainer = document.getElementById('navLinks');
  const navOverlay = document.getElementById('navOverlay');
  const navClose = document.querySelector('.nav-close');

  if (navToggle && navLinksContainer && navOverlay) {
    // 同步 aria-expanded，让读屏用户知道抽屉是否展开
    function setDrawerAria(open) {
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function openDrawer() {
      navLinksContainer.classList.add('open');
      navOverlay.classList.add('show');
      document.body.style.overflow = 'hidden';
      setDrawerAria(true);
    }

    function closeDrawer() {
      navLinksContainer.classList.remove('open');
      navOverlay.classList.remove('show');
      document.body.style.overflow = '';
      setDrawerAria(false);
    }

    // Esc 关闭抽屉（键盘用户）
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && navLinksContainer.classList.contains('open')) {
        closeDrawer();
        navToggle.focus();
      }
    });

    navToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      if (navLinksContainer.classList.contains('open')) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });

    navOverlay.addEventListener('click', closeDrawer);
    if (navClose) {
      navClose.addEventListener('click', closeDrawer);
    }

    // 抽屉里的点击行为：
    //   · 普通链接 / 子菜单项 → 关闭抽屉（普通链接本来就会跳转，子项点击后收起）
    //   · 带子菜单的父项（.nav-parent）→ 只展开/收起子菜单，抽屉保持打开
    //   注：外链项（.blog-link）本身就是 .nav-link，不必再单独列一次
    document.querySelectorAll('#navLinks .nav-link:not(.nav-parent), #navLinks .nav-submenu-link').forEach(link => {
      link.addEventListener('click', function() {
        closeDrawer();
      });
    });

    window.addEventListener('resize', function() {
      if (window.innerWidth > 768) {
        closeDrawer();
      }
    });
  }

  // ==================== 主题切换 ====================
  // 三态循环：auto → light → dark → auto
  const themes = ['auto', 'light', 'dark'];
  const themeToggle = document.getElementById('themeToggle');

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const icon = themeToggle ? themeToggle.querySelector('i') : null;
    if (icon) {
      if (theme === 'light') icon.className = 'fas fa-sun';
      else if (theme === 'dark') icon.className = 'fas fa-moon';
      else icon.className = 'fas fa-adjust';
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function() {
      const current = localStorage.getItem('theme') || 'auto';
      let idx = themes.indexOf(current);
      idx = (idx + 1) % themes.length;
      setTheme(themes[idx]);
    });
  }

  const savedTheme = localStorage.getItem('theme') || 'auto';
  setTheme(savedTheme);

  // ==================== 滚动按钮 ====================
  // 回到顶部 / 到底部按钮，根据滚动位置自动显隐
  const topBtn = document.getElementById('scrollToTop');
  const bottomBtn = document.getElementById('scrollToBottom');

  function updateScrollButtons() {
    if (!topBtn || !bottomBtn) return;
    const scrollY = window.scrollY;
    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;
    const atTop = scrollY < 30;
    const atBottom = scrollY + winHeight >= docHeight - 30;

    topBtn.classList.toggle('hidden', atTop);
    bottomBtn.classList.toggle('hidden', atBottom);
  }

  if (topBtn && bottomBtn) {
    window.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);
    updateScrollButtons();

    topBtn.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    bottomBtn.addEventListener('click', function() {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    });
  }

  // ==================== 导航栏账号图标 ====================
  // menus.*.toml 里 position="controls" + zero_account = true 的那一项（#navAccount）。
  // 会话是 HttpOnly Cookie，所以只问一次 /api/auth/me，不在本地存 token。
  const accountNav = document.getElementById('navAccount');
  if (accountNav) {
    if (!window.ZeroStack || !window.ZeroStack.enabled) {
      accountNav.remove();            // 没配 apiBaseURL，账号入口就是个死链
    } else {
      const guestIcon = accountNav.querySelector('i');
      const guestIconClass = guestIcon ? guestIcon.className : '';
      const guestTitle = accountNav.getAttribute('title') || '';

      function paintAccountNav(user) {
        const avatar = accountNav.querySelector('.nav-avatar');
        if (user) {
          const label = user.name || user.email || '';
          accountNav.classList.add('is-signed');
          accountNav.title = label;
          accountNav.setAttribute('aria-label', label);
          if (user.image) {
            if (guestIcon) guestIcon.remove();
            if (!avatar) {
              const img = document.createElement('img');
              img.className = 'nav-avatar';
              img.src = user.image;
              img.alt = '';
              img.loading = 'lazy';
              accountNav.insertBefore(img, accountNav.firstChild);
            }
          } else {
            if (avatar) avatar.remove();
            if (guestIcon) guestIcon.className = 'fas fa-user';
          }
        } else {
          accountNav.classList.remove('is-signed');
          if (avatar) avatar.remove();
          accountNav.title = guestTitle;
          accountNav.setAttribute('aria-label', guestTitle);
          if (guestIcon) {
            if (!accountNav.contains(guestIcon)) accountNav.insertBefore(guestIcon, accountNav.firstChild);
            guestIcon.className = guestIconClass;
          }
        }
      }

      window.ZeroStack.me()
        .then(paintAccountNav)
        .catch(function () { /* 未登录或后端暂时不可达：保持未登录的样子 */ });

      // 账号页登录 / 退出后不刷新页面，由 account.js 派发事件同步图标
      document.addEventListener('zero:session', function (e) {
        paintAccountNav(e.detail && e.detail.user);
      });
    }
  }

  // ==================== 视频「点了才加载」 ====================
  // 短代码只输出一个 16:9 的按钮（partials/video-lite.html），真要点才把播放器请进来：
  // iframe 一挂在 DOM 上浏览器就会去拉各家播放器连带的那堆脚本，没打算看的人不该替它下载。
  // 这里用事件委托而不是逐个绑定：shuo.js 会把正文里的媒体块搬进时刻卡片，节点会被重建，
  // 绑在元素上的监听跟着节点一起没了，委托在 document 上就不受影响。
  (function videoLite() {
    function mount(btn) {
      const src = btn.getAttribute('data-video-src') || '';
      // 只放行 http(s)：这个属性是构建期写死的，但地址要进 iframe，就再挡一道
      if (!/^https?:\/\//i.test(src)) return;
      const frame = document.createElement('iframe');
      frame.src = src;
      frame.title = btn.getAttribute('data-video-title') || '视频';
      // allow / allowfullscreen / referrerpolicy 由各短代码原样传进来：
      // 各家播放器要的权限不一样（B站那个原本压根没有 allow），统一发一份会在控制台
      // 多出「accelerometer is not allowed」这类策略违规，属性照旧才叫「点了才加载」而不是「换了个播放器」
      const allow = btn.getAttribute('data-video-allow');
      if (allow) frame.setAttribute('allow', allow);
      if (btn.getAttribute('data-video-fullscreen')) frame.setAttribute('allowfullscreen', 'true');
      const referrer = btn.getAttribute('data-video-referrer');
      if (referrer) frame.setAttribute('referrerpolicy', referrer);
      frame.setAttribute('loading', 'lazy');
      frame.setAttribute('frameborder', '0');
      frame.style.cssText = 'display:block;width:100%;aspect-ratio:16/9;height:auto;border:none;';
      btn.replaceWith(frame);
    }
    document.addEventListener('click', function (e) {
      const t = e.target;
      const btn = t && t.closest ? t.closest('.video-lite') : null;
      if (btn) mount(btn);
    });
  })();

});
