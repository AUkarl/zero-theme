(function () {
  'use strict';

  // 工具页文案（站点只中文）：分类名与子项名直接用 data/tools.yaml 里的中文，
  // 这里只补充按钮 / 提示这类交互文案
  var TEXT = {
    'tool-convert': '转换', 'tool-converting': '模拟转换中...', 'tool-demo': '（演示功能）',
    'tool-query': '查询', 'tool-querying': '模拟查询中...', 'tool-input-host': '输入域名或IP',
    'tool-preview': '预览', 'tool-previewing': '模拟预览',
    'tool-developing': '此工具正在开发中，敬请期待。', 'tool-learn': '了解详情', 'tool-in-dev': '工具开发中'
  };

  function t(key) {
    return TEXT[key] || key;
  }

  function renderTools() {
    var container = document.getElementById('toolsContainer');
    if (!container || !window.toolsData) return;
    container.innerHTML = '';
    window.toolsData.forEach(function (cat) {
      var catDiv = document.createElement('div');
      catDiv.className = 'tool-category';
      catDiv.setAttribute('data-reveal', '');
      var subHtml = cat.subItems.map(function (sub) {
        return '<span class="tool-sub-item" data-category="' + cat.category + '" data-sub="' + sub + '">' + sub + '</span>';
      }).join('');
      catDiv.innerHTML = '<div class="cat-title"><span class="emoji">' + cat.emoji + '</span> ' + cat.category + '</div><div class="tool-sub-items">' + subHtml + '</div>';
      container.appendChild(catDiv);
    });
    bindToolEvents();
    // 分类卡片进入视口时错开淡入（渲染完再注册，避免刚生成就被判定为已进入）
    if (window.Motion) {
      requestAnimationFrame(function () { window.Motion.reveal(container); });
    }
  }

  function bindToolEvents() {
    document.querySelectorAll('.tool-sub-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var category = this.dataset.category;
        var sub = this.dataset.sub;
        document.querySelectorAll('.tool-sub-item').forEach(function (el) { el.classList.remove('active-tool'); });
        this.classList.add('active-tool');
        var toolDisplay = document.getElementById('toolDisplay');
        var toolDisplayName = document.getElementById('toolDisplayName');
        var toolInterface = document.getElementById('toolInterface');
        toolDisplay.classList.add('show');
        toolDisplayName.textContent = category + ' · ' + sub;
        var html = '';
        if (sub === '格式转换' || sub === '音频转换' || sub === '图片压缩' || sub === '代码格式化') {
          html = '<input type="file" /><button onclick="alert(\'' + t('tool-converting') + '\')">' + t('tool-convert') + '</button><span class="hint">' + t('tool-demo') + '</span>';
        } else if (sub === 'IP查询') {
          html = '<input type="text" placeholder="' + t('tool-input-host') + '" value="example.com" /><button onclick="alert(\'' + t('tool-querying') + '\')">' + t('tool-query') + '</button><span class="hint">' + t('tool-demo') + '</span>';
        } else if (sub === 'Markdown预览') {
          html = '<textarea rows="3" style="width:100%;font-family:inherit;"># Title\n**Bold** *Italic*</textarea><button onclick="alert(\'' + t('tool-previewing') + '\')">' + t('tool-preview') + '</button>';
        } else {
          html = '<span class="hint">' + t('tool-developing') + '</span><button onclick="alert(\'' + t('tool-in-dev') + '\')">' + t('tool-learn') + '</button>';
        }
        toolInterface.innerHTML = html;
      });
    });
  }

  renderTools();
})();
