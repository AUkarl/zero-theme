/* 全站全身桌宠：dsh-pet / dsh-pet-indesktop 的透明 WebM 动画 + 本站 AI/状态。
 * 动画素材版权：CC BY-NC-SA 4.0，非商业使用；代码 MIT。 */
(function () {
  'use strict';

  // 首页、登录页/用户中心、分类页、标签页、作者页和 404 永远不启动桌宠；脚本即使被缓存或误引入也不会创建任何节点。
  var petPath = location.pathname;
  if (/^\/(?:index\.html)?$/.test(petPath) || /^\/account(?:\/|$)/.test(petPath) || /^\/(?:categories|tags|author)(?:\/|$)/.test(petPath) || /^\/404(?:\.html|\/)?$/.test(petPath)) return;

  if (window.__SITE_PET_BOOTED__) return;
  window.__SITE_PET_BOOTED__ = true;

  var STORE = 'whale-pet-v1';
  // SPRITE_VER 跟着精灵素材走（素材没变就不该让用户重下 31MB）；PET_VER 是脚本自身版本，
  // 也用来给 WebM 素材定址。_headers 里 /whale-pet/* 是 immutable 一年：换素材必须同时升这两个号，
  // 否则老访客一直拿旧文件（float.webm 当年就是这么被 ?v=1 钉住的）。
  var SPRITE_VER = '47';
  var PET_VER = '52';
  var LAYOUT_KEY = 'whale-pet-layout-v2';
  var GREET_KEY = 'whale-pet-greeted';
  var EXPAND_KEY = 'whale-pet-expanded';
  var ANIM_BASE = '/whale-pet/animations/';
  var SLEEP_AFTER = 5 * 60 * 1000;
  var mqNarrow = window.matchMedia('(max-width: 760px)');
  var mobile = mqNarrow.matches;
  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var lowData = !!(conn && (conn.saveData || /2g/.test(String(conn.effectiveType || ''))));
  var ua = navigator.userAgent || '';
  var isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Android|CriOS|FxiOS/i.test(ua);
  // 手机浏览器普遍会把页面里的 <video> 接管成自家播放层：透明 WebM 的 alpha
  // 可能被丢掉，画面上就会出现一块不透明视频框。手机端统一改用动画 WebP 海报，
  // 不创建视频播放，桌面端仍保留完整 WebM 动作。
  // 手机判定只认真正的触屏/手机环境：窄窗口的桌面浏览器不该被当成手机降级。
  var phoneUA = /Android|iPhone|iPad|iPod|Mobile|HarmonyOS|MiuiBrowser|VivoBrowser|HeyTapBrowser|HuaweiBrowser|HonorBrowser|UCBrowser|Quark|qqbrowser|MQQBrowser|baidubrowser|SogouMobileBrowser|SamsungBrowser/i.test(ua);
  var isMobileBrowser = phoneUA || (mobile && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window));

  // 后台「鲸鱼娘」页写 data/pet.json，Hugo 在页面里注入 window.__WHALE_PET_CONFIG__；
  // 这里保留一份同口径默认值，后台没配或老页面没有注入时也能跑。
  var DEFAULT_CFG = {
    enabled: true,
    size: 'm',
    corner: 'left',
    mobileMode: 'full',
    autoActions: true,
    idleMin: 6,
    idleMax: 14,
    aiEnabled: true,
    greetingEnabled: true,
    clickReaction: true,
    feedEnabled: true,
    sleepEnabled: true,
    dragEnabled: true,
    dockEnabled: true,
    scrollReaction: true,
    likeReaction: true,
    commentReaction: true,
    backTopReaction: true,
    creditEnabled: true,
  };
  var CFG = Object.assign({}, DEFAULT_CFG, window.__WHALE_PET_CONFIG__ || {});
  if (CFG.size !== 's' && CFG.size !== 'l') CFG.size = 'm';
  if (CFG.corner !== 'right') CFG.corner = 'left';
  if (CFG.mobileMode !== 'full' && CFG.mobileMode !== 'hidden') CFG.mobileMode = 'mini';
  CFG.idleMin = Math.max(3, Math.min(120, Number(CFG.idleMin) || DEFAULT_CFG.idleMin));
  CFG.idleMax = Math.max(CFG.idleMin, Math.min(180, Number(CFG.idleMax) || DEFAULT_CFG.idleMax));
  if (CFG.enabled === false) return;

  // ——————————————————————————————————————————————————————————————
  // 动画目录：文件名已改成 ASCII，避免中文路径在不同服务器上的编码差异。
  // max = 一次性动画最多演多久；到点淡回待机。loop = 持续循环。
  // ——————————————————————————————————————————————————————————————
  var CLIPS = {
    idle: { f: 'idle.webm', label: '待机', loop: true },
    look: { f: 'look.webm', label: '东张西望' },
    drag: { f: 'drag.webm', label: '被拎起来', loop: true },
    'click-happy': { f: 'click-happy.webm', label: '开心跃动', max: 6500 },
    'click-shy': { f: 'click-shy.webm', label: '害羞惊讶', max: 6500 },
    'click-pout': { f: 'click-pout.webm', label: '傲娇生气', max: 6500 },
    'click-laugh': { f: 'click-laugh.webm', label: '挠痒咯咯笑', max: 6500 },
    'click-wave': { f: 'click-wave.webm', label: '元气挥手', max: 6000 },
    'sleep-start': { f: 'sleep-start.webm', label: '躺下' },
    'sleep-loop': { f: 'sleep-loop.webm', label: '睡着', loop: true },
    'sleep-end': { f: 'sleep-end.webm', label: '起床' },
    'eat-rice': { f: 'eat-rice.webm', label: '吃白饭' },
    celebrate: { f: 'celebrate.webm', label: '雀跃庆祝', max: 7000 },
    sad: { f: 'sad.webm', label: '垂头叹气', max: 6500 },
    think: { f: 'think.webm', label: '思考', loop: true },
    stretch: { f: 'stretch.webm', label: '伸懒腰' },
    yawn: { f: 'yawn.webm', label: '打哈欠' },
    nap: { f: 'nap.webm', label: '小憩' },
    bubble: { f: 'bubble.webm', label: '吐泡泡' },
    dance: { f: 'dance.webm', label: '摇摆舞' },
    cat: { f: 'cat.webm', label: '撸猫' },
    icecream: { f: 'icecream.webm', label: '吃冰淇淋' },
    hotpot: { f: 'hotpot.webm', label: '涮火锅' },
    code: { f: 'code.webm', label: '写代码' },
    sing: { f: 'sing.webm', label: '悠闲哼歌' },
    mirror: { f: 'mirror.webm', label: '照镜子' },
    walk: { f: 'walk.webm', label: '螃蟹走路' },
    float: { f: 'float.webm', label: '漂浮踏步' },
  };

  var CLICK_CLIPS = ['click-happy', 'click-shy', 'click-pout', 'click-laugh', 'click-wave'];
  var RANDOM_CLIPS = [
    'look', 'stretch', 'yawn', 'nap', 'sing', 'mirror', 'code',
    'bubble', 'dance', 'cat', 'walk', 'float',
    'eat-rice', 'icecream', 'hotpot',
  ];
  var GROUPS = [
    { title: '小动作', items: ['look', 'stretch', 'yawn', 'nap', 'sing', 'mirror', 'code'] },
    { title: '玩耍', items: ['bubble', 'dance', 'cat', 'walk', 'float'] },
    { title: '吃什么', items: ['eat-rice', 'icecream', 'hotpot'] },
    { title: '情绪', items: ['click-happy', 'click-shy', 'click-pout', 'click-laugh', 'click-wave', 'celebrate', 'sad'] },
  ];
  var MOOD_ANIM = {
    happy: 'celebrate',
    curious: 'look',
    surprised: 'click-shy',
    pout: 'click-pout',
    sleepy: 'yawn',
    sad: 'sad',
  };

  var state = loadState();
  var context = pageContext();
  var layout = readLayout();
  // 后台改了大小/角落时，清掉访客本地拖拽的位置，让新默认值真正生效；
  // 之后访客再拖动仍按本地位置保存，直到后台下一次改动。
  var layoutCfg = CFG.size + ':' + CFG.corner;
  if (layout.cfgKey !== layoutCfg) {
    delete layout.x;
    delete layout.y;
    layout.cfgKey = layoutCfg;
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch (e) {}
  }
  var greeted = false;
  var booted = false;
  // 手机自带内核基本都会把页面里的 <video> 接管成自家播放层，或者硬件解码直接丢掉
  // 透明通道（小米、vivo、OPPO、华为/荣耀、360、百度、QQ/微信、UC、夸克、搜狗都实测过）。
  // 与其继续加长黑名单，反过来定规则：手机端只给明确的现代内核留 WebM，
  // 其余一律 Canvas 精灵；桌面端仍走 WebM，并在首帧做一次真实像素的透明校验。
  var stockKernel = /MiuiBrowser|MiBrowser|MIBrowser|Miui|VivoBrowser|BBKBrowser|HeyTapBrowser|OppoBrowser|HuaweiBrowser|HonorBrowser|MagicBrowser|HarmonyOS|ArkWeb|UCBrowser|UBrowser|Quark|qqbrowser|MQQBrowser|MicroMessenger|TencentTraveler|baidubrowser|BaiduBrowser|BDAPP|QihooBrowser|360Browser|360AISE|SogouMobileBrowser|CheetahBrowser|KuaiYa|LenovoBrowser|ZTEBrowser|MeizuBrowser|NubiaBrowser/i;
  var modernMobile = /(Chrome|CriOS)\/\d+|EdgA\/|Edg\/|Firefox\/|SamsungBrowser|OPR\//i;
  var noWebm = !supportsWebm();
  var videoOnPhone = isMobileBrowser && modernMobile.test(ua) && !stockKernel.test(ua) && !noWebm;
  var useMobileCanvas = isMobileBrowser && !videoOnPhone;
  var usePosterOnly = noWebm && !useMobileCanvas;
  var engineName = useMobileCanvas ? 'canvas' : (noWebm ? 'poster' : 'video');
  var root = null;
  var stage = null;
  var vA = null;
  var vB = null;
  var poster = null;
  var canvasEl = null;
  var canvasCtx = null;
  var canvasRaf = 0;
  var canvasOn = false;
  var canvasDrew = false;
  var canvasProbeTimer = null;
  var canvasProbeTries = 0;
  var canvasKey = null;
  var canvasLast = 0;
  var bubbleEl = null;
  var bubbleBody = null;
  var bubbleFoot = null;
  var bubbleTimer = null;
  var dock = null;
  var menu = null;
  var chat = null;
  var front = null;
  var back = null;
  var active = null;
  var playSeq = 0;
  var cutTimer = null;
  var chainTimer = null;
  var sleepTimer = null;
  var drag = null;
  var menuOpen = false;
  var chatOpen = false;
  var statusOpen = false;
  // 面板一旦被气泡顶上去，本次打开期间就不要再回落，免得每条回复都跳一下。
  var bubbleHoldSticky = 0;
  var statusPanel = null;
  var statusTimer = null;

  function panelsOpen() {
    return menuOpen || chatOpen || statusOpen;
  }
  var lastPokeAsk = 0;
  var lastRandom = '';
  var clickIdx = 0;
  var hasPlayed = false;
  var lastPageLine = 0;
  var lastCommentReaction = 0;
  var lastLocalReaction = 0;
  var lastLocalLine = '';
  var pageLinked = { q1: false, q2: false, q3: false, bottom: false, search: false, commentFocus: false, applyEmail: false, applyUrl: false, subscribeFocus: false };
  var commentWatch = { host: null, count: 0, ready: false, timer: null, stableCount: -1, stableAt: 0, poll: false };
  var hiddenAt = 0;
  var chatHistory = [];
  var idleStartTimer = null;
  var idleStartSeq = 0;

  // AI 身份：后台「回复」页的昵称 / 头像 / 身份组；空值回落到阿溟。
  var DEFAULT_NAME = '阿溟';
  var identity = { name: DEFAULT_NAME, image: '', group: '' };
  var identityTries = 0;

  function identityName() {
    return identity.name || DEFAULT_NAME;
  }

  function personalize(text) {
    return String(text == null ? '' : text).replace(/鱼鱼|爱吃白饭的大肥鱼/g, identityName());
  }

  function setIdentityImage(img) {
    if (!img) return;
    img.onerror = function () {
      if (img.dataset.identityFallback === '1') return;
      img.dataset.identityFallback = '1';
      img.src = '/whale-pet/avatar.webp?v=' + PET_VER;
    };
    if (identity.image) {
      img.dataset.identityFallback = '0';
      var src = identity.image;
      if (src.charAt(0) === '/' && src.indexOf('/api/') === 0 && window.ZeroStack && window.ZeroStack.base) {
        src = String(window.ZeroStack.base).replace(/\/+$/, '') + src;
      }
      img.src = src;
    } else {
      img.dataset.identityFallback = '1';
      img.src = '/whale-pet/avatar.webp?v=' + PET_VER;
    }
  }

  function updateIdentityUi() {
    if (!root) return;
    var name = identityName();
    var bubbleName = root.querySelector('.sp-name');
    if (bubbleName) bubbleName.textContent = name;
    setIdentityImage(root.querySelector('.sp-face'));
    setIdentityImage(root.querySelector('.sp-status-face'));
    var menuTitle = root.querySelector('.sp-menu .sp-panel-head b');
    if (menuTitle) menuTitle.textContent = name + '的动作';
    var chatTitle = root.querySelector('.sp-chat .sp-panel-head b');
    if (chatTitle) chatTitle.textContent = '跟' + name + '说点什么';
    var statusTitle = root.querySelector('.sp-status .sp-panel-head b');
    if (statusTitle) statusTitle.textContent = name + '的状态';
    var statusName = root.querySelector('.sp-status-name');
    if (statusName) statusName.textContent = name;
    var statusGroup = root.querySelector('.sp-status-group');
    if (statusGroup) {
      statusGroup.textContent = identity.group || '';
      statusGroup.style.display = identity.group ? '' : 'none';
    }
    setIdentityImage(root.querySelector('.sp-status-face'));
    var ta = root.querySelector('.sp-chat textarea');
    if (ta) ta.placeholder = '问问' + name + '…';
    if (stage) stage.setAttribute('aria-label', '摸摸' + name);
    root.setAttribute('aria-label', name + '桌宠');
    var mini = document.querySelector('.site-pet-mini');
    if (mini) {
      var span = mini.querySelector('span');
      if (span) span.textContent = name;
      setIdentityImage(mini.querySelector('img'));
      mini.title = '叫出' + name;
      mini.setAttribute('aria-label', '叫出' + name);
    }
    var restore = document.querySelector('.site-pet-restore');
    if (restore) {
      restore.textContent = name + ' · 桌宠';
      restore.title = '把' + name + '叫回来';
      restore.setAttribute('aria-label', '把' + name + '叫回来');
    }
  }

  function applyIdentity(cfg) {
    var name = String(cfg && cfg.aiReplyName || '').trim().slice(0, 40) || DEFAULT_NAME;
    var image = String(cfg && cfg.aiReplyImageUrl || '').trim();
    var group = String(cfg && cfg.aiReplyGroup || '').trim().slice(0, 40);
    if (name === identity.name && image === identity.image && group === identity.group) return;
    identity = { name: name, image: image, group: group };
    updateIdentityUi();
  }

  function loadIdentity() {
    var z = window.ZeroStack;
    if (z && typeof z.config === 'function') {
      var p = z.config();
      if (p && typeof p.then === 'function') {
        p.then(function (cfg) { applyIdentity(cfg || {}); }).catch(function () {});
      } else {
        applyIdentity(p || {});
      }
      return;
    }
    if (z && z.base) {
      fetch(String(z.base).replace(/\/+$/, '') + '/api/config', { credentials: 'include' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j && j.data) applyIdentity(j.data); })
        .catch(function () {});
      return;
    }
    if (identityTries++ < 6) setTimeout(loadIdentity, 700);
  }

  // ——————————————————————————————————————————————————————————————
  // 启动路径：隐藏 → 轻量把手；手机/省流量 → 头像；否则直接起桌宠
  // ——————————————————————————————————————————————————————————————
  injectCss();
  if (mobile && CFG.mobileMode === 'hidden') return;
  if (layout.hidden) {
    showRestoreTab();
  } else if (mobile && CFG.mobileMode === 'full') {
    boot();
  } else if ((mobile || lowData) && CFG.mobileMode !== 'full' && !expandedThisSession()) {
    showMiniPet();
  } else {
    boot();
  }

  function boot() {
    if (booted) {
      showPet();
      return;
    }
    booted = true;
    injectCss();
    buildDom();
    bindEvents();
    bindPageLinks();
    applyTheme();
    watchTheme();
    state.lastInteraction = Date.now();
    saveState(state);
    place();
    updateDock();
    startIdle();
    sleepTimer = setInterval(sleepWatch, 15000);
    bindLifecycle();
  }

  // ——————————————————————————————————————————————————————————————
  // DOM
  // ——————————————————————————————————————————————————————————————
  function buildDom() {
    root = document.createElement('div');
    root.id = 'site-pet';
    root.className = 'site-pet';
    root.dataset.size = CFG.size;
    root.dataset.spTheme = siteTheme();
    root.setAttribute('role', 'complementary');
    root.setAttribute('aria-label', identityName() + '桌宠');
    root.innerHTML =
      '<div class="sp-bubble" aria-live="polite">' +
        '<div class="sp-bubble-head"><img class="sp-face" alt=""><span class="sp-name">' + identityName() + '</span></div>' +
        '<div class="sp-bubble-body"></div>' +
        '<div class="sp-bubble-foot"></div>' +
      '</div>' +
      '<div class="sp-stage" role="button" tabindex="0" aria-label="摸摸' + identityName() + '">' +
        '<video class="sp-video sp-video-a" muted playsinline webkit-playsinline x5-playsinline x5-video-player-type="h5-page" x5-video-player-fullscreen="false" controlslist="nodownload nofullscreen noremoteplayback" disableremoteplayback disablepictureinpicture tabindex="-1" preload="none"></video>' +
        '<video class="sp-video sp-video-b" muted playsinline webkit-playsinline x5-playsinline x5-video-player-type="h5-page" x5-video-player-fullscreen="false" controlslist="nodownload nofullscreen noremoteplayback" disableremoteplayback disablepictureinpicture tabindex="-1" preload="none"></video>' +
        '<img class="sp-poster" alt="" decoding="async">' +
        '<canvas class="sp-canvas" width="1280" height="720" aria-hidden="true"></canvas>' +
      '</div>' +
      '<div class="sp-dock">' +
        '<button type="button" data-act="chat">聊天</button>' +
        '<button type="button" data-act="feed">喂饭</button>' +
        '<button type="button" data-act="menu">动作</button>' +
        '<button type="button" data-act="status">状态</button>' +
        '<button type="button" data-act="sleep">睡觉</button>' +
        '<button type="button" data-act="hide">隐藏</button>' +
      '</div>' +
      '<div class="sp-panel sp-menu">' +
        '<div class="sp-panel-head"><b>' + identityName() + '的动作</b><button type="button" class="sp-x" data-close="menu" aria-label="关闭">×</button></div>' +
        '<div class="sp-menu-body"></div>' +
        '<div class="sp-credit">动画素材：PC2005-cloud/dsh-pet · MerZlin/dsh-pet-indesktop · CC BY-NC-SA 4.0 · 非商业使用</div>' +
      '</div>' +
      '<form class="sp-panel sp-chat">' +
        '<div class="sp-panel-head"><b>跟' + identityName() + '说点什么</b><button type="button" class="sp-x" data-close="chat" aria-label="关闭">×</button></div>' +
        '<div class="sp-chat-input">' +
          '<textarea rows="2" placeholder="问问' + identityName() + '…（Enter 发送 / Shift+Enter 换行）"></textarea>' +
          '<button type="submit" class="sp-send" aria-label="发送">发送</button>' +
        '</div>' +
      '</form>' +
      '<div class="sp-panel sp-status" aria-label="状态面板">' +
        '<div class="sp-panel-head"><b>' + identityName() + '的状态</b><button type="button" class="sp-x" data-close="status" aria-label="关闭">×</button></div>' +
        '<div class="sp-status-id">' +
          '<img class="sp-status-face" alt="">' +
          '<div class="sp-status-who"><b class="sp-status-name">' + identityName() + '</b><span class="sp-status-group"></span></div>' +
          '<span class="sp-status-asleep">醒着</span>' +
        '</div>' +
        '<div class="sp-status-mood">心情 <b class="sp-status-mood-val">平静</b></div>' +
        '<div class="sp-status-meter"><div class="sp-status-meter-head"><span>精力</span><b class="sp-status-energy-val">0</b></div><div class="sp-status-bar"><i class="sp-status-fill sp-status-energy"></i></div></div>' +
        '<div class="sp-status-meter"><div class="sp-status-meter-head"><span>饱腹</span><b class="sp-status-satiety-val">0</b></div><div class="sp-status-bar"><i class="sp-status-fill sp-status-satiety"></i></div></div>' +
        '<div class="sp-status-meter"><div class="sp-status-meter-head"><span>无聊</span><b class="sp-status-boredom-val">0</b></div><div class="sp-status-bar"><i class="sp-status-fill sp-status-boredom"></i></div></div>' +
        '<div class="sp-status-stats"><span>互动 <b class="sp-status-interactions">0</b></span><span>被摸 <b class="sp-status-pets">0</b></span><span>上次离开 <b class="sp-status-away">0</b>h</span></div>' +
        '<div class="sp-status-engine"></div>' +
        '<div class="sp-status-actions"><button type="button" data-status-act="feed">喂饭</button><button type="button" data-status-act="sleep">睡觉</button><button type="button" data-status-act="chat">聊天</button></div>' +
      '</div>';
    document.body.appendChild(root);

    stage = root.querySelector('.sp-stage');
    vA = root.querySelector('.sp-video-a');
    vB = root.querySelector('.sp-video-b');
    poster = root.querySelector('.sp-poster');
    canvasEl = root.querySelector('.sp-canvas');
    canvasCtx = canvasEl ? canvasEl.getContext('2d') : null;
    if (useMobileCanvas && !canvasCtx) { useMobileCanvas = false; usePosterOnly = true; }
    bubbleEl = root.querySelector('.sp-bubble');
    bubbleBody = root.querySelector('.sp-bubble-body');
    bubbleFoot = root.querySelector('.sp-bubble-foot');
    dock = root.querySelector('.sp-dock');
    menu = root.querySelector('.sp-menu');
    chat = root.querySelector('.sp-chat');
    statusPanel = root.querySelector('.sp-status');
    front = vA;
    back = vB;

    setIdentityImage(root.querySelector('.sp-face'));
    setIdentityImage(root.querySelector('.sp-status-face'));
    poster.src = '/whale-pet/poster.webp?v=' + PET_VER;
    poster.addEventListener('error', function () {
      if (poster.dataset.pngFallback === '1') { poster.style.display = 'none'; return; }
      poster.dataset.pngFallback = '1';
      poster.src = '/whale-pet/poster.png?v=' + PET_VER;
    });

    if (!CFG.dockEnabled) dock.style.display = 'none';
    if (!CFG.feedEnabled) {
      var feedBtn = dock.querySelector('[data-act="feed"]');
      if (feedBtn) feedBtn.style.display = 'none';
    }
    if (!CFG.sleepEnabled) {
      var sleepBtn = dock.querySelector('[data-act="sleep"]');
      if (sleepBtn) sleepBtn.style.display = 'none';
    }
    if (!CFG.creditEnabled) {
      var credit = menu.querySelector('.sp-credit');
      if (credit) credit.style.display = 'none';
    }

    buildMenu();
    loadIdentity();
    if (usePosterOnly) {
      stage.classList.add('sp-poster-only');
      vA.style.display = 'none';
      vB.style.display = 'none';
    } else if (useMobileCanvas) {
      stage.classList.add('sp-canvas-mode');
      initMobileSprites();
    }
  }

  var spriteManifest = null;
  var spriteImages = {};
  var spriteLoads = {};
  var spriteAnim = null;
  var spriteRaf = 0;
  var spritePending = null;
  var spriteReq = 0;
  var spriteOrder = [];
  // 除待机外常驻几张精灵表：1 张约 54MB 位图，deviceMemory 小的机器只留 1 张。
  var spriteKeep = (navigator.deviceMemory && navigator.deviceMemory >= 4) ? 2 : 1;

  function initMobileSprites() {
    if (!useMobileCanvas || !canvasEl || !canvasCtx) { fallbackPosterOnly(); return; }
    if (!spriteRaf) startSpriteLoop();
    fetch('/whale-pet/mobile/manifest.json?v=' + SPRITE_VER, { cache: 'force-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('manifest');
        return r.json();
      })
      .then(function (m) {
        spriteManifest = m || {};
        return loadSpriteImage('idle');
      })
      .then(function () {
        var p = spritePending;
        spritePending = null;
        if (p) playMobileSprite(p.key, p.opts);
        else playMobileSprite('idle', { loop: true });
        // 精灵模式下 startIdle 的开场常被 hasPlayed 提前挡掉，自动动作的链路要在这里接上，
        // 否则第一张预取的表永远排不上。
        if (booted && !chainTimer) scheduleNext();
      })
      .catch(function () { fallbackPosterOnly(); });
  }

  function loadSpriteImage(key) {
    if (spriteImages[key]) return Promise.resolve(spriteImages[key]);
    if (spriteLoads[key]) return spriteLoads[key];
    var info = spriteManifest && spriteManifest[key];
    if (!info) return Promise.reject(new Error('no sprite ' + key));
    var p = new Promise(function (resolve, reject) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () {
        // onload 只代表字节到位，位图可能还没解码；这时 drawImage 会画空一帧，
        // 表现就是动作切换瞬间「闪一下」。先 decode() 再进缓存。
        var store = function () {
          spriteImages[key] = img;
          spriteOrder = spriteOrder.filter(function (k) { return k !== key; });
          spriteOrder.push(key);
          // 常驻上限：待机那张永远留着，其余按内存大小决定留几张。
          // 一张 13MP 位图约 54MB，内存小的手机留三张就卡成慢动作。
          var playing = spriteAnim ? spriteAnim.key : null;
          var keep = 1 + spriteKeep + (playing && playing !== 'idle' ? 1 : 0);
          while (spriteOrder.length > keep) {
            var old = spriteOrder.shift();
            if (old === 'idle' || old === playing) { spriteOrder.push(old); continue; }
            delete spriteImages[old];
            delete spriteLoads[old];
          }
          resolve(img);
        };
        if (img.decode) img.decode().then(store, store);
        else store();
      };
      img.onerror = function () {
        delete spriteLoads[key];
        reject(new Error('sprite ' + key));
      };
      img.src = '/whale-pet/mobile/' + info.file + '?v=' + SPRITE_VER;
    });
    spriteLoads[key] = p;
    return p;
  }

  // 一张精灵表约 1MB，等用户点了再下载就是「点了没反应」。空闲时先把下一个要演的取好，
  // 常驻仍只有待机 + 一张，省内存也省流量；省流量模式不预取。
  function warmSprite(key) {
    if (!useMobileCanvas || !spriteManifest || lowData || !key || key === 'idle') return;
    if (spriteImages[key] || spriteLoads[key]) return;
    loadSpriteImage(key).catch(function () {});
  }

  function playMobileSprite(key, opts) {
    opts = opts || {};
    var clip = CLIPS[key];
    if (!clip) return;
    var token = ++spriteReq;
    if (!spriteManifest) {
      spritePending = { key: key, opts: opts, token: token };
      return;
    }
    var start = function () {
      if (token !== spriteReq) return;
      startSprite(key, opts);
    };
    if (spriteImages[key]) { start(); return; }
    spritePending = { key: key, opts: opts, token: token };
    loadSpriteImage(key).then(function () {
      if (!spritePending || spritePending.token !== token) return;
      var q = spritePending;
      spritePending = null;
      startSprite(q.key, q.opts);
    }).catch(function () {
      if (key === 'idle') fallbackPosterOnly();
      else if (token === spriteReq) playMobileSprite('idle', { loop: true });
    });
  }

  function startSprite(key, opts) {
    var info = spriteManifest && spriteManifest[key];
    var img = spriteImages[key];
    var clip = CLIPS[key];
    if (!info || !img || !clip) { fallbackPosterOnly(); return; }
    var loop = !!(clip.loop || opts.loop);
    var dur = loop ? info.dur : (clip.max ? Math.min(info.dur, clip.max / 1000) : info.dur);
    if (!(dur > 0)) dur = info.dur;
    var frames = loop ? info.frames : Math.max(1, Math.min(info.frames, Math.round(info.frames * dur / info.dur)));
    spriteAnim = {
      key: key, info: info, img: img, loop: loop, frames: frames, dur: dur,
      start: (window.performance && performance.now ? performance.now() : Date.now()),
      last: -1, done: false, endAt: 0, opts: opts,
    };
    hasPlayed = true;
    active = { key: key, clip: clip };
    syncSpriteCanvasSize();
    drawSpriteFrame(0);
    canvasEl.classList.add('sp-on');
    poster.classList.add('sp-hidden');
    if (opts.onStart) opts.onStart();
  }

  // 画布内部分辨率要跟屏幕物理像素对齐：固定 1280×720 时浏览器要先做一层大幅缩小，
  // 手机端会走低质量 mipmap 采样，人物就糊了。低端机绘制一帧太贵时再自适应降一档，
  // 免得帧率被绘制拖成「慢动作」。
  var spriteScale = 1;
  var spriteDrawAvg = 0;
  var spriteScaleAt = 0;

  function syncSpriteCanvasSize() {
    if (!canvasEl || !canvasCtx) return;
    var dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    var cssH = canvasEl.getBoundingClientRect().height || 240;
    var h = Math.max(96, Math.min(Math.round(1080 * spriteScale), Math.round(cssH * dpr)));
    var w = Math.round(h * 16 / 9);
    if (canvasEl.width !== w || canvasEl.height !== h) {
      canvasEl.width = w;
      canvasEl.height = h;
    }
    canvasCtx.imageSmoothingEnabled = true;
    canvasCtx.imageSmoothingQuality = spriteScale < 1 ? 'medium' : 'high';
  }

  // 一帧绘制耗时中位数超过 42ms（≈24fps 都追不上）就降分辨率，回到 14ms 以下再升回去。
  function tuneSpriteScale(ms) {
    spriteDrawAvg = spriteDrawAvg ? spriteDrawAvg * 0.7 + ms * 0.3 : ms;
    var now = Date.now();
    if (now - spriteScaleAt < 1500) return;
    if (spriteDrawAvg > 42 && spriteScale > 0.5) {
      spriteScale = Math.max(0.5, spriteScale * 0.75);
      spriteScaleAt = now;
      syncSpriteCanvasSize();
    } else if (spriteDrawAvg < 14 && spriteScale < 1) {
      spriteScale = Math.min(1, spriteScale * 1.25);
      spriteScaleAt = now;
      syncSpriteCanvasSize();
    }
  }

  function drawSpriteFrame(idx) {
    if (!canvasCtx || !spriteAnim) return;
    var a = spriteAnim, info = a.info;
    if (!a.img || !a.img.complete || !a.img.naturalWidth) return;
    var gx = idx % info.cols;
    var gy = Math.floor(idx / info.cols);
    try {
      var t0 = window.performance && performance.now ? performance.now() : 0;
      var cw = canvasEl.width || 1280, ch = canvasEl.height || 720;
      canvasCtx.clearRect(0, 0, cw, ch);
      // 裁过空白边的精灵表要贴回它在 16:9 画布里的原位，人物才不会左右飘；
      // 没带 ref 的旧表仍整格铺满。
      var dx = 0, dy = 0, dw = cw, dh = ch;
      if (info.ref && info.ref[0] && info.ref[1]) {
        dx = (info.ox || 0) / info.ref[0] * cw;
        dy = (info.oy || 0) / info.ref[1] * ch;
        dw = info.fw / info.ref[0] * cw;
        dh = info.fh / info.ref[1] * ch;
      }
      canvasCtx.drawImage(a.img, gx * info.fw, gy * info.fh, info.fw, info.fh, dx, dy, dw, dh);
      if (t0) tuneSpriteScale(performance.now() - t0);
    } catch (e) { fallbackPosterOnly(); }
  }

  function startSpriteLoop() {
    if (!useMobileCanvas || spriteRaf) return;
    var tick = function (now) {
      spriteRaf = requestAnimationFrame(tick);
      if (!spriteAnim || !root || root.style.display === 'none') return;
      var a = spriteAnim;
      var elapsed = (now - a.start) / 1000;
      var idx = a.loop
        ? Math.floor(elapsed / a.info.dur * a.info.frames) % a.info.frames
        : Math.floor(elapsed / a.dur * a.frames);
      if (!a.loop) idx = Math.min(a.frames - 1, Math.max(0, idx));
      if (idx !== a.last) {
        a.last = idx;
        drawSpriteFrame(idx);
      }
      if (!a.loop && idx >= a.frames - 1 && !a.done) {
        a.done = true;
        a.endAt = now;
      }
      if (a.done && typeof a.done === 'boolean' && now - a.endAt > 160) {
        var endOpts = a.opts;
        a.done = 'called';
        spriteAnim = null;
        if (endOpts.onEnd) endOpts.onEnd();
        else { active = null; resumeIdle(); }
      }
    };
    spriteRaf = requestAnimationFrame(tick);
  }

  function fallbackPosterOnly() {
    usePosterOnly = true;
    useMobileCanvas = false;
    engineName = 'poster';
    spriteAnim = null;
    spritePending = null;
    if (spriteRaf) cancelAnimationFrame(spriteRaf);
    spriteRaf = 0;
    if (canvasEl) canvasEl.style.display = 'none';
    try { if (vA) vA.pause(); if (vB) vB.pause(); } catch (e) {}
    if (vA) vA.style.display = 'none';
    if (vB) vB.style.display = 'none';
    if (stage) { stage.classList.remove('sp-canvas-mode'); stage.classList.add('sp-poster-only'); }
    if (poster) { poster.classList.remove('sp-hidden'); poster.src = '/whale-pet/poster.webp?v=' + PET_VER; }
  }

  function buildMenu() {
    var body = menu.querySelector('.sp-menu-body');
    GROUPS.forEach(function (group) {
      var title = document.createElement('div');
      title.className = 'sp-group-title';
      title.textContent = group.title;
      body.appendChild(title);
      var grid = document.createElement('div');
      grid.className = 'sp-grid';
      group.items.forEach(function (key) {
        if (!CLIPS[key]) return;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'sp-chip';
        b.dataset.key = key;
        b.textContent = CLIPS[key].label;
        b.title = CLIPS[key].label;
        b.addEventListener('click', function () {
          hideBubble();
          if (menuOpen) closePanels();
          play(key, { onEnd: resumeIdle });
        });
        // 手指按下/鼠标划过就先把这张表取好，点下去立刻有动作。
        b.addEventListener('pointerenter', function () { warmSprite(key); });
        b.addEventListener('pointerdown', function () { warmSprite(key); });
        grid.appendChild(b);
      });
      body.appendChild(grid);
    });
  }

  // ——————————————————————————————————————————————————————————————
  // 布局 / 尺寸
  // ——————————————————————————————————————————————————————————————
  function place() {
    if (!root) return;
    var w = root.offsetWidth;
    var h = root.offsetHeight;
    var x = Number.isFinite(Number(layout.x)) ? Number(layout.x) : (CFG.corner === 'right' ? window.innerWidth - w - 10 : 10);
    var y = Number.isFinite(Number(layout.y)) ? Number(layout.y) : window.innerHeight - h - 44;
    x = clamp(x, 8, Math.max(8, window.innerWidth - w - 8));
    y = clamp(y, 110, Math.max(110, window.innerHeight - h - 38));
    root.style.left = Math.round(x) + 'px';
    root.style.top = Math.round(y) + 'px';
    if (bubbleEl.classList.contains('sp-on')) positionBubble();
    if (menuOpen) positionPanel(menu);
    if (chatOpen) positionPanel(chat);
    if (statusOpen) positionPanel(statusPanel);
  }

  function savePosition() {
    if (!root) return;
    layout.x = Math.round(parseFloat(root.style.left) || 0);
    layout.y = Math.round(parseFloat(root.style.top) || 0);
    saveLayout({ x: layout.x, y: layout.y });
  }

  function positionBubble() {
    if (!bubbleEl || !root) return;
    bubbleEl.classList.remove('sp-below');
    bubbleEl.style.top = '';
    bubbleEl.style.bottom = '';
    bubbleEl.style.left = '0px';
    var br = bubbleEl.getBoundingClientRect();
    var sr = stage.getBoundingClientRect();
    var rr = root.getBoundingClientRect();
    var margin = 8;
    var gap = 4;
    var left = sr.left + sr.width / 2 - br.width / 2;
    left = clamp(left, margin, Math.max(margin, window.innerWidth - br.width - margin));
    bubbleEl.style.left = (left - sr.left) + 'px';
    var arrow = (sr.left + sr.width / 2) - left;
    bubbleEl.style.setProperty('--sp-arrow-x', Math.max(14, Math.min(br.width - 14, arrow)) + 'px');

    // 宠物被拖到屏幕上边缘时，默认在头顶的气泡会被裁掉；有空间就翻到脚下。
    if (br.top < margin) {
      var dockVisible = dock && getComputedStyle(dock).display !== 'none';
      var dockRect = dockVisible ? dock.getBoundingClientRect() : null;
      var belowStart = (dockRect ? dockRect.bottom : sr.bottom) + gap;
      var belowSpace = window.innerHeight - belowStart - margin;
      if (belowSpace >= br.height) {
        bubbleEl.classList.add('sp-below');
        bubbleEl.style.top = Math.round(belowStart - rr.top) + 'px';
        bubbleEl.style.bottom = 'auto';
      } else {
        bubbleEl.style.top = Math.round(margin - rr.top) + 'px';
        bubbleEl.style.bottom = 'auto';
      }
    }
  }

  function positionPanel(el) {
    if (!el || !root) return;
    var sideable = (el === chat && chatOpen) || (el === menu && menuOpen) || (el === statusPanel && statusOpen);
    if (sideable) {
      if (positionSidePanel(el)) return;
      el.classList.remove('sp-side');
    }
    positionPanelGeneric(el);
  }

  function positionSidePanel(el) {
    if (!el || !root) return false;
    el.classList.add('is-on');
    el.style.maxHeight = 'none';
    el.style.top = '';
    el.style.bottom = '';
    el.style.left = '';
    var gap = 12;
    var margin = 12;
    var sr = stage.getBoundingClientRect();
    var rr = root.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var w = el.offsetWidth;
    var natural = el.scrollHeight;
    var rightSpace = vw - sr.right - gap - margin;
    var leftSpace = sr.left - gap - margin;
    var side = rightSpace >= w && rightSpace >= leftSpace ? 'right' : leftSpace >= w ? 'left' : '';
    if (!side) return false;
    var maxCap = Math.max(160, Math.min(480, vh - margin * 2));
    var height = Math.min(natural, maxCap);
    var top = clamp(sr.bottom - height, margin, Math.max(margin, vh - height - margin));
    var left = side === 'right' ? sr.right + gap : sr.left - gap - w;
    el.style.maxHeight = height + 'px';
    el.style.top = Math.round(top - rr.top) + 'px';
    el.style.bottom = 'auto';
    el.style.left = Math.round(left - rr.left) + 'px';
    el.classList.add('sp-side');
    el.classList.remove('is-below');
    return true;
  }

  function positionPanelGeneric(el) {
    if (!el || !root) return;
    el.classList.add('is-on');
    var gap = 8;
    var margin = 8;
    var sr = stage.getBoundingClientRect();
    var rr = root.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    el.style.maxHeight = 'none';
    var w = el.offsetWidth;
    var left = sr.left + sr.width / 2 - w / 2;
    left = clamp(left, margin, Math.max(margin, vw - w - margin));
    el.style.left = (left - rr.left) + 'px';

    var natural = el.scrollHeight;
    var maxCap = Math.max(180, Math.min(480, vh - margin * 2));
    var dockVisible = dock && getComputedStyle(dock).display !== 'none';
    var dockRect = dockVisible ? dock.getBoundingClientRect() : null;
    // 气泡永远留在头顶，面板往上让位 —— 不是把气泡顶到输入框上面去。
    var bubbleHold = 0;
    if (bubbleEl && bubbleEl.classList.contains('sp-on') && !bubbleEl.classList.contains('sp-below')) {
      bubbleHoldSticky = bubbleEl.getBoundingClientRect().height + 6;
    }
    bubbleHold = bubbleHoldSticky;
    var above = sr.top - gap - margin - bubbleHold;
    var belowStart = (dockRect ? dockRect.bottom : sr.bottom) + gap;
    var below = vh - belowStart - margin;
    var useBelow = natural > above && below > above;
    var space = Math.max(140, useBelow ? below : above);
    el.style.maxHeight = Math.min(natural, maxCap, space) + 'px';

    if (useBelow) {
      el.style.top = Math.round(belowStart - rr.top) + 'px';
      el.style.bottom = 'auto';
      el.classList.add('is-below');
    } else {
      el.style.top = 'auto';
      el.style.bottom = Math.round(rr.bottom - sr.top + gap + bubbleHold) + 'px';
      el.classList.remove('is-below');
    }
  }

  // ——————————————————————————————————————————————————————————————
  // 视频双缓冲与动画链
  // ——————————————————————————————————————————————————————————————
  function cancelIdleStart() {
    idleStartSeq++;
    if (idleStartTimer) {
      clearTimeout(idleStartTimer);
      idleStartTimer = null;
    }
  }

  function startIdle() {
    if (state.asleep) {
      play('sleep-loop', { loop: true, force: true });
      return;
    }
    if (usePosterOnly) {
      play('idle', { loop: true });
      if (!maybeGreet()) scheduleNext();
      return;
    }
    cancelIdleStart();
    var token = idleStartSeq;
    var began = false;
    var begin = function () {
      if (token !== idleStartSeq || began) return;
      began = true;
      idleStartTimer = null;
      if (!booted || state.asleep || drag || panelsOpen() || hasPlayed) return;
      play('idle', { loop: true });
      if (!maybeGreet()) scheduleNext();
    };
    var arm = function () {
      if (token !== idleStartSeq) return;
      if (window.requestIdleCallback) window.requestIdleCallback(begin, { timeout: 700 });
      setTimeout(begin, 350);
    };
    var start = function () {
      if (token !== idleStartSeq) return;
      if (idleStartTimer) {
        clearTimeout(idleStartTimer);
        idleStartTimer = null;
      }
      arm();
    };
    if (document.readyState === 'complete') start();
    else {
      window.addEventListener('load', start, { once: true });
      idleStartTimer = setTimeout(start, 3000);
    }
  }

  function play(key, opts) {
    opts = opts || {};
    if (key !== 'idle') cancelIdleStart();
    var clip = CLIPS[key];
    if (!clip) return;
    if (!opts.force && active && active.key === key && (clip.loop || opts.loop)) {
      if (opts.onStart) opts.onStart();
      return;
    }
    if (useMobileCanvas) { playMobileSprite(key, opts); return; }
    if (usePosterOnly) {
      active = { key: key, clip: clip };
      return;
    }
    pauseChain();
    if (cutTimer) {
      clearTimeout(cutTimer);
      cutTimer = null;
    }
    var token = ++playSeq;
    var el = back;
    if (!el) return;
    var swapped = false;
    el.loop = !!(clip.loop || opts.loop);
    el.muted = true;
    el.playsInline = true;
    el.preload = 'auto';
    el.onplaying = null;
    el.onended = null;
    el.onerror = null;
    el.src = ANIM_BASE + clip.f + '?v=' + PET_VER;
    el.load();

    var finish = function () {
      if (token !== playSeq) return;
      if (cutTimer) {
        clearTimeout(cutTimer);
        cutTimer = null;
      }
      if (opts.onEnd) opts.onEnd();
      else resumeIdle();
    };

    el.onplaying = function () {
      if (token !== playSeq || swapped) return;
      swapped = true;
      el.classList.add('sp-front');
      if (front && front !== el) front.classList.remove('sp-front');
      var old = front;
      front = el;
      back = old;
      active = { key: key, clip: clip, el: el };
      hasPlayed = true;
      videoErrStrikes = 0;
      if (!useMobileCanvas) poster.classList.add('sp-hidden');
      setTimeout(function () {
        if (old && old !== front) old.pause();
      }, 280);
      if (opts.onStart) opts.onStart();
      scheduleAlphaCheck(el);
      var maxMs = opts.max != null ? opts.max : clip.max;
      if (!el.loop && maxMs) {
        cutTimer = setTimeout(finish, Math.min(maxMs, 12000));
      }
    };

    el.onended = function () {
      if (token !== playSeq || el.loop) return;
      finish();
    };

    el.onerror = function () {
      if (token !== playSeq) return;
      videoError(key);
    };

    var attemptPlay = function (attempt) {
      var p = el.play();
      if (p && p.catch) {
        p.catch(function (err) {
          if (token !== playSeq) return;
          if (err && err.name === 'AbortError' && attempt < 2) {
            setTimeout(function () {
              if (token === playSeq) attemptPlay(attempt + 1);
            }, 90);
            return;
          }
          if (err && err.name === 'NotAllowedError') {
            if (!hasPlayed) {
              showPoster();
              armAutoplay();
            }
            return;
          }
          videoError(key);
        });
      }
    };
    attemptPlay(0);
  }

  function showPoster() {
    if (!poster || hasPlayed) return;
    poster.classList.remove('sp-hidden');
  }

  function armAutoplay() {
    if (armAutoplay.armed) return;
    armAutoplay.armed = true;
    var fn = function () {
      document.removeEventListener('pointerdown', fn, true);
      armAutoplay.armed = false;
      play('idle', { loop: true, force: true });
      scheduleNext();
    };
    document.addEventListener('pointerdown', fn, true);
  }

  // WebM 到底有没有透明通道，只能把首帧画进 canvas 取像素才知道：安卓硬件解码器
  // 丢掉 alpha 时画面会变成一块不透明底，国产内核接管视频层也是同样表现。
  // 取到「角透明 / 中心不透明」才判定通过；判不过就换 Canvas 精灵引擎。
  var alphaChecked = false;
  var alphaTries = 0;
  var alphaOpaque = 0;
  var videoErrStrikes = 0;

  function scheduleAlphaCheck(video) {
    if (alphaChecked || useMobileCanvas || alphaTries >= 6) return;
    alphaTries++;
    setTimeout(function () {
      // 等到真的呈现了一帧再取样，避免读到「只有颜色没有 alpha」的中间态。
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(function () { verifyVideoAlpha(video); });
      else setTimeout(function () { verifyVideoAlpha(video); }, 120);
    }, 180 * alphaTries);
  }

  function verifyVideoAlpha(video) {
    if (alphaChecked || !video || !video.videoWidth || video.readyState < 2) return;
    var corner, center;
    try {
      var c = document.createElement('canvas');
      c.width = 24;
      c.height = 24;
      var x = c.getContext('2d', { willReadFrequently: true });
      if (!x) return;
      x.drawImage(video, 0, 0, 24, 24);
      var d = x.getImageData(0, 0, 24, 24).data;
      corner = d[3];
      center = d[(12 * 24 + 12) * 4 + 3];
    } catch (e) {
      // 取不到像素（画布被污染等）就不改播放策略。
      alphaChecked = true;
      return;
    }
    if (corner < 100 && center > 100) { alphaChecked = true; return; }
    if (corner >= 100 && center > 100) {
      // 连读两次「整幅不透明」才认定丢了 alpha：第一次可能只是解码还没走完，
      // 误判会把好浏览器踢进 10fps 的精灵模式。
      alphaOpaque++;
      if (alphaOpaque >= 2) { degradeToSprites(); return; }
    }
    scheduleAlphaCheck(video);
  }

  function degradeToSprites() {
    if (useMobileCanvas) return;
    alphaChecked = true;
    useMobileCanvas = true;
    usePosterOnly = false;
    engineName = 'canvas';
    playSeq++;
    active = null;
    if (cutTimer) { clearTimeout(cutTimer); cutTimer = null; }
    [vA, vB].forEach(function (v) {
      if (!v) return;
      try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {}
      v.style.display = 'none';
    });
    if (stage) {
      stage.classList.remove('sp-poster-only');
      stage.classList.add('sp-canvas-mode');
    }
    if (poster) poster.classList.add('sp-hidden');
    initMobileSprites();
  }

  function videoError(key) {
    console.warn('[鱼鱼] 动画加载失败：' + key);
    if (key !== 'idle') { resumeIdle(); return; }
    // 刚导航时上一次加载被打断，会让 idle 报一次假错；先重试一次再考虑降级，
    // 否则好好的 WebM 会被永久换成 10fps 的精灵。
    videoErrStrikes++;
    if (videoErrStrikes < 2) {
      setTimeout(function () {
        if (booted && !useMobileCanvas && !usePosterOnly && !state.asleep) play('idle', { loop: true, force: true });
      }, 1200);
      return;
    }
    videoFailed();
  }

  function videoFailed() {
    if (usePosterOnly) return;
    if (useMobileCanvas) {
      fallbackPosterOnly();
      return;
    }
    // 视频播不出来先换 Canvas 精灵，精灵也拿不到再由 initMobileSprites 退回海报。
    active = null;
    if (chainTimer) {
      clearTimeout(chainTimer);
      chainTimer = null;
    }
    degradeToSprites();
    console.warn('[鱼鱼] 透明动画不可用，已改用静态帧精灵');
  }

  function resumeIdle() {
    if (!booted || state.asleep || drag) return;
    play('idle', { loop: true });
    scheduleNext();
  }

  function scheduleNext() {
    if (usePosterOnly || !CFG.autoActions) return;
    if (chainTimer) {
      clearTimeout(chainTimer);
      chainTimer = null;
    }
    if (!booted || state.asleep || drag || panelsOpen()) return;
    var delay = CFG.idleMin * 1000 + Math.random() * Math.max(0, CFG.idleMax - CFG.idleMin) * 1000;
    var nextKey = pickRandom();
    warmSprite(nextKey);
    chainTimer = setTimeout(function () {
      chainTimer = null;
      if (state.asleep || drag || panelsOpen() || document.hidden) {
        scheduleNext();
        return;
      }
      play(nextKey, {
        onEnd: function () {
          resumeIdle();
        },
      });
    }, delay);
  }

  function pauseChain() {
    if (chainTimer) {
      clearTimeout(chainTimer);
      chainTimer = null;
    }
  }

  function pickRandom() {
    var pool = RANDOM_CLIPS;
    if (pool.length < 2) return pool[0] || 'idle';
    var key = lastRandom;
    var guard = 0;
    while (key === lastRandom && guard++ < 6) key = pool[Math.floor(Math.random() * pool.length)];
    lastRandom = key;
    return key;
  }

  // ——————————————————————————————————————————————————————————————
  // 事件 / 拖拽 / 面板
  // ——————————————————————————————————————————————————————————————
  function bindEvents() {
    stage.addEventListener('pointerdown', onStageDown);
    stage.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        poke();
      }
    });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    // 指针抬起丢了（切标签、被系统手势打断）时，drag 会一直挂着，之后所有
    // 「回到待机」都会被挡住，看起来就是宠物再也不动了。
    var dropStuckDrag = function () { if (drag) onPointerUp({ pointerId: drag.id }); };
    window.addEventListener('blur', dropStuckDrag);
    document.addEventListener('visibilitychange', function () { if (document.hidden) dropStuckDrag(); });
    window.addEventListener('resize', function () {
      place();
      if (bubbleEl.classList.contains('sp-on')) positionBubble();
      if (useMobileCanvas && spriteAnim) { syncSpriteCanvasSize(); drawSpriteFrame(Math.max(0, spriteAnim.last)); }
    });

    dock.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'chat') { if (chatOpen) closePanels(); else openChat(); }
      else if (act === 'feed') {
        closePanels();
        feed();
      } else if (act === 'menu') {
        if (menuOpen) closePanels();
        else openMenu();
      } else if (act === 'status') {
        if (statusOpen) closePanels();
        else openStatus();
      } else if (act === 'sleep') {
        if (state.asleep) wake();
        else goSleep();
      } else if (act === 'hide') hidePet();
    });

    menu.addEventListener('click', function (e) {
      if (e.target.closest('[data-close="menu"]')) closePanels();
    });
    chat.addEventListener('click', function (e) {
      if (e.target.closest('[data-close="chat"]')) closePanels();
    });
    statusPanel.addEventListener('click', function (e) {
      if (e.target.closest('[data-close="status"]')) { closePanels(); return; }
      var b = e.target.closest('[data-status-act]');
      if (!b) return;
      var act = b.getAttribute('data-status-act');
      if (act === 'feed') { closePanels(); feed(); }
      else if (act === 'sleep') { if (state.asleep) { closePanels(); wake(); } else { closePanels(); goSleep(); } }
      else if (act === 'chat') { closePanels(); openChat(); }
    });
    var ta = chat.querySelector('textarea');
    chat.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = ta.value.trim();
      if (!text) {
        ta.focus();
        return;
      }
      ta.value = '';
      ask(text);
      ta.focus();
    });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closePanels();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        chat.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });

    document.addEventListener('pointerdown', function (e) {
      if (!panelsOpen()) return;
      if (root.contains(e.target)) {
        if (stage.contains(e.target)) closePanels();
        return;
      }
      closePanels();
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePanels();
    });

    document.addEventListener('visibilitychange', function () {
      if (!booted) return;
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        try { if (front) front.pause(); } catch (e) {}
      } else if (front) {
        var p = front.play();
        if (p && p.catch) p.catch(function () {});
        if (!state.asleep && !panelsOpen() && !drag && !chainTimer) scheduleNext();
        if (hiddenAt && Date.now() - hiddenAt > 30000 && !state.asleep && !drag && !panelsOpen()) {
          hiddenAt = 0;
          localReaction('click-wave', pickLine(['你回来啦，我刚刚在等你。', '水洼都快凉了，你才回来。']));
        }
      }
    });
  }


  // ——————————————————————————————————————————————————————————————
  // 页面联动：滚动进度 / 点赞 / 评论 / 回到顶部
  // ——————————————————————————————————————————————————————————————
  function bindPageLinks() {
    if (CFG.scrollReaction) {
      window.addEventListener('scroll', onPageScroll, { passive: true });
      requestAnimationFrame(onPageScroll);
    }
    if (CFG.likeReaction || CFG.backTopReaction || CFG.commentReaction) {
      document.addEventListener('click', onPageClick, true);
    }
    if (CFG.commentReaction) {
      document.addEventListener('keydown', onCommentKey, true);
      if (document.querySelector('zero-comment')) startCommentPoll();
      else {
        var commentObserver = new MutationObserver(function () {
          if (!document.querySelector('zero-comment')) return;
          commentObserver.disconnect();
          startCommentPoll();
        });
        commentObserver.observe(document.body, { childList: true, subtree: true });
      }
    }
    document.addEventListener('focusin', onPageFocus, true);
    bindSearchLinks();
    bindFormInteractions();
  }

  function bindSearchLinks() {
    bindSearchInput(document.getElementById('searchInput'), '站内');
    bindSearchInput(document.getElementById('archiveSearch'), '归档');
  }

  function searchStatusCount(scope) {
    var el = document.getElementById(scope === '归档' ? 'archiveSearchStatus' : 'searchStatus');
    var text = el ? String(el.textContent || '') : '';
    var hit = text.match(/(\d+)\s*(?:篇|条)/);
    if (hit) return Number(hit[1]);
    if (/没有找到|没翻到|无匹配|没有匹配/.test(text)) return 0;
    return null;
  }

  function searchKeywordLine(q, count, scope) {
    var label = '「' + q.slice(0, 24) + '」';
    var where = scope === '归档' ? '归档里' : '站内';
    if (count === 0) return pickLine([label + '没翻到，换个词试试？', '这个关键词我翻遍了水洼也没见着。']);
    if (typeof count === 'number' && count > 0) return where + '找到 ' + count + ' 篇' + label + '，我陪你翻。';
    return '在' + where + '找' + label + '呀，我帮你翻翻。';
  }

  function bindSearchInput(input, scope) {
    if (!input) return;
    var timer = 0;
    var lastQ = '';
    var evaluate = function () {
      timer = 0;
      var q = String(input.value || '').trim();
      if (q.length < 2 || q === lastQ) return;
      lastQ = q;
      var tries = 0;
      var finish = function () {
        var count = searchStatusCount(scope);
        var statusEl = document.getElementById(scope === '归档' ? 'archiveSearchStatus' : 'searchStatus');
        if (count === null && tries++ < 4 && /搜索中/.test(statusEl ? statusEl.textContent : '')) {
          setTimeout(finish, 450);
          return;
        }
        localReaction('look', searchKeywordLine(q, count, scope), true);
      };
      setTimeout(finish, 700);
    };
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(evaluate, 250);
    });
    input.addEventListener('search', function () {
      clearTimeout(timer);
      evaluate();
    });
    setTimeout(function () {
      if (String(input.value || '').trim().length >= 2) {
        lastQ = '';
        evaluate();
      }
    }, 1200);
  }

  function bindFormInteractions() {
    var forms = document.querySelectorAll('#zeroApplyForm, .zero-subscribe-form');
    Array.prototype.forEach.call(forms, function (form) {
      var msg = form.querySelector('.za-msg, .zsf-msg');
      form.addEventListener('submit', function () {
        setTimeout(function () {
          var text = msg ? String(msg.textContent || '').trim() : '';
          if (!text) return;
          if (/已提交|等待站主审核|成功|确认邮件已发出|已订阅|已经在/.test(text)) {
            localReaction('celebrate', pickLine(['收到啦，我替你记着。', '这一步成了，等下一步就好。']), true);
          } else if (/填|地址|邮箱|格式|失败|错误|没|请|稍后/.test(text)) {
            localReaction('look', pickLine(['好像还差一点，看看提示？', '别急，我陪你再试一次。']), true);
          }
        }, 1500);
      });
    });
  }

  function startCommentPoll() {
    if (commentWatch.poll) return;
    commentWatch.poll = true;
    // 等评论列表自己加载稳定后再开始监控，避免把页面初次加载的已有评论当成“新评论”。
    setTimeout(function () {
      seedCommentCount();
      setInterval(function () {
        if (!commentWatch.ready) seedCommentCount();
        else checkCommentCount();
      }, 2500);
    }, 5000);
  }

  function onPageFocus(e) {
    var path = e.composedPath ? e.composedPath() : [];
    var isSearch = path.some(function (n) { return n && n.id === 'searchInput'; });
    if (isSearch && !pageLinked.search) {
      if (localReaction('look', pickLine(['你在找什么呀？我帮你盯着。', '找吧，我在这儿。', '想找什么，我陪你翻。']))) pageLinked.search = true;
    }
    if (!pageLinked.applyEmail) {
      var applyEmail = path.some(function (n) { return n && n.name === 'email' && n.closest && n.closest('#zeroApplyForm'); });
      if (applyEmail && localReaction('look', pickLine(['邮箱写常用的，审核结果会发到这里。', '联系方式别留错，站长要回你。']))) pageLinked.applyEmail = true;
    }
    if (!pageLinked.applyUrl) {
      var applyUrl = path.some(function (n) { return n && n.name === 'url' && n.closest && n.closest('#zeroApplyForm'); });
      if (applyUrl && localReaction('look', pickLine(['站点地址记得带 https://。', '地址写完整，我替站长看看。']))) pageLinked.applyUrl = true;
    }
    if (!pageLinked.subscribeFocus) {
      var subEmail = path.some(function (n) { return n && n.name === 'email' && n.closest && n.closest('.zero-subscribe-form'); });
      if (subEmail && localReaction('look', pickLine(['邮箱写对哦，确认信会发到这里。', '填常用邮箱，确认链接别漏看。']))) pageLinked.subscribeFocus = true;
    }
    var inComment = path.some(function (n) {
      return n && n.tagName && String(n.tagName).toLowerCase().indexOf('zero-comment') !== -1;
    });
    var inCommentInput = path.some(function (n) {
      return n && (n.tagName === 'TEXTAREA' || n.tagName === 'INPUT');
    });
    if (inComment && inCommentInput && !pageLinked.commentFocus) {
      if (localReaction('look', pickLine(['慢慢写，我帮你看着。', '写吧，不催你。', '我在旁边，别急。']))) pageLinked.commentFocus = true;
    }
  }

  function localReaction(anim, line, force) {
    if (!booted || state.asleep || drag || panelsOpen()) return false;
    if (root && root.style.display === 'none') return false;
    var now = Date.now();
    if (!force && now - lastLocalReaction < 1200) return false;
    lastLocalReaction = now;
    if (!usePosterOnly) play(anim || 'look', { force: true, onEnd: resumeIdle });
    if (line) showBubble(line, { ttl: 5600 });
    return true;
  }

  function onCommentKey(e) {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    var path = e.composedPath ? e.composedPath() : [];
    if (!pageLinked.applyEmail) {
      var applyEmail = path.some(function (n) { return n && n.name === 'email' && n.closest && n.closest('#zeroApplyForm'); });
      if (applyEmail && localReaction('look', pickLine(['邮箱写常用的，审核结果会发到这里。', '联系方式别留错，站长要回你。']))) pageLinked.applyEmail = true;
    }
    if (!pageLinked.applyUrl) {
      var applyUrl = path.some(function (n) { return n && n.name === 'url' && n.closest && n.closest('#zeroApplyForm'); });
      if (applyUrl && localReaction('look', pickLine(['站点地址记得带 https://。', '地址写完整，我替站长看看。']))) pageLinked.applyUrl = true;
    }
    if (!pageLinked.subscribeFocus) {
      var subEmail = path.some(function (n) { return n && n.name === 'email' && n.closest && n.closest('.zero-subscribe-form'); });
      if (subEmail && localReaction('look', pickLine(['邮箱写对哦，确认信会发到这里。', '填常用邮箱，确认链接别漏看。']))) pageLinked.subscribeFocus = true;
    }
    var inComment = path.some(function (n) {
      return n && n.tagName && String(n.tagName).toLowerCase().indexOf('zero-comment') !== -1;
    });
    if (inComment) watchComment(7000);
  }

  function onPageScroll() {
    if (!CFG.scrollReaction || !booted || state.asleep || drag || panelsOpen()) return;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (max < 300) return;
    var p = window.scrollY / max;
    if (p >= 0.25 && !pageLinked.q1) {
      pageLinked.q1 = true;
      if (!usePosterOnly) play('look', { force: true, onEnd: resumeIdle });
    }
    if (p >= 0.5 && !pageLinked.q2) {
      pageLinked.q2 = true;
      localReaction('look', pickLine(['读到一半啦，我陪你。', '一半了，歇会儿？', '读到这儿正好，喘口气。']));
    }
    if (p >= 0.75 && !pageLinked.q3) {
      pageLinked.q3 = true;
      if (!usePosterOnly) play('look', { force: true, onEnd: resumeIdle });
    }
    if (p >= 0.97 && !pageLinked.bottom) {
      pageLinked.bottom = true;
      pageReaction('scroll');
    }
  }

  function onPageClick(e) {
    var path = e.composedPath ? e.composedPath() : [];
    var shuoLike = null;
    var shuoComment = null;
    var shuoLink = false;
    var shuoMedia = false;
    for (var pi = 0; pi < path.length; pi++) {
      var pn = path[pi];
      if (!pn || !pn.classList) continue;
      if (!shuoLike && pn.classList.contains('shuo-like')) shuoLike = pn;
      if (!shuoComment && pn.classList.contains('shuo-comment')) shuoComment = pn;
      if (pn.classList.contains('shuo-link')) shuoLink = true;
      if (pn.classList.contains('shuo-music-play') || pn.tagName === 'VIDEO') shuoMedia = true;
    }
    if (shuoLike) {
      if (!shuoLike.classList.contains('is-liked')) pageReaction('like');
      return;
    }
    if (shuoComment) {
      localReaction('look', pickLine(['这条时刻的评论，我陪你看看。', '去看看大家在聊什么。']), true);
      return;
    }
    if (shuoLink) {
      localReaction('click-wave', pickLine(['这条链接，我也看看。', '顺着这条链接去瞧瞧。']), true);
      return;
    }
    if (shuoMedia) {
      localReaction('look', pickLine(['这个我陪你看。', '放到哪了？我也听听。']), true);
      return;
    }
    var homeSort = null;
    var homeMore = false;
    var homeAll = false;
    var homePage = false;
    for (var hi = 0; hi < path.length; hi++) {
      var hn = path[hi];
      if (!hn || !hn.classList) continue;
      if (!homeSort && (hn.classList.contains('hb-tab') || hn.classList.contains('garden-tab'))) homeSort = hn;
      if (!homeMore && hn.classList.contains('hb-more')) homeMore = true;
      if (!homeAll && hn.classList.contains('hb-sec-link')) homeAll = true;
      if (!homePage && hn.classList.contains('page-btn')) homePage = true;
    }
    if (homeSort) {
      var sortKey = homeSort.getAttribute('data-hb-sort') || homeSort.getAttribute('data-gsort') || '';
      var sortLine = sortKey === 'hot' ? '换成最热，看看哪几篇最受欢迎。' : sortKey === 'earliest' ? '从最早开始翻，慢慢看。' : '回到最新，看看最近写了什么。';
      localReaction('look', sortLine, true);
      return;
    }
    if (homePage) {
      localReaction('look', pickLine(['翻页啦，坐稳。', '下一页，我跟着。']), true);
      return;
    }
    if (homeMore) {
      localReaction('click-wave', pickLine(['还有，我接着帮你翻。', '别急，下面还有。']), true);
      return;
    }
    if (homeAll) {
      localReaction('click-wave', pickLine(['去文章堆里翻翻。', '下面都是文章，我陪你。']), true);
      return;
    }
    var aboutAvatar = false;
    var aboutName = false;
    var aboutTagline = false;
    var aboutBlock = null;
    var aboutFind = false;
    for (var bi = 0; bi < path.length; bi++) {
      var bn = path[bi];
      if (!bn || !bn.classList) continue;
      if (!aboutAvatar && bn.classList.contains('about-avatar')) aboutAvatar = true;
      if (!aboutName && bn.classList.contains('about-name')) aboutName = true;
      if (!aboutTagline && bn.classList.contains('about-tagline')) aboutTagline = true;
      if (!aboutBlock && bn.classList.contains('about-block-title')) aboutBlock = bn;
      if (!aboutFind && bn.classList.contains('find-me-link')) aboutFind = true;
    }
    if (aboutAvatar) {
      localReaction('click-shy', pickLine(['这是站长，认准这枚头像。', '头像本人？嗯，挺精神的。']), true);
      return;
    }
    if (aboutName) {
      localReaction('celebrate', pickLine(['知止，也可以叫他杜衡。', '站长就在这儿站着。']), true);
      return;
    }
    if (aboutTagline) {
      localReaction('look', pickLine(['这句挺配他，日上三竿我独眠。', '好句子，我记下了。']), true);
      return;
    }
    if (aboutBlock) {
      var blockText = String(aboutBlock.textContent || '').replace(/\s+/g, ' ').trim();
      if (blockText.indexOf('找到我') >= 0) localReaction('click-wave', '想找站长，就从这几扇门进。', true);
      else if (blockText.indexOf('本站') >= 0) localReaction('look', '这里写的是这个站。', true);
      else if (blockText.indexOf('声明') >= 0) localReaction('look', '声明在这儿，认真看看。', true);
      else localReaction('look', '这一段讲讲站长。', true);
      return;
    }
    if (aboutFind) {
      localReaction('click-wave', pickLine(['去吧，站长在那边等你。', '顺着这扇门找站长。']), true);
      return;
    }
    if (path.some(function (n) { return n && n.id === 'zeroApplyBtn'; })) {
      var applyForm = document.getElementById('zeroApplyForm');
      if (applyForm) {
        var nameInput = applyForm.querySelector('input[name="name"]');
        var urlInput = applyForm.querySelector('input[name="url"]');
        var mailInput = applyForm.querySelector('input[name="email"]');
        var mail = mailInput ? String(mailInput.value || '').trim() : '';
        if (!mail) localReaction('look', '联系方式还没填，站长找不到你。', true);
        else if (!mailInput.checkValidity()) localReaction('look', '邮箱格式好像不对，再看看？', true);
        else if (!(urlInput && String(urlInput.value || '').trim())) localReaction('look', '站点地址还没写，记得带 https://。', true);
        else if (!(nameInput && String(nameInput.value || '').trim())) localReaction('look', '站点名称也补一下吧。', true);
        else localReaction('celebrate', pickLine(['申请我记下了，等站长回你。', '收到，站长看到会回你的。']), true);
      }
      return;
    }
    var applyTab = path.some(function (n) { return n && n.id === 'tab-apply'; });
    if (applyTab) {
      localReaction('look', pickLine(['申请友链？站点地址和邮箱写清楚哦。', '想换友链呀，我替站长看看。']));
      return;
    }
    var cloud = null;
    for (var ci = 0; ci < path.length; ci++) {
      if (path[ci] && path[ci].classList && path[ci].classList.contains('cloud-item')) { cloud = path[ci]; break; }
    }
    if (cloud) {
      var cloudLabel = String(cloud.textContent || '').replace(/\s+/g, ' ').replace(/\s*\d+\s*$/, '').trim();
      localReaction('look', pickLine(['按「' + cloudLabel + '」翻一翻？', '看看「' + cloudLabel + '」下面有什么。']));
      return;
    }
    var themeNode = path.some(function (n) { return n && n.id === 'themeToggle'; });
    if (themeNode) {
      pageReaction('theme');
      return;
    }
    var shareNode = path.some(function (n) {
      return n && n.classList && (n.classList.contains('share-btn') || n.hasAttribute('data-share-copy') || n.hasAttribute('data-share-native'));
    });
    if (shareNode) {
      var copyShare = path.some(function (n) { return n && n.hasAttribute && n.hasAttribute('data-share-copy'); });
      localReaction(copyShare ? 'code' : 'click-wave', copyShare ? pickLine(['复制好了，我帮你收着。', '链接拿好，别弄丢。']) : pickLine(['分享出去啦，记得回来。', '去吧，我在这儿看着。']));
      return;
    }
    if (path.some(function (n) { return n && n.classList && n.classList.contains('apply-copy'); })) {
      localReaction('code', pickLine(['复制好了，照这个填就行。', '填吧，我帮你对过。']));
      return;
    }
    var anchor = null;
    for (var ai = 0; ai < path.length; ai++) {
      if (path[ai] && path[ai].tagName === 'A') { anchor = path[ai]; break; }
    }
    if (path.some(function (n) { return n && n.classList && (n.classList.contains('work-card') || n.classList.contains('work-card-link')); })) {
      localReaction('click-wave', pickLine(['这个项目，我看看。', '工坊里又多了个东西？', '还在做呀，我蹲着等。']), true);
      return;
    }
    if (anchor && /^mailto:/i.test(anchor.href)) {
      localReaction('click-wave', pickLine(['写信给我？我会慢慢看。', '邮件在这儿，别写错地址。']));
      return;
    }
    var isSubscribe = path.some(function (n) {
      return n && n.classList && (n.classList.contains('zero-subscribe') || n.classList.contains('za-sub-link'));
    }) || Boolean(anchor && /(^|\/)subscribe\/?([?#]|$)/.test(anchor.getAttribute('href') || ''));
    if (isSubscribe) {
      localReaction('look', pickLine(['订阅入口在这边，填个邮箱就行。', '去订阅页吧，我在这儿等你的确认。']));
      return;
    }
    if (anchor && anchor.target === '_blank' && /^https?:/.test(anchor.href) && anchor.hostname !== location.hostname) {
      localReaction('click-wave', pickLine(['外面风大，早点回来。', '去吧，水洼边等你。']));
      return;
    }
    var tocLink = anchor && anchor.closest && anchor.closest('#articleToc, #TableOfContents, #tocNav, .article-toc');
    if (tocLink && anchor.hash) {
      localReaction('look', pickLine(['要跳到这一节吗？我跟着你。', '这一节，我陪你过去。']));
      return;
    }
    var articleImg = path.some(function (n) {
      return n && n.tagName === 'IMG' && n.closest && n.closest('article, .article-content, .post-content, .gallery, .figure');
    });
    if (articleImg) {
      localReaction('look', pickLine(['这张图我也凑近看看。', '图不错，我看看。']));
      return;
    }
    if (CFG.backTopReaction) {
      for (var i = 0; i < path.length; i++) {
        var el = path[i];
        if (!el || !el.id) continue;
        if (el.id === 'scrollToTop' || el.id === 'scrollToBottom') {
          if (!state.asleep && !drag) play(el.id === 'scrollToTop' ? 'celebrate' : 'look', { force: true, onEnd: resumeIdle });
          return;
        }
      }
    }
    if (CFG.likeReaction) {
      var zeroLike = path.some(function (n) {
        return n && n.tagName && String(n.tagName).toLowerCase().indexOf('zero-like') === 0;
      });
      var likeButton = null;
      for (var li = 0; li < path.length; li++) {
        var ln = path[li];
        if (ln && ln.tagName === 'BUTTON') { likeButton = ln; break; }
      }
      var likeOn = likeButton && (likeButton.classList.contains('active') || likeButton.getAttribute('aria-pressed') === 'true');
      if (zeroLike && likeButton && !likeOn) {
        pageReaction('like');
        return;
      }
      var liked = path.some(function (n) {
        return n && n.classList && (n.classList.contains('like') || n.classList.contains('liked'));
      });
      if (liked) {
        pageReaction('like');
        return;
      }
      // 收藏是主题自己的 .zero-star 按钮（不用 zero-like），点击路径里没有 .like。
      var starBtn = null;
      for (var j = 0; j < path.length; j++) {
        var node = path[j];
        if (node && node.tagName === 'BUTTON' && node.classList && node.classList.contains('zst-btn')) {
          starBtn = node;
          break;
        }
      }
      var inStar = path.some(function (n) {
        return n && n.classList && (n.classList.contains('zero-star') || n.classList.contains('zst-btn'));
      });
      if (inStar && starBtn && starBtn.getAttribute('aria-pressed') !== 'true') {
        pageReaction('star');
        return;
      }
    }
    if (CFG.commentReaction) {
      var inComment = path.some(function (n) {
        if (!n || !n.tagName) return false;
        var tag = String(n.tagName).toLowerCase();
        return tag.indexOf('zero-comment') !== -1 || (tag.indexOf('comment') !== -1 && !!n.shadowRoot);
      });
      var submit = path.some(function (n) {
        return n && n.tagName === 'BUTTON' && /发布|提交|发表|发送/.test(String(n.textContent || '').trim());
      });
      if (inComment && submit) watchComment(7000);
    }
  }

  function pageReaction(kind) {
    if (!booted || state.asleep || drag || panelsOpen()) return;
    if (root && root.style.display === 'none') return;
    if (!usePosterOnly) {
      play(kind === 'scroll' || kind === 'like' || kind === 'star' ? 'celebrate' : 'look', { force: true, onEnd: resumeIdle });
    }
    pageLine(kind);
  }

  function pageLine(kind) {
    if (!booted) return;
    var now = Date.now();
    if (now - lastPageLine < 20000) return;
    lastPageLine = now;
    thinking('');
    requestLine(kind, {}).then(function (j) {
      setMood(j.mood);
      showBubble(j.line, { ttl: 5600 });
    }).catch(function () {
      var f = fallback(kind);
      setMood(f.mood);
      showBubble(f.line, { ttl: 6000, foot: fallbackFoot() });
    });
  }

  function commentHost() {
    var hosts = document.querySelectorAll('zero-comment');
    var first = null;
    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i];
      if (!host.shadowRoot) continue;
      if (!first) first = host;
      try {
        if (host.getClientRects().length && host.offsetParent !== null) return host;
      } catch (e) {}
    }
    return first;
  }

  function commentCount(host) {
    try { return host.shadowRoot.querySelectorAll('.node').length; } catch (e) { return 0; }
  }

  function seedCommentCount() {
    var host = commentHost();
    if (!host) return;
    commentWatch.host = host;
    var n = commentCount(host);
    if (commentWatch.ready) {
      commentWatch.count = n;
      return;
    }
    if (commentWatch.stableCount === n) {
      if (Date.now() - commentWatch.stableAt >= 2500) {
        commentWatch.count = n;
        commentWatch.ready = true;
      }
    } else {
      commentWatch.stableCount = n;
      commentWatch.stableAt = Date.now();
    }
  }

  function watchComment(duration) {
    if (commentWatch.timer) clearTimeout(commentWatch.timer);
    var deadline = Date.now() + (duration || 7000);
    var tick = function () {
      var host = commentHost();
      if (host) {
        var n = commentCount(host);
        if (!commentWatch.ready) {
          commentWatch.ready = true;
          commentWatch.count = n;
        } else if (n > commentWatch.count) {
          commentWatch.count = n;
          commentWatch.timer = null;
          commentReaction();
          return;
        } else {
          commentWatch.count = n;
        }
      }
      if (Date.now() < deadline) commentWatch.timer = setTimeout(tick, 500);
      else commentWatch.timer = null;
    };
    commentWatch.timer = setTimeout(tick, 400);
  }

  function checkCommentCount() {
    var host = commentHost();
    if (!host) return;
    var n = commentCount(host);
    if (!commentWatch.ready) {
      commentWatch.count = n;
      commentWatch.ready = true;
      return;
    }
    if (n > commentWatch.count) {
      commentWatch.count = n;
      commentReaction();
    } else {
      commentWatch.count = n;
    }
  }

  function commentReaction() {
    if (!booted || state.asleep || drag || panelsOpen()) return;
    if (root && root.style.display === 'none') return;
    var now = Date.now();
    if (now - lastCommentReaction < 2500) return;
    lastCommentReaction = now;
    if (!usePosterOnly) play('code', { force: true, onEnd: resumeIdle });
    showBubble('有人发评论了我看看写的什么', { ttl: 7000 });
  }

  function onStageDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('.sp-panel, .sp-dock, .sp-bubble')) return;
    closePanels();
    var r = root.getBoundingClientRect();
    drag = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      left: r.left,
      top: r.top,
      moved: false,
      noDrag: !CFG.dragEnabled,
    };
    if (drag.noDrag) {
      e.preventDefault();
      return;
    }
    // 被拎起来的动画要等真的移动了再演：一按下去就切动作，手机上等于先卡在
    // 这张表的下载里，用户会觉得「点了没反应」。
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!drag || drag.noDrag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.sx;
    var dy = e.clientY - drag.sy;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) {
      drag.moved = true;
      play('drag', { loop: true });
    }
    if (!drag.moved) return;
    var w = root.offsetWidth;
    var h = root.offsetHeight;
    var x = clamp(drag.left + dx, 8, Math.max(8, window.innerWidth - w - 8));
    var y = clamp(drag.top + dy, 110, Math.max(110, window.innerHeight - h - 44));
    root.style.left = Math.round(x) + 'px';
    root.style.top = Math.round(y) + 'px';
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (!drag || (e.pointerId !== undefined && e.pointerId !== drag.id)) return;
    var moved = drag.moved;
    try { stage.releasePointerCapture(drag.id); } catch (err) {}
    drag = null;
    if (moved) {
      savePosition();
      if (state.asleep) play('sleep-loop', { loop: true, force: true });
      else resumeIdle();
    } else {
      poke();
    }
  }

  function openMenu() {
    if (!booted) return;
    closePanels();
    menuOpen = true;
    if (root) root.classList.add('sp-active');
    pauseChain();
    play('idle', { loop: true });
    hideBubble();
    menu.classList.add('is-on');
    positionPanel(menu);
  }

  function openChat() {
    if (!booted) return;
    closePanels();
    chatOpen = true;
    if (root) root.classList.add('sp-active');
    pauseChain();
    play('idle', { loop: true });
    hideBubble();
    chat.classList.add('is-on');
    positionPanel(chat);
    setTimeout(function () {
      chat.querySelector('textarea').focus();
    }, 80);
  }

  function openStatus() {
    if (!booted) return;
    closePanels();
    statusOpen = true;
    if (root) root.classList.add('sp-active');
    pauseChain();
    play('idle', { loop: true });
    hideBubble();
    statusPanel.classList.add('is-on');
    positionPanel(statusPanel);
    renderStatus();
    statusTimer = setInterval(renderStatus, 1000);
  }

  function renderStatus() {
    if (!statusPanel) return;
    var name = identityName();
    var title = statusPanel.querySelector('.sp-panel-head b');
    if (title) title.textContent = name + '的状态';
    var nameEl = statusPanel.querySelector('.sp-status-name');
    if (nameEl) nameEl.textContent = name;
    var groupEl = statusPanel.querySelector('.sp-status-group');
    if (groupEl) {
      groupEl.textContent = identity.group || '';
      groupEl.style.display = identity.group ? '' : 'none';
    }
    var asleepEl = statusPanel.querySelector('.sp-status-asleep');
    if (asleepEl) {
      asleepEl.textContent = state.asleep ? '睡觉中' : '醒着';
      asleepEl.classList.toggle('is-asleep', !!state.asleep);
    }
    var moodEl = statusPanel.querySelector('.sp-status-mood-val');
    if (moodEl) moodEl.textContent = state.mood || '平静';
    var energy = Math.max(0, Math.min(100, Math.round(Number(state.energy) || 0)));
    var satiety = Math.max(0, Math.min(100, Math.round(Number(state.satiety) || 0)));
    var boredom = Math.max(0, Math.min(100, Math.round(Number(state.boredom) || 0)));
    [['energy', energy], ['satiety', satiety], ['boredom', boredom]].forEach(function (item) {
      var val = statusPanel.querySelector('.sp-status-' + item[0] + '-val');
      if (val) val.textContent = item[1];
      var fill = statusPanel.querySelector('.sp-status-fill.sp-status-' + item[0]);
      if (fill) {
        fill.style.width = item[1] + '%';
        fill.classList.toggle('is-low', item[0] !== 'boredom' && item[1] < 28);
        fill.classList.toggle('is-high', item[0] === 'boredom' && item[1] > 70);
      }
    });
    var stats = {
      interactions: state.interactions,
      pets: state.pets,
      away: state.awayHours || 0,
    };
    Object.keys(stats).forEach(function (key) {
      var el = statusPanel.querySelector('.sp-status-' + key);
      if (el) el.textContent = stats[key];
    });
    var feedBtn = statusPanel.querySelector('[data-status-act="feed"]');
    if (feedBtn) feedBtn.hidden = !CFG.feedEnabled;
    var sleepBtn = statusPanel.querySelector('[data-status-act="sleep"]');
    if (sleepBtn) {
      sleepBtn.hidden = !CFG.sleepEnabled;
      sleepBtn.textContent = state.asleep ? '起床' : '睡觉';
    }
    var engEl = statusPanel.querySelector('.sp-status-engine');
    if (engEl) engEl.textContent = engineInfo();
  }

  // 手机上「动画没了 / 很糊」这类反馈很难远程判断，状态面板里留一行引擎自述，
  // 一眼就能看出当前走的是 WebM、Canvas 精灵还是海报，以及素材分辨率。
  function engineInfo() {
    var dpr = Math.round((window.devicePixelRatio || 1) * 10) / 10;
    var txt = '渲染 v' + PET_VER + '：' + engineName + (isMobileBrowser ? '（手机）' : '（桌面）') + ' · 屏幕 dpr ' + dpr;
    if (engineName === 'canvas') {
      var m = spriteManifest && spriteManifest.idle;
      txt += m ? (' · 帧 ' + m.fw + '×' + m.fh + (m.ref ? '(裁切自' + m.ref[0] + '×' + m.ref[1] + ')' : '(整幅)') + ' · ' + (Math.round(m.frames / m.dur * 10) / 10) + 'fps') : ' · 精灵表未就绪';
      if (canvasEl) txt += ' · 画布 ' + canvasEl.width + '×' + canvasEl.height;
    }
    return txt;
  }

  function closePanels() {
    var was = panelsOpen();
    bubbleHoldSticky = 0;
    menuOpen = false;
    chatOpen = false;
    statusOpen = false;
    if (menu) menu.classList.remove('is-on');
    if (chat) chat.classList.remove('is-on');
    if (statusPanel) statusPanel.classList.remove('is-on');
    if (statusTimer) {
      clearInterval(statusTimer);
      statusTimer = null;
    }
    if (root && !panelsOpen()) root.classList.remove('sp-active');
    if (was && booted && !state.asleep && !drag) resumeIdle();
  }

  function hidePet() {
    closePanels();
    pauseChain();
    saveLayout({ hidden: true });
    if (root) {
      root.style.display = 'none';
      try {
        if (vA) vA.pause();
        if (vB) vB.pause();
      } catch (e) {}
    }
    showRestoreTab();
  }

  function showPet() {
    saveLayout({ hidden: false });
    if (!root) {
      boot();
      return;
    }
    root.style.display = '';
    place();
    updateDock();
    if (state.asleep) play('sleep-loop', { loop: true });
    else resumeIdle();
  }

  // ——————————————————————————————————————————————————————————————
  // 轻量入口
  // ——————————————————————————————————————————————————————————————
  function expandedThisSession() {
    try { return sessionStorage.getItem(EXPAND_KEY) === '1'; } catch (e) { return false; }
  }

  function markExpanded() {
    try { sessionStorage.setItem(EXPAND_KEY, '1'); } catch (e) {}
  }

  function showMiniPet() {
    if (document.querySelector('.site-pet-mini')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'site-pet-mini';
    btn.title = '叫出' + identityName();
    btn.setAttribute('aria-label', '叫出' + identityName());
    var img = document.createElement('img');
    img.alt = '';
    img.width = 48;
    img.height = 48;
    img.loading = 'lazy';
    setIdentityImage(img);
    var label = document.createElement('span');
    label.textContent = identityName();
    btn.append(img, label);
    btn.addEventListener('click', function () {
      btn.remove();
      markExpanded();
      boot();
    });
    document.body.appendChild(btn);
  }

  function showRestoreTab() {
    if (document.querySelector('.site-pet-restore')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'site-pet-restore';
    btn.textContent = identityName() + ' · 桌宠';
    btn.title = '把' + identityName() + '叫回来';
    btn.setAttribute('aria-label', '把' + identityName() + '叫回来');
    btn.addEventListener('click', function () {
      btn.remove();
      saveLayout({ hidden: false });
      if (!booted) boot();
      else showPet();
    });
    document.body.appendChild(btn);
  }

  // ——————————————————————————————————————————————————————————————
  // 单击 / 喂饭 / 问问题 / 睡觉
  // ——————————————————————————————————————————————————————————————
  function poke() {
    if (!booted || !CFG.clickReaction) return;
    hideBubble();
    if (state.asleep) {
      wake(function () { doPoke(); });
      return;
    }
    doPoke();
  }

  function doPoke() {
    var now = Date.now();
    state.interactions += 1;
    state.pets += 1;
    state.boredom = Math.max(0, state.boredom - 7);
    state.energy = Math.max(10, state.energy - 0.5);
    state.satiety = Math.max(8, state.satiety - 0.2);
    state.mood = '开心';
    state.lastInteraction = now;
    state.lastSeen = now;
    saveState(state);
    updateDock();

    // 轮着来而不是纯随机：这样能提前把「下一次要点的那个动作」的精灵表取好，
    // 手机上点下去就不必先等 1MB 下载。
    var clickKey = CLICK_CLIPS[clickIdx % CLICK_CLIPS.length];
    clickIdx++;
    if (useMobileCanvas && stage) {
      stage.classList.remove('sp-tapped');
      void stage.offsetWidth;
      stage.classList.add('sp-tapped');
      setTimeout(function () { stage.classList.remove('sp-tapped'); }, 380);
    }
    play(clickKey, {
      force: true,
      onEnd: function () {
        warmSprite(CLICK_CLIPS[clickIdx % CLICK_CLIPS.length]);
        resumeIdle();
      },
    });

    if (now - lastPokeAsk < 1500) return;
    lastPokeAsk = now;
    thinking('');
    requestLine('poke', { pokes: 1 }).then(function (j) {
      setMood(j.mood);
      showBubble(j.line, { ttl: 5400 });
    }).catch(function () {
      var f = fallback('poke');
      setMood(f.mood);
      showBubble(f.line, { ttl: 6000, foot: fallbackFoot() });
    });
  }

  function feed() {
    if (!booted || !CFG.feedEnabled) return;
    if (state.asleep) {
      wake(function () { doFeed(); });
      return;
    }
    doFeed();
  }

  function doFeed() {
    state.satiety = Math.min(100, state.satiety + 32);
    state.energy = Math.min(100, state.energy + 4);
    state.boredom = Math.max(0, state.boredom - 12);
    state.mood = '开心';
    state.interactions += 1;
    state.lastInteraction = Date.now();
    state.lastSeen = Date.now();
    saveState(state);
    updateDock();
    play('eat-rice', {
      force: true,
      onEnd: function () {
        resumeIdle();
      },
    });
    thinking('');
    requestLine('feed', {}).then(function (j) {
      setMood(j.mood);
      showBubble(j.line, { ttl: 6000 });
    }).catch(function () {
      var f = fallback('feed');
      setMood(f.mood);
      showBubble(f.line, { ttl: 6200, foot: fallbackFoot() });
    });
  }

  function ask(text) {
    var q = String(text == null ? '' : text).replace(/\s+/g, ' ').trim().slice(0, 100);
    if (!q || !booted) return;
    if (state.asleep) {
      wake(function () { doAsk(q); });
      return;
    }
    doAsk(q);
  }

  function doAsk(q) {
    state.interactions += 1;
    state.boredom = Math.max(0, state.boredom - 10);
    state.mood = '好奇';
    state.lastInteraction = Date.now();
    state.lastSeen = Date.now();
    saveState(state);
    updateDock();
    hideBubble();
    play('think', { loop: true, force: true });
    thinking('你问：' + q);
    var history = chatHistory.slice(-6);
    requestLine('chat', { question: q, history: history }).then(function (j) {
      setMood(j.mood);
      chatHistory.push({ role: 'user', content: q }, { role: 'assistant', content: j.line });
      if (chatHistory.length > 8) chatHistory = chatHistory.slice(-8);
      var anim = MOOD_ANIM[j.mood] || 'celebrate';
      play(anim, {
        force: true,
        onEnd: function () {
          resumeIdle();
        },
      });
      showBubble(j.line, { ttl: 7600 });
    }).catch(function () {
      var f = fallback('chat');
      setMood(f.mood);
      play('sad', {
        force: true,
        onEnd: function () {
          resumeIdle();
        },
      });
      showBubble(f.line, { ttl: 6800, foot: fallbackFoot() });
    });
  }

  function goSleep() {
    if (!booted || !CFG.sleepEnabled || state.asleep) return;
    closePanels();
    state.asleep = true;
    state.lastInteraction = Date.now();
    saveState(state);
    updateDock();
    hideBubble();
    play('sleep-start', {
      force: true,
      onEnd: function () {
        if (state.asleep) play('sleep-loop', { loop: true, force: true });
      },
    });
    showBubble('Zzz…', { ttl: 4200 });
  }

  function wake(cb) {
    if (!state.asleep) {
      if (cb) cb();
      return;
    }
    state.asleep = false;
    state.lastInteraction = Date.now();
    saveState(state);
    updateDock();
    hideBubble();
    play('sleep-end', {
      force: true,
      max: 4500,
      onEnd: function () {
        if (cb) cb();
        else resumeIdle();
      },
    });
  }

  function sleepWatch() {
    if (!booted || !CFG.sleepEnabled || state.asleep || drag || panelsOpen()) return;
    if (Date.now() - state.lastInteraction > SLEEP_AFTER) goSleep();
  }

  function updateDock() {
    if (!dock) return;
    var b = dock.querySelector('button[data-act="sleep"]');
    if (b) b.textContent = state.asleep ? '起床' : '睡觉';
  }

  // ——————————————————————————————————————————————————————————————
  // 气泡 / AI / 状态
  // ——————————————————————————————————————————————————————————————
  function showBubble(text, opts) {
    if (!bubbleEl) return;
    opts = opts || {};
    bubbleBody.textContent = personalize(text);
    bubbleFoot.textContent = personalize(opts.foot || '');
    bubbleEl.classList.add('sp-on');
    if (bubbleTimer) clearTimeout(bubbleTimer);
    var ttl = opts.ttl != null ? opts.ttl : 6000;
    if (ttl > 0) {
      bubbleTimer = setTimeout(function () {
        hideBubble();
      }, ttl);
    }
    requestAnimationFrame(function () {
      positionBubble();
      repositionPanels();
    });
  }

  // 气泡钉在头顶不动，所以让位的是面板：气泡出现后把打开的面板重排一次。
  function repositionPanels() {
    if (chatOpen && chat) positionPanel(chat);
    if (menuOpen && menu) positionPanel(menu);
    if (statusOpen && statusPanel) positionPanel(statusPanel);
  }

  function thinking(foot) {
    showBubble('…', { ttl: 15000, foot: foot || '' });
  }

  function hideBubble() {
    if (!bubbleEl) return;
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = null;
    bubbleEl.classList.remove('sp-on');
  }

  function requestLine(trigger, extra) {
    if (!CFG.aiEnabled) return Promise.reject(new Error('ai-off'));
    var ctrl = new AbortController();
    var timer = setTimeout(function () {
      try { ctrl.abort(); } catch (e) {}
    }, 20000);
    var body = {
      trigger: trigger,
      identityName: identityName(),
      identityGroup: identity.group,
      title: context.title,
      section: context.section,
      theme: siteTheme(),
      state: {
        mood: state.mood,
        energy: Math.round(state.energy),
        satiety: Math.round(state.satiety),
        boredom: Math.round(state.boredom),
        scene: 'page',
        awayHours: state.awayHours || 0,
        interactions: state.interactions,
        pokes: extra && extra.pokes ? extra.pokes : 0,
      },
    };
    if (extra && extra.question) body.question = String(extra.question).slice(0, 100);
    if (extra && extra.history && extra.history.length) body.history = extra.history;
    var apiBase = '';
    try {
      apiBase = String(window.__WHALE_PET_API_BASE__ || (window.ZeroStack && window.ZeroStack.base) || '').replace(/\/+$/, '');
    } catch (e) {}
    var url = apiBase ? apiBase + '/api/ai/pet-line' : '/api/whale-line';
    return fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || !j.line) throw new Error('empty line');
      return j;
    }).finally(function () {
      clearTimeout(timer);
    });
  }

  function setMood(serverMood) {
    var map = {
      happy: '开心',
      curious: '好奇',
      surprised: '惊讶',
      pout: '有点小情绪',
      sleepy: '困',
      sad: '难过',
    };
    state.mood = map[serverMood] || '平静';
    state.lastInteraction = Date.now();
    saveState(state);
  }

  function fallbackFoot() {
    return CFG.aiEnabled ? 'AI 暂时连不上，先陪你一会儿' : 'AI 已关闭，先用本地台词';
  }

  function pickLine(pool) {
    if (!pool || !pool.length) return '';
    var line = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && line === lastLocalLine) line = pool[(pool.indexOf(line) + 1) % pool.length];
    lastLocalLine = line;
    return line;
  }

  function pageName() {
    var title = String(context.title || '').trim();
    if (title) return '《' + title.slice(0, 18) + '》';
    return context.section ? '「' + context.section + '」' : '这一页';
  }

  function fallback(trigger) {
    var away = state.awayHours || 0;
    var lowEnergy = state.energy < 28;
    var hungry = state.satiety < 25;
    var bored = state.boredom > 72;
    if (trigger === 'feed') {
      return {
        line: pickLine(['白饭！我最喜欢白米饭了。', '这一碗，我能吃很久。', '谢谢，米粒都香。']),
        mood: 'happy',
      };
    }
    if (trigger === 'scroll') {
      return {
        line: pickLine(['看到这里啦，我陪你歇一会儿。', '这一篇读到这里，水洼里的鱼也探出头了。', '慢慢看，我不催。']),
        mood: 'happy',
      };
    }
    if (trigger === 'like') {
      return {
        line: pickLine(['这一下我收到了。', '谢谢赞，白米饭多一粒。', '被看见了，尾巴晃了晃。']),
        mood: 'happy',
      };
    }
    if (trigger === 'star') {
      return {
        line: pickLine(['收藏好啦，我替你压在水洼底下。', '藏好了，回头别忘回来。', '这一页我替你看着。']),
        mood: 'happy',
      };
    }
    if (trigger === 'theme') {
      return {
        line: pickLine(['灯一关一亮，我都看得见。', '换个颜色，水洼也亮了。', '这个颜色，我喜欢。']),
        mood: 'curious',
      };
    }
    if (trigger === 'comment') {
      return {
        line: pickLine(['评论区有新动静，我竖起耳朵了。', '有人说话了，我去看看。']),
        mood: 'curious',
      };
    }
    if (trigger === 'top') {
      return {
        line: pickLine(['要回上面吗？我陪你。', '回到开头，再读一遍？', '上面还有，我跟着。']),
        mood: 'happy',
      };
    }
    if (trigger === 'chat') {
      if (lowEnergy) {
        return {
          line: pickLine(['我有点困，脑子像泡在水里…你再说一遍？', '刚刚差点睡着，没听清。', '让我先醒醒，水洼里太舒服了。']),
          mood: 'sleepy',
        };
      }
      if (bored) {
        return {
          line: pickLine(['刚刚在发呆，你问的啥？', '你终于来了，我都没心思回答。', '水洼里太安静了，再说一遍？']),
          mood: 'curious',
        };
      }
      return {
        line: pickLine(['我这边信号有点飘，你再说一遍？', '刚刚在数泡泡，走神了，你问的啥？', '水洼里回声太大，我没听清。', '刚刚在看' + pageName() + '，走神了，你再说一次？']),
        mood: 'pout',
      };
    }
    if (trigger === 'greeting') {
      if (away > 8) {
        return {
          line: pickLine(['你终于回来了，我等到水洼都凉了。', '你走了好久，我数了好多泡泡。', '阿鱼刚刚都快睡着了，你回来了。']),
          mood: 'happy',
        };
      }
      if (lowEnergy) {
        return { line: pickLine(['我有点困，但还是想陪你。', '先让我眯一下，就一下。']), mood: 'sleepy' };
      }
      if (bored) {
        return { line: pickLine(['你终于来了，我刚在发呆。', '刚刚水洼里只有我，现在好了。']), mood: 'curious' };
      }
      return {
        line: pickLine(['阿鱼在这里，陪你慢慢看。', '今天也来啦，白米饭先欠着。', '你来啦，水洼刚刚晃了一下。', '我在这儿，慢慢看就好。']),
        mood: 'happy',
      };
    }

    if (bored) {
      return {
        line: pickLine(['再戳一下，我就精神了。', '你终于来啦，我刚在发呆。', '水洼里太安静，陪我玩会儿。']),
        mood: 'curious',
      };
    }
    if (lowEnergy) {
      return { line: pickLine(['戳醒了，但还是很困…', '轻点，我在打盹。', '让我眯五分钟，就五分钟。']), mood: 'sleepy' };
    }
    if (hungry) {
      return { line: pickLine(['肚子在叫了，有白米饭吗？', '戳我之前，可以先喂一口饭吗？']), mood: 'pout' };
    }
    return {
      line: pickLine(['戳一下要收一粒米哦。', '本鱼在看书，别闹。', '再戳就游走啦。', '水洼里的鱼也会害羞的。', '别戳啦，尾巴要甩你了。']),
      mood: 'pout',
    };
  }

  function maybeGreet() {
    if (!CFG.greetingEnabled || greeted) return false;
    greeted = true;
    var seen = false;
    try { seen = sessionStorage.getItem(GREET_KEY) === '1'; } catch (e) {}
    if (seen) return false;
    if ((state.awayHours || 0) < 0.5 && state.interactions > 0) return false;
    try { sessionStorage.setItem(GREET_KEY, '1'); } catch (e) {}
    play('click-wave', {
      force: true,
      onEnd: function () {
        resumeIdle();
      },
    });
    thinking('');
    requestLine('greeting', {}).then(function (j) {
      setMood(j.mood);
      showBubble(j.line, { ttl: 6000 });
    }).catch(function () {
      var f = fallback('greeting');
      setMood(f.mood);
      showBubble(f.line, { ttl: 6200, foot: fallbackFoot() });
    });
    return true;
  }

  // ——————————————————————————————————————————————————————————————
  // 状态 / 页面上下文 / 主题
  // ——————————————————————————————————————————————————————————————
  function defaultState() {
    return {
      mood: '平静',
      energy: 84,
      satiety: 76,
      boredom: 16,
      interactions: 0,
      pets: 0,
      awayHours: 0,
      lastSeen: 0,
      lastInteraction: 0,
      asleep: false,
    };
  }

  function loadState() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) {}
    if (!s || typeof s !== 'object') s = defaultState();
    var nums = ['energy', 'satiety', 'boredom', 'interactions', 'pets', 'lastSeen', 'lastInteraction'];
    for (var i = 0; i < nums.length; i++) {
      var k = nums[i];
      var v = Number(s[k]);
      s[k] = Number.isFinite(v) ? v : defaultState()[k];
    }
    s.mood = typeof s.mood === 'string' ? s.mood : '平静';
    var now = Date.now();
    var awayMs = s.lastSeen ? Math.max(0, now - s.lastSeen) : 0;
    s.awayHours = Math.min(240, Math.round((awayMs / 3600000) * 10) / 10);
    if (s.awayHours > 3) {
      s.energy = Math.max(18, s.energy - Math.min(46, s.awayHours * 1.8));
      s.satiety = Math.max(12, s.satiety - Math.min(50, s.awayHours * 2.2));
      s.boredom = Math.min(96, s.boredom + Math.min(60, s.awayHours * 1.6));
      s.mood = s.awayHours > 12 ? '有点想你' : s.boredom > 70 ? '无聊' : '平静';
    }
    s.lastSeen = now;
    s.lastInteraction = now;
    s.asleep = false;
    saveState(s);
    return s;
  }

  function saveState(s) {
    try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {}
  }

  function readLayout() {
    try { return JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}') || {}; } catch (e) { return {}; }
  }

  function saveLayout(patch) {
    try {
      var current = readLayout();
      Object.keys(patch).forEach(function (k) { current[k] = patch[k]; });
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(current));
    } catch (e) {}
  }

  function pageContext() {
    var path = location.pathname;
    var section = '首页';
    var known = [
      ['/posts/', '文章'],
      ['/moments/', '时刻'],
      ['/archive/', '归档'],
      ['/links/', '友链'],
      ['/about/', '关于'],
      ['/work/', '工坊'],
      ['/search', '搜索'],
      ['/categories/', '分类'],
      ['/tags/', '标签'],
      ['/author/', '作者'],
    ];
    for (var i = 0; i < known.length; i++) {
      if (path.indexOf(known[i][0]) === 0) {
        section = known[i][1];
        break;
      }
    }
    return { title: document.title || '', section: section, path: path };
  }

  function siteTheme() {
    var t = document.documentElement.getAttribute('data-theme') || 'auto';
    if (t === 'dark') return 'dark';
    if (t === 'light') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme() {
    if (!root) return;
    root.dataset.spTheme = siteTheme();
  }

  function watchTheme() {
    applyTheme();
    if (window.MutationObserver) {
      new MutationObserver(applyTheme).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });
    }
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', applyTheme);
  }

  function bindLifecycle() {
    var saveAway = function () {
      state.lastSeen = Date.now();
      saveState(state);
    };
    window.addEventListener('pagehide', saveAway);
  }

  function supportsWebm() {
    try {
      return !!document.createElement('video').canPlayType('video/webm; codecs="vp9"');
    } catch (e) {
      return false;
    }
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // ——————————————————————————————————————————————————————————————
  // 样式
  // ——————————————————————————————————————————————————————————————
  function injectCss() {
    if (document.getElementById('site-pet-style')) return;
    var css = [
      '#site-pet{position:fixed;z-index:950;width:var(--sp-w);height:var(--sp-h);pointer-events:none;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;',
      '--sp-w:240px;--sp-h:250px;--sp-vh:300px;--sp-bg:rgba(255,255,255,.95);--sp-fg:#1b2947;',
      '--sp-line:rgba(45,70,120,.16);--sp-accent:#3b62f6;--sp-muted:#6b7891;user-select:none;-webkit-user-select:none}',
      '#site-pet[data-size="s"]{--sp-w:230px;--sp-h:220px;--sp-vh:264px}',
      '#site-pet[data-size="l"]{--sp-w:300px;--sp-h:290px;--sp-vh:348px}',
      '#site-pet[data-sp-theme="dark"]{--sp-bg:rgba(20,28,46,.95);--sp-fg:#eaf0ff;--sp-line:rgba(140,175,255,.2);--sp-accent:#7b9bff;--sp-muted:#a8b6d6}',
      '.sp-stage{position:relative;width:100%;height:100%;pointer-events:auto;cursor:grab;touch-action:none;',
      'outline:none;filter:drop-shadow(0 14px 20px rgba(25,40,75,.2))}',
      '.sp-stage:active{cursor:grabbing}',
      '@keyframes sp-tap-nudge{0%{transform:scale(1)}34%{transform:scale(1.055) translateY(-3px)}100%{transform:scale(1)}}',
      '.sp-stage.sp-tapped{animation:sp-tap-nudge .34s ease-out}',
      '.sp-stage:focus-visible{outline:2px solid var(--sp-accent);outline-offset:5px;border-radius:14px}',
      '.sp-video,.sp-poster{position:absolute;left:50%;top:50%;height:var(--sp-vh);width:auto;max-width:none;',
      'transform:translate(-50%,-50%);pointer-events:none;background:transparent;opacity:0;transition:opacity .22s ease;',
      '-webkit-user-drag:none}',
      '.sp-video.sp-front{opacity:1}',
      '.sp-stage.sp-poster-only .sp-video{display:none!important}',
      '.sp-video::-webkit-media-controls,.sp-video::-webkit-media-controls-enclosure{display:none!important}',
      '.sp-video::-webkit-media-controls-start-playback-button{display:none!important;-webkit-appearance:none}',
      '.sp-video{-webkit-tap-highlight-color:transparent}',
      '.sp-poster{opacity:1}',
      '.sp-poster.sp-hidden{opacity:0}',
      '.sp-canvas{position:absolute;left:50%;top:50%;height:var(--sp-vh);width:auto;max-width:none;',
      'transform:translate(-50%,-50%);pointer-events:none;opacity:0;transition:opacity .18s ease;z-index:1}',
      '.sp-canvas.sp-on{opacity:1}',
      '.sp-stage.sp-canvas-mode .sp-video{display:none!important}',
      '.sp-poster-only .sp-poster{animation:sp-post-float 3.4s ease-in-out infinite}',
      '.sp-bubble{position:absolute;left:0;bottom:calc(100% + 4px);z-index:7;max-width:min(260px,calc(100vw - 24px));',
      'min-width:118px;padding:9px 12px 8px;background:var(--sp-bg);color:var(--sp-fg);border:1px solid var(--sp-line);',
      'border-radius:14px;box-shadow:0 10px 28px rgba(20,35,65,.18);backdrop-filter:blur(12px);',
      'font-size:12.5px;line-height:1.55;pointer-events:auto;opacity:0;visibility:hidden;',
      'transform:translateY(4px);transition:opacity .18s ease,transform .18s ease}',
      '.sp-bubble.sp-on{opacity:1;visibility:visible;transform:translateY(0)}',
      '.sp-bubble:after{content:"";position:absolute;left:var(--sp-arrow-x,50%);bottom:-6px;width:12px;height:12px;',
      'margin-left:-6px;background:var(--sp-bg);border-right:1px solid var(--sp-line);border-bottom:1px solid var(--sp-line);',
      'transform:rotate(45deg);border-radius:0 0 3px 0}',
      '.sp-bubble.sp-below:after{top:-6px;bottom:auto;border-right:0;border-bottom:0;',
      'border-left:1px solid var(--sp-line);border-top:1px solid var(--sp-line);border-radius:3px 0 0 0}',
      '.sp-bubble-head{display:flex;align-items:center;gap:6px;margin-bottom:3px;font-size:10.5px;',
      'letter-spacing:.04em;color:var(--sp-accent);font-weight:600}',
      '.sp-dot{width:6px;height:6px;border-radius:50%;background:var(--sp-accent);flex:none}',
      '.sp-face{width:16px;height:16px;border-radius:50%;object-fit:cover;flex:none;background:#2b3550}',
      '.sp-bubble-body{max-height:180px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}',
      '.sp-bubble-foot{margin-top:4px;font-size:10px;color:var(--sp-muted);min-height:0}',
      '.sp-bubble-body::-webkit-scrollbar{width:4px}',
      '.sp-bubble-body::-webkit-scrollbar-thumb{background:var(--sp-line);border-radius:3px}',
      '.sp-dock{position:absolute;left:50%;top:calc(100% - 2px);transform:translateX(-50%) translateY(4px);',
      'display:flex;gap:4px;padding:4px;background:var(--sp-bg);border:1px solid var(--sp-line);border-radius:999px;',
      'box-shadow:0 8px 20px rgba(20,35,65,.16);pointer-events:none;white-space:nowrap;z-index:5;',
      'opacity:0;visibility:hidden;transition:opacity .18s ease,transform .18s ease,visibility .18s ease}',
      '#site-pet:hover .sp-dock,#site-pet:focus-within .sp-dock,#site-pet.sp-active .sp-dock{',
      'opacity:1;visibility:visible;pointer-events:auto;transform:translateX(-50%) translateY(0)}',
      '.sp-dock button{border:0;background:transparent;color:var(--sp-fg);font:inherit;font-size:11.5px;',
      'padding:4px 7px;border-radius:999px;cursor:pointer;line-height:1.4}',
      '.sp-dock button:hover{background:rgba(80,120,240,.12);color:var(--sp-accent)}',
      '.sp-panel{position:absolute;left:0;bottom:calc(100% + 8px);z-index:8;width:min(300px,calc(100vw - 24px));',
      'max-height:min(330px,55vh);overflow:auto;background:var(--sp-bg);color:var(--sp-fg);',
      'border:1px solid var(--sp-line);border-radius:14px;padding:10px;box-shadow:0 16px 40px rgba(20,35,65,.24);',
      'backdrop-filter:blur(16px);pointer-events:auto;display:none;font-size:12px}',
      '.sp-panel.is-on{display:block}',
      '.sp-panel{scrollbar-width:thin;scrollbar-color:var(--sp-line) transparent;scrollbar-gutter:stable}',
      '.sp-panel::-webkit-scrollbar{width:6px}',
      '.sp-panel::-webkit-scrollbar-thumb{background:var(--sp-line);border-radius:3px}',
      '.sp-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;',
      'font-size:12.5px;padding-right:2px}',
      '.sp-x{border:0;background:transparent;color:var(--sp-fg);opacity:.55;font-size:16px;line-height:1;',
      'padding:2px 5px;cursor:pointer;border-radius:6px}',
      '.sp-x:hover{opacity:1;background:rgba(80,120,240,.12)}',
      '.sp-group-title{font-size:11px;color:var(--sp-muted);margin:7px 0 4px;font-weight:600}',
      '.sp-grid{display:flex;flex-wrap:wrap;gap:4px}',
      '.sp-chip{border:1px solid var(--sp-line);background:transparent;color:var(--sp-fg);font:inherit;',
      'font-size:11px;padding:3px 8px;border-radius:7px;cursor:pointer;line-height:1.5}',
      '.sp-chip:hover{background:var(--sp-accent);color:#fff;border-color:transparent}',
      '.sp-size-row{display:flex;align-items:center;gap:5px;margin-top:10px;padding-top:8px;',
      'border-top:1px solid var(--sp-line);font-size:11px;color:var(--sp-muted)}',
      '.sp-size-row button{border:1px solid var(--sp-line);background:transparent;color:var(--sp-fg);',
      'font:inherit;font-size:11px;padding:3px 9px;border-radius:6px;cursor:pointer}',
      '.sp-size-row button:hover{border-color:var(--sp-accent);color:var(--sp-accent)}',
      '.sp-credit{margin-top:8px;font-size:10px;line-height:1.45;color:var(--sp-muted);opacity:.8}',
      '.sp-status-id{display:flex;align-items:center;gap:8px;margin-bottom:2px}',
      '.sp-status-face{width:34px;height:34px;border-radius:50%;object-fit:cover;flex:none;background:#2b3550}',
      '.sp-status-who{display:flex;flex-direction:column;flex:1;min-width:0}',
      '.sp-status-name{font-size:13px;line-height:1.3}',
      '.sp-status-group{font-size:10px;color:var(--sp-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.sp-status-asleep{font-size:10px;color:var(--sp-muted);border:1px solid var(--sp-line);border-radius:999px;padding:1px 7px;flex:none}',
      '.sp-status-asleep.is-asleep{color:var(--sp-accent);border-color:var(--sp-accent)}',
      '.sp-status-mood{font-size:11.5px;color:var(--sp-muted);margin:2px 0}',
      '.sp-status-mood b{color:var(--sp-fg)}',
      '.sp-status-meter{margin-top:7px}',
      '.sp-status-meter-head{display:flex;justify-content:space-between;font-size:10.5px;color:var(--sp-muted);margin-bottom:3px}',
      '.sp-status-meter-head b{color:var(--sp-fg);font-variant-numeric:tabular-nums}',
      '.sp-status-bar{height:6px;background:rgba(80,120,240,.14);border-radius:999px;overflow:hidden}',
      '.sp-status-fill{display:block;height:100%;width:0;background:var(--sp-accent);border-radius:999px;transition:width .25s ease}',
      '.sp-status-fill.sp-status-satiety{background:#22a06b}',
      '.sp-status-fill.sp-status-boredom{background:#8b7cf6}',
      '.sp-status-fill.is-low,.sp-status-fill.is-high{background:#d97706}',
      '.sp-status-stats{display:flex;gap:10px;flex-wrap:wrap;font-size:10.5px;color:var(--sp-muted);margin-top:9px}',
      '.sp-status-engine{font-size:10px;line-height:1.5;color:var(--sp-muted);margin-top:7px;word-break:break-all}',
      '.sp-status-stats b{color:var(--sp-fg);font-variant-numeric:tabular-nums}',
      '.sp-status-actions{display:flex;gap:6px;margin-top:9px;padding-top:8px;border-top:1px solid var(--sp-line)}',
      '.sp-status-actions button{flex:1;border:1px solid var(--sp-line);background:transparent;color:var(--sp-fg);font:inherit;font-size:11px;padding:4px 6px;border-radius:7px;cursor:pointer}',
      '.sp-status-actions button:hover{background:var(--sp-accent);color:#fff;border-color:transparent}',
      '.sp-chat-input{position:relative}',
      '.sp-chat textarea{width:100%;box-sizing:border-box;resize:none;min-height:58px;font:inherit;font-size:12px;',
      'color:var(--sp-fg);background:transparent;border:1px solid var(--sp-line);border-radius:9px;',
      'padding:7px 60px 26px 9px;outline:none;line-height:1.5}',
      '.sp-chat textarea:focus{border-color:var(--sp-accent)}',
      '.sp-chat .sp-send{position:absolute;right:5px;bottom:5px;border:1px solid transparent;background:var(--sp-accent);',
      'color:#fff;font:inherit;font-size:11.5px;padding:4px 10px;border-radius:7px;cursor:pointer}',
      '.site-pet-mini{position:fixed;left:10px;bottom:12px;z-index:951;display:flex;align-items:center;gap:7px;',
      'border:1px solid rgba(59,98,246,.18);border-radius:999px;background:rgba(255,255,255,.92);',
      'padding:4px 11px 4px 4px;box-shadow:0 8px 22px rgba(28,44,80,.18);cursor:pointer;',
      '-webkit-tap-highlight-color:transparent;backdrop-filter:blur(10px);',
      'animation:site-pet-mini-float 3.4s ease-in-out infinite}',
      '.site-pet-mini img{display:block;width:48px;height:48px;border-radius:50%;object-fit:cover;border:1.5px solid #fff;background:#2b3550}',
      '.site-pet-mini span{font:600 12px/1 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:#24418f}',
      '[data-theme="dark"] .site-pet-mini{background:rgba(18,26,48,.9);border-color:rgba(140,175,255,.2)}',
      '[data-theme="dark"] .site-pet-mini span{color:#eaf0ff}',
      '@media (prefers-color-scheme:dark){[data-theme="auto"] .site-pet-mini{background:rgba(18,26,48,.9);border-color:rgba(140,175,255,.2)}',
      '[data-theme="auto"] .site-pet-mini span{color:#eaf0ff}}',
      '.site-pet-restore{position:fixed;right:18px;bottom:18px;z-index:951;border:1px solid rgba(59,98,246,.22);',
      'border-radius:999px;background:rgba(255,255,255,.94);color:#24418f;',
      'font:600 12px/1.4 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;',
      'padding:8px 14px;box-shadow:0 8px 22px rgba(28,44,80,.18);cursor:pointer;',
      '-webkit-tap-highlight-color:transparent;backdrop-filter:blur(10px)}',
      '[data-theme="dark"] .site-pet-restore{background:rgba(18,26,48,.9);color:#eaf0ff;border-color:rgba(140,175,255,.2)}',
      '@media (prefers-color-scheme:dark){[data-theme="auto"] .site-pet-restore{background:rgba(18,26,48,.9);color:#eaf0ff;border-color:rgba(140,175,255,.2)}}',
      '@keyframes site-pet-mini-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}',
      '@keyframes sp-post-float{0%,100%{transform:translate(-50%,-50%) translateY(0)}50%{transform:translate(-50%,-50%) translateY(-4px)}}',
      '@media (max-width:760px){#site-pet{--sp-w:200px;--sp-h:200px;--sp-vh:240px}',
      '#site-pet[data-size="s"]{--sp-w:170px;--sp-h:170px;--sp-vh:204px}',
      '#site-pet[data-size="l"]{--sp-w:230px;--sp-h:230px;--sp-vh:276px}',
      '.sp-stage{filter:none}',
      '.sp-dock button,.sp-panel button{touch-action:manipulation;-webkit-tap-highlight-color:transparent}',
      '.sp-dock{gap:3px;padding:3px;opacity:.9;visibility:visible;pointer-events:auto;transform:translateX(-50%)}',
      '.sp-dock button{font-size:10.5px;padding:3px 5px}',
      '.sp-bubble{max-width:78vw;font-size:12px}.sp-panel{max-height:min(330px,50vh)}',
      '.site-pet-mini{left:8px;bottom:12px}.site-pet-restore{right:12px;bottom:14px;font-size:11px;padding:7px 12px}}',
      '@media (hover:none){.sp-dock{opacity:.9;visibility:visible;pointer-events:auto;transform:translateX(-50%)}}',
      '@media (prefers-reduced-motion:reduce){.sp-bubble,.sp-video,.sp-poster,.sp-dock{transition:none}',
      '.site-pet-mini,.sp-poster-only .sp-poster,.sp-stage.sp-tapped{animation:none}}',
      '@media print{#site-pet,.site-pet-mini,.site-pet-restore{display:none!important}}',
    ].join('');
    var style = document.createElement('style');
    style.id = 'site-pet-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ——————————————————————————————————————————————————————————————
  // 测试 / 控制台接口
  // ——————————————————————————————————————————————————————————————
  window.SitePet = {
    ask: ask,
    feed: feed,
    poke: poke,
    sleep: goSleep,
    wake: wake,
    play: play,
    hide: hidePet,
    show: showPet,
    menu: openMenu,
    state: function () { return state; },
    config: function () { return CFG; },
    context: function () { return context; },
    anim: function () { return active ? active.key : null; },
    posterOnly: function () { return usePosterOnly; },
    spriteMode: function () { return useMobileCanvas; },
    imageMode: function () { return isMobileBrowser; },
    engine: function () { return engineName; },
    engineInfo: engineInfo,
    alphaChecked: function () { return alphaChecked; },
    canvasSize: function () { return canvasEl ? canvasEl.width + 'x' + canvasEl.height : 'none'; },
    spriteCache: function () { return Object.keys(spriteImages); },
    spriteScale: function () { return spriteScale; },
    spriteDrawAvg: function () { return Math.round(spriteDrawAvg * 10) / 10; },
    frameIndex: function () { return spriteAnim ? spriteAnim.last : -1; },
    dragging: function () { return !!drag; },
    spriteKeep: function () { return spriteKeep; },
  };
})();
