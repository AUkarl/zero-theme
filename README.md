# zero

一个为个人站点写的 Hugo 主题：**静态页面 + 自建动态后端**。
文章、时刻（朋友圈式动态）、友链、关于页、工坊页都是 Hugo 构建出来的静态 HTML；
评论、点赞收藏、订阅、访问统计、账号体系由配套的 [zero-stack](https://github.com/AUkarl/zero-stack) 在 Cloudflare 上提供，
页面加载后由主题自己的运行时接管。不想要后端也能纯静态跑，想要就填一个地址。

主题本体零框架、零构建工具：Hugo + 原生 CSS 变量 + 手写 ES5 风格 JS，
唯一的外部产物是评论组件 `zero-comment.js`（Svelte 编译出的自定义元素，直接放在仓库里）。

## 效果清单

| 页面 | 路径 | 内容 |
| --- | --- | --- |
| 落地页 | `/` | 可完全配置的 Bento 首屏：标语、进入按钮、统计条、封面卡；不想要就直接跳文章列表 |
| 文章列表 | `/home/` | 精选置顶 + 热度排序、分类 / 标签筛选、分页、封面 WebP |
| 文章页 | `/posts/<slug>/` | 右侧目录（可关）、修改时间、代码高亮、KaTeX / MathJax、图片灯箱、点赞收藏条、作者框与赞赏、评论区、上一篇 / 下一篇、相关文章 |
| 时刻页 | `/moments/` | 卡片时间线，Git 里的 Markdown 与数据库动态混排，图片九宫格、音乐、地点、按需展开的评论 |
| 归档页 | `/archive/` | 按年时间线 + 弹幕标签云（可关）+ 分类筛选 + 站内搜索 |
| 友链页 | `/links/` | 四个 tab：朋友动态 / 左邻右舍 / 站点联盟 / 在线申请；失联自动进「迷失的小船」 |
| 关于 / 工坊 | `/about/` `/work/` | 全部由 `data/*.json` 驱动，后台可视化编辑 |
| 订阅页 | `/subscribe/` | 邮箱订阅 + 双重确认，文章页内嵌订阅框 |
| 账号页 | `/account/` `/account/me/?u=@标识` | 登录 / 注册 / 找回密码；用户中心七个面板（资料、评论、收藏、友链、投稿、认证、注销）与两步验证开关 |
| 分类 / 标签 / 作者 | `/categories/` `/tags/` `/author/` | Hugo taxonomy 聚合页。**这些页面只给站点自己声明过的分类法生成**：主题的 `layouts/taxonomy/` 备好了 `author.html` / `category.html` / `tag.html` 三份模板，而 Hugo 不读主题里的 `[taxonomies]` —— 要在站点的 `hugo.toml` 写 `[taxonomies] author = "author"`（`pnpm create:site` 生成的那份把 `author` / `category` / `tag` 三行都声明了，新站开箱就有这三个聚合页；不想要哪一个，把站点 `hugo.toml` 里那行注释掉即可）。作者页带资料卡与文章列表，地址是 **`/author/<标识>/`**，不是 `/authors/` |
| 站内搜索 | `/search/` | 构建期生成索引（标题 / 标签 / 摘要 / 正文），纯前端搜索、零依赖、不经过后端；支持 `?q=` 直达与高亮。缺省没建这一页的站不会有任何变化（见下） |
| RSS / sitemap / robots | `/index.xml` `/sitemap.xml` `/robots.txt` | 全部读同一份 SEO 配置 |

其它能力：暗色模式（跟随系统 + 手动切换 + 全站偏好持久化）、完整响应式（360 → 1920 无横向溢出）、
页面切换加载层、回到顶部 / 评论锚点按钮、键盘可达的导航与 tab、`prefers-reduced-motion` 降级、
`skip-link` 跳转主内容、SEO 结构化数据、Open Graph、Twitter Card、主题色。

## 技术栈

| 层 | 用什么 | 版本要求 |
| --- | --- | --- |
| 静态构建 | Hugo **extended**（主题用到图片处理，非 extended 会构建失败） | `min_version = 0.128.0`，本项目已验证 0.165.0 |
| 样式 | 原生 CSS + `:root` 变量令牌，构建时 minify + 指纹，无预处理器 | — |
| 脚本 | 手写 JS（`assets/js/*.js`），同样 minify + fingerprint，全部 `defer` | 支持到无模块化旧浏览器 |
| 评论 / 点赞 / 订阅组件 | Svelte 5 编译出的 Web Component（`assets/js/zero-comment.js`，122KB / gzip 44KB，由 zero-stack 产出后同步进来）。不再每页硬加载：`zero-component-lazy.js` 探针等到页面上真有一枚组件进到视野附近才下载，落地页 / 关于 / 归档 / 404 一枚都没有，那 44KB 干脆不下 | — |
| 图标 | Font Awesome 6.4.2 打进仓库（`static/fa/`，css + 四个 woff2，共 389KB），不请求任何外部域名；`cdn.font_awesome_css` 填了才改用你的镜像 | — |
| 数学 | 页面 front matter `math: true` 才加载 MathJax（或 KaTeX 短代码） | — |
| 字体 | **只用系统字体栈**（`--font`）。曾经引过 Google Fonts，国内不可达且字体晚到导致正文重排（文章页 CLS 0.13），已彻底去掉 | — |
| 示例站部署 | Cloudflare Pages + GitHub Actions（`.github/workflows/demo.yml`） | — |

## 目录结构

```
layouts/
  index.html                落地页（自带内联样式的独立 <head>）
  _default/                 baseof / list / single / terms
  home/ about/ archive/ links/ moments/ account/ privacy/ subscribe/ work/          各页面模板
  taxonomy/                 category / tag / author
  _markup/render-image.html Markdown 图片钩子（走下面的图片管线）
  shortcodes/               16 个短代码：audio(-163/-qq/-kugou) video(-bilibili/-tencent/-youku/-youtube)
                            music163 bilibili youtube katex notice blockquote code figure gallery
  partials/                 60 余个部件，其中 zero/ 是与后端联动的那一组
assets/css/                 17 个样式表：common motion article archive links about work shuo
                            zero zero-account zero-apply zero-subscribe account account-me
                            home home-bento shortcodes
assets/js/                  22 个脚本，运行时入口是 zero-runtime.js（挂 window.ZeroStack）
assets/js/zero-comment.js   评论组件产物（Svelte 编译结果，直接提交进仓库）
config/_default/params.toml 主题默认参数，24 段全带注释
i18n/zh.yaml                界面文案，可整份复制到你自己的仓库里覆盖
archetypes/                 default / posts / moments 三种内容脚手架
exampleSite/                演示站点（含示例内容、data/ 与图片），npm run dev 直接看主题长什么样
scripts/                    link-theme.mjs（把主题软链到 exampleSite）、sync-comment.mjs（接收评论组件产物）
theme.toml  LICENSE
```

主题仓库的 `static/` **不是空的**，里面有两类东西：
`static/fa/`（Font Awesome 6.4.2 的 css 与四个 woff2，打进仓库、不请求外部域名，共 389KB），
以及 `static/img/` 那五张**兜底图** —— `logo-nav.png`、`logo-favicon.png`、`bj.png`、`bj2.png`、`avatar.png`，
模板在站点没配图时就按这些相对地址取（`img/logo-nav.png` 做站点 Logo 与 favicon、`img/bj.png` 做时刻页横幅兜底）。
你自己的图片放在**你自己站点仓库**的 `static/img/` 里同名覆盖即可，或在后台「前端管理 → 基本信息」填地址；
示例站的其它图在 `exampleSite/static/img/`，那是示例内容，不随主题分发。

---

## 安装

### 方式一：Hugo Modules（推荐，升级最省事）

```bash
cd 你的站点
hugo mod init 你的模块名          # 例如 github.com/you/zero-site
```

`config/_default/config.toml`：

```toml
[module]
  [[module.imports]]
    path = "github.com/AUkarl/zero-theme"
```

首次 `hugo server` 会自动拉取。升级：`hugo mod get -u ./...`。

这条路有两个前置条件，缺一个就报 `module does not exist` 或 `binary with name "go" not found in PATH`：

1. 本机 `PATH` 里要能找到 `go`（Hugo 不读 `GOROOT`，也不看注册表 —— Go 装了但不在 PATH 一样失败）。
   **Go 装在哪个盘都无所谓**，把实际安装目录下的 `bin` 加进 PATH 即可：
   PowerShell 临时试 `$env:PATH += ";E:\Program Files\Go\bin"`，验证 `go version` 有输出后
   `setx PATH "$env:PATH"` 持久化（重开终端生效）；macOS/Linux 通常是 `/usr/local/go/bin` 或 brew 目录，已在 PATH 内。
2. 站点自己也得是模块，先 `hugo mod init github.com/你/你的站点仓库`，再 `hugo mod get -u github.com/AUkarl/zero-theme`。

网络到不了 `proxy.golang.org` 时，让 Go 直接走 git：`setx GOPRIVATE "github.com/AUkarl/*"`（或临时 `$env:GOPRIVATE='github.com/AUkarl/*'`）。
CI 里同样要有 Go，否则就在 Pages 构建镜像里预装、或者改用方式二/方式三。

### 方式二：Git Submodule

```bash
git submodule add https://github.com/AUkarl/zero-theme themes/zero
git submodule update --init --recursive      # 换机器 / clone 之后
```

### 方式三：手动复制

把仓库内容复制进 `themes/zero/`。想改主题又不想维护 fork 的话，
用 zero-stack 的 `pnpm create:site` 生成的仓库结构（submodule + 本地覆盖目录）更省心。

### 只想看主题本身长什么样

```bash
cd zero-theme
npm run dev          # 先 link-theme 再把 exampleSite 软链成主题，再 hugo server --source exampleSite
npm run build        # hugo --minify 构建示例站
```

`link-theme.mjs` 只在 `exampleSite/themes` 里建一个指回主题目录的软链，不复制文件。

---

## 配置从哪里来（三层，看清楚再动手）

```
站点 data/*.json（后台「前端管理」写的那批）   ← 最高，构建期直接读
  > 你的站点 config/_default/params.toml       ← 只写要覆盖的项
  > 主题 config/_default/params.toml           ← 全部默认值，24 段带注释
```

- **`data/` 覆盖 params**：导航、首页、页脚、关于、工坊、时刻、落地页背景图、SEO 这几块都同时存在两份，
  实际生效的是 `data/*.json`。想改标题 / 页脚 / 导航，走后台「前端管理」，不要去改 params。
- **友链页的申请说明是另一套兜底**：`data/apply.json`（友链要求 / 我的信息 / 提交示例）没有对应 params，
  它的兜底是友链页自己的正文 `content/links/_index.md`；三段全空时前台照旧显示正文里手写的 `.apply-col`。
- **params 的键名大小写**：Hugo 会把 params 键小写化存储、读取时大小写不敏感，
  所以 params 里怎么写都行；但 `data/*.json` 的键**区分大小写**，SEO 那一份统一用 snake_case。
- **`/robots.txt` 取决于站点有没有开 `enableRobotsTXT`**：Hugo 只有在配置里写了这一项才会渲染主题的
  `layouts/robots.txt`；没开就是 404（不是「Hugo 用内置规则覆盖了本文件」）。`pnpm create:site` 生成的
  `hugo.toml` 已带这一项，早先自己建的站补一行即可。
- **`data/seo.json` 写成驼峰不是「报错」而是「整份作废」**：主题自带一份 `themes/zero/data/seo.json`（snake_case 默认值），
  Hugo 先把主题那份与站点那份并成 `hugo.Data.seo`，`defaultDescription` 这种驼峰键只会作为「多出来的一个键」存在，
  模板读的始终是 `default_description` —— 于是后台 SEO 面板显示的是文件里的值（接口按驼峰归一过）、
  前台用的却是主题默认值，而站长随手点一次保存就把驼峰写成 snake_case，那一刻文件里的内容才真的生效。
  改法只有一条：把这份文件的键名改成 snake_case（在后台 SEO 页存一次就够了），别指望模板兼容驼峰。
- **只留差量**：站点 params 里不要照抄主题默认值，写了改不动，还看不出改了什么。

## params 的 24 段

| 段 | 管什么 | 值得先看的一项 |
| --- | --- | --- |
| 1 | zero-stack 自建后端 | `apiBaseURL`（空 = 全站纯静态）、`commentProvider`、开关矩阵 |
| 2 | 站点基本信息 | `navName`、`logo`、`favicon`、`avatar` |
| 3 | 图片处理管线 | `remote_fetch`、`remote_timeout`、WebP 宽度档位、`lqip` |
| 4 | 导航栏 | `controls` 里的主题切换 / 搜索 / 登录图标（`zero_account = true` 那项） |
| 5 | 外观与设计令牌 | `--accent`、圆角、间距、暗色配色，全部 CSS 变量 |
| 6 | 动效与滚动按钮 | 进入动画时长、回到顶部按钮 |
| 7 | 页面切换加载层 | 顶部进度条样式 |
| 8 | 首页落地页 | 标语数组、封面、CTA、统计条；不想用落地页就把 `/` 让给列表 |
| 9 | 首页列表 | 每页条数、排序（精选置顶 + 热度）、封面比例 |
| 10 | 文章页 | `show_toc`（目录总开关）、`show_updated`（修改时间）、`date_format`、赞赏、相关推荐 |
| 11 | 归档页 | `enable_tag_danmaku`（弹幕标签云）、搜索 |
| 12 | 时刻页 | 每页条数、卡片显示项、评论区用哪套系统 |
| 13 | 文章评论区 | `provider`（zero / waline / twikoo / giscus / artalk）、嵌套层数、是否匿名 |
| 14 | 访问统计 | 开关、排除路径（后台不想统计自己） |
| 15 | 页脚 | 版权行、备案、社交链接、`designed by` 署名 |
| 16 | 关于页 | 头像、简历块、联系项 |
| 17 | 友链页 | 各 tab 开关、`friendsEnabled`、`friendApplyEnabled`、失联文案 |
| 18 | 工具 / 工坊页 | 卡片列表来源与排序 |
| 19 | RSS | `rss.full_content`（默认输出完整正文，含封面与正文图）、`rss.limit` 条数、`rss.cover_image` 兜底封面 |
| 20 | SEO 与结构化数据 | 默认描述、OG 图、`title_separator`、verification、`robots` 各项 |
| 21 | 自定义注入 | `head_custom` / `body_custom`（统计代码、站长验证只在这里插一次） |
| 22 | 第三方资源地址 | `cdn.font_awesome_css` 留空=用主题自带的 static/fa/（不请求外部域名）；`cdn.katex_css` / `katex_js` 留空=jsdelivr |
| 23 | 作者资料 | 默认作者（站长）兜底：署名、简介、赞赏图、联系方式 |
| 24 | 全局社交链接 | 作者资料没填时的兜底 |

> `[article].show_toc = false` 是全站关目录，单篇还可以用 front matter 的 `toc: false` 再关一层；
> 关掉目录时正文自动居中（不会出现右侧一大片空白）。

## 内容 front matter 字段

后台「内容」页的结构化编辑写出的就是这些键，顺序固定（同一篇存两次不会产生无意义 diff）：

```toml
title / subtitle / date / lastmod / description / summary
categories / tags / image / cover / draft / weight / pinned
author / toc / math / comments
```

要记住的四条：

- **`date` / `lastmod` 只能写成 Hugo 认得的两类样子**：`2026-10-25` 这种纯日期，
  或 `2026-10-25T12:00:00+08:00` 这种「时分秒 + 时区」写全的时间。
  **三种写法会让 Hugo 直接报错退出：时间只到分没有秒（`2026-10-25 12:00`）、年月日改用 / 或 . 连起来（`2026/10/25`）、月份或日期越界（`2026-13-01`）**——
  `hugo --minify` 报 `ERROR the "date" front matter field is not a parsable date` 并以退出码 1 结束 ——
  后果不是这一篇不生成，而是整站一个页面都不产出 —— 托管在 Pages 上的站点就此停在上一版构建。
  手工改文件、别处同步过来的稿子最容易撞这条；走 zero-stack 后台保存会被当场拦下并给出可写的格式。
- **修改时间只认 `lastmod`**：Hugo 的 `.Lastmod` 不看 `updated`，写 `updated` 不会显示「修改于」。
  后台那个「修改时间」框现在写的就是 `lastmod`。
- **将来的日期配置里开不了**：实测 Hugo 0.165.0 既不认 `[build].future`，也不认老写法 `enableFuture = true`
  （`hugo config` 里这两项根本不出现），未来时间的整页会被默认隐藏，只有命令行 `-F/--buildFuture` 才放行。
  zero-stack 后台因此把「发布时间填在将来」的稿子保存成显式草稿并在回执里说明，到时间后取消草稿再保存一次即可上线。
- **`draft: true` 的文章不会出现在任何地方**：列表、RSS、sitemap、直接访问都是 404。
  本地想预览草稿得临时 `hugo server -D`，但平时别加 `-D` —— 加了之后「本地能看到、上线凭空少一篇」会一直重演。

---

## 接上 zero-stack

### 1. 填后端地址

`apiBaseURL` 有三个地方可以写，按环境来：

| 场景 | 写在哪 |
| --- | --- |
| 本地开发 | 站点 `config/development/params.toml`：`apiBaseURL = "http://127.0.0.1:8787"` |
| 线上 | 站点 `config/production/params.toml` 或 `config/_default/params.toml`：worker 域名 |

`hugo server` 默认 `environment = development`，会额外读 `config/development/`；
正式构建（`hugo` / `hugo --minify`，`environment = production`）不读它。
所以本地能看到动态功能、线上没有，八成就是这个键线上没填。

**不要用环境变量覆盖**：`HUGO_PARAMS_APIBASEURL=…` 会被 Hugo 小写成 `apibaseurl`，
主题读的是 `params.apiBaseURL`，两者对不上，看着进了 `hugo config` 实际什么都不渲染。

### 2. 运行时接管

每次进页面 `zero-runtime.js` 真发一次 `/api/config`（同一次页面里评论 / 点赞 / 收藏 / 时刻
共用那一次请求），把构建期写死的 provider、开关、文案对齐到后端配置，所以后台改完开关
**下一次刷新就生效，不用重新构建**。缓存只有一份 sessionStorage 的垫底：只有这次请求
打不回去时才拿它顶上，绝不拿它当答案 —— 曾经把它当答案，结果后台重新打开评论后访客要等
60 秒才看得见评论区。首屏那一次不必等接口：`data/switches.json` 的快照会被 `boot.html`
烘成 `window.__zeroSwitches`，接口回来再校正。
所以：后台把评论区切成 `zero`，前台不用发版就会换过来。

组件脚本只有一个输出点（`partials/zero/boot.html`），评论 / 点赞 / 收藏 / 时刻 / 友链申请都从那里挂载。
**不要用 `.Scratch` 做「只输出一次」的判定**：`hugo server` 下页面节点的 Scratch 会活过增量重建，
第二次渲染就什么都不输出，本地表现为「评论区高度 0」。

### 3. 开关矩阵（关掉之后前台到底什么样）

| 配置 | 效果 |
| --- | --- |
| `apiBaseURL` 为空 | 全站纯静态：评论 / 点赞 / 订阅 / 统计脚本都不加载，页面照常好看 |
| `workEnabled = false` | /work/ 工坊页同上（项目本身仍由「前端管理 → 工坊」维护） |
| `aboutEnabled = false` | /about/ 关于页同上（文案仍由「前端管理 → 关于」维护） |
| `accountSystemEnabled = false` | `/account/` 整页只留提示，导航上的登录图标消失，评论组件不再放「去登录」 |
| `commentEnabled = false` | 文章页评论区整块消失（含「发表评论」） |
| `likeEnabled` / `starEnabled = false` | 操作条里对应那颗胶囊不出现 |
| `friendsEnabled = false` | 导航「友链」消失，`/links/` 只回「该功能已关闭」 |
| `friendApplyEnabled = false` | 只隐藏申请表单，友链列表照常 |
| `subscribeEnabled = false` | 订阅页与文内订阅框消失 |
| `analytics` 开关 | 关掉后不发统计请求，也不显示访问量 |

### 4. 评论组件产物从哪来

`assets/js/zero-comment.js` 是 [zero-stack](https://github.com/AUkarl/zero-stack) 里 `packages/comment` 的构建产物。
改了组件要在 zero-stack 里：

```bash
pnpm build:comment                                   # 产出 packages/comment/dist/zero-comment.js
node ../zero-theme/scripts/sync-comment.mjs          # 复制进主题仓库（路径按你的两仓库并列位置调整）
```

---

## 图片管线（`partials/img-src.html` + `img-pair.html`）

Markdown 里的图片（以及封面、卡片图）都走同一套：

1. 站内图读进 Hugo，生成 400 / 800 / 1200 三档 WebP + 一张 20px 模糊占位；
2. 页面先渲染内联的模糊占位（不发请求），真正的 `srcset` 挂在 `data-srcset` 上；
3. `motion.js` 在图片进入视口前 200px 才把它换上，加载完成淡入盖住占位，失败就留着占位（不会出现破图）；
4. `width` / `height` 一起写进标签，图没到也不会顶动下面的文字；
5. 首屏大图（`eager`）直接给 `src` + `fetchpriority="high"`，跳过延迟；
6. 外链图默认构建时抓取后同样处理，抓不到就退回原始外链，行为和以前一致。

调的地方都在 `[image]` 段：`remote_fetch = false` 可以整站跳过抓取（图源不通时 `hugo server`
会卡在 `Start building sites …`），`remote_timeout` 调单个图源的最长等待。
旧写法顶层的 `remote_image_fetch` 仍然认，但 `[image]` 里的值优先。

## 动效与性能

- 页面样式（common / 各页专属 / motion）在构建期压缩后**内联进 `<head>`**（`partials/zero/inline-css.html`），
  省掉每份样式一次往返 —— 移动端实测首屏提前约 0.3s（本地 Lighthouse，真实网络收益更大），
  样式内容与顺序完全不变。**新增样式请别用相对 `url()`**：内联后基准路径是页面地址。
- JS 一律 `resources.Get | minify | fingerprint`，改了才换 URL，可以放心长期强缓存。
- 脚本一律 `defer`，不阻塞解析；每页只加载自己需要的模块（列表页不加载文章脚本，反之亦然）。
- 外部样式表（Font Awesome）用 `media="print" + onload` 非阻塞加载，`<noscript>` 里放一份同步的兜底；
  并且预先 `preconnect`。**曾经还引过 animate.css，但全项目没有任何 `animate__` 类在用，已经删掉** ——
  动画由 `motion.css` / `home-bento.css` 自己的 `@keyframes` 完成。
- `motion.css` 里有 `prefers-reduced-motion: reduce` 分支：系统开启「减弱动态效果」时，
  进入动画、弹幕标签云、淡入都自动降级成直接呈现。
- 会话与配置请求全站各只问一次（`window.ZeroStack.me()` / `.config()` 共用同一在途 Promise，
  账号页登录 / 注销派发 `zero:session` 时才作废重问）—— 少一次请求就少一次 Worker 与 D1 读。
- **`[home] layout = "grid"` 的首屏卡片与分页条是服务端渲的**（`layouts/partials/home-card.html` /
  `home-pager.html`，靠 `.is-skeleton` 那套 grid 布局在每个断点摆成 `--home-columns` 列）。
  之前 `#gardenGrid` 在 HTML 里是空的，二十张卡约 20KB 在 `DOMContentLoaded` 一次性插入，页脚被推下去
  约 6.3k 高 —— 手机档 CLS **0.22**（`<footer>` 一项占满），与哪次改动都无关，是这条路固有的。
  实测（同一份内容各建一次、交替跑）：手机 **0.2209 → 0**，桌面 **0.0983 → 0**。
  **改卡片形状时必须同时改 partial 与 `home.js` 里的 `cardHtml()`** —— 两边不一致会让第 1 页和
  第 2 页长得不一样（R53 那次是模板 h3→h2、JS 漏改，样式一个元素都没命中）。这一条有实测守着：
  量一次「服务端渲的那张卡」与「JS 重建的同一张卡」的属性逐项对比，本次就是它抓出
  partial 里 `%s` 打整数输出成 `%!s(int=1080)`、`width`/`height` 失效的问题。

---

## 站内搜索（`/search/`）

搜索完全在浏览器里做：Hugo 构建时把文章与时刻的标题、标签、摘要、正文生成到
`/search/index.json`，页面只取这一份索引。不依赖后端、不需要额外服务，接口挂了也照样能搜。

启用只要一个内容页（`pnpm create:site` 生成的新站已经自带）：

```
content/zh/search/_index.md
---
title: "搜索"
outputs: ["HTML", "JSON"]
robots: "noindex, follow"
---
```

`outputs` 必须写：少了 `JSON` 就只有页面、没有索引，搜索框会提示索引没加载出来。
主题不会改你的导航：要用搜索，自己在导航里加一条指向 `/search/` 的项（没建这一页时也不会多出任何入口）。
不想让某篇参与搜索：front matter 写 `searchExclude: true`。
索引正文默认截到 3000 字符，可在 `params.search.max_content` 调整。

---

## 文案自定义

界面文案在 `i18n/zh.yaml`（服务端渲染用）以及各 shell 部件里的 `i18n "…" | default "…"`。
想改措辞：**把 `i18n/zh.yaml` 复制到你站点的 `i18n/` 目录下改**，不要改主题里的文件，
这样升级主题不会覆盖你的文案。模板里的 `| default` 是最后一道保险，
键没定义也能显示出中文，不会出现空白。

## 部署自己的站点

```bash
hugo --minify                      # 产物在 public/
```

- **Cloudflare Pages**：构建命令 `hugo --minify`，输出目录 `public`，
  并设环境变量 `HUGO_VERSION`（extended 版；下限是 `min_version` 的 0.128，**zero-stack 这套按 0.165.0 验证并把生成仓库的两个 workflow 钉在同一版本**，两边不一致时容易出「本地和 Actions 都过、Pages 红」）。
  站点仓库以子模块引主题时，Pages 直连 Git 的构建**不拉子模块**，构建命令要先自己 clone 主题 —— 见 zero-stack 的 `docs/DEPLOYMENT.md` §6.3。
- **GitHub Actions**：`pnpm create:site` 生成的仓库里已经带好 workflow
  （`peaceiris/actions-hugo@v3` + Pages 部署），把 secrets 配好即可。
- **一键部署本仓库的示例站**：见仓库主页的 Deploy Button 与 `.github/workflows/demo.yml`。

### 上线检查清单

1. `hugo --minify` 本地能过，且 `hugo version` 带 `+extended`；
2. 生产参数里有 `apiBaseURL`，`/api/config` 能从站点访问到（不同源时后端 `ALLOWED_ORIGINS` 要含站点域名）；
3. `assets/js/zero-comment.js` 是最新产物（后台改了评论设置不用重发，但组件本身更新要）；
4. 草稿文章不出现在 `/index.xml`、`/sitemap.xml`、`/posts/` 列表里；
5. 手机宽度打开一篇带图文章：图片淡入、目录不挤正文、没有横向滚动；
6. 系统开「减弱动态效果」后再刷一次，动画应直接呈现；
7. 页脚 `designed by 知止` 那行保留 —— 那是主题作者的署名，不是配置项，任何开关都不该抹掉它。

## 开发主题

```bash
npm run link-theme                 # 建 exampleSite/themes 软链
npm run dev                        # hugo server --source exampleSite
node scripts/sync-comment.mjs      # 接收 ../zero-stack 产出的评论组件
```

改完主题用这两条判据验收，别只靠眼睛刷页面：

```bash
npm run build && npm run check:build          # 纯文本查产物：数据形状、样式内联、前端锚点
npm run check:behavior                        # 真浏览器跑产物：筛选/搜索/图标字形/首屏 CLS
npm run check:behavior:mobile                 # 同一套判据在 390×844 下再来一遍
```

`check:build` 无依赖，CI 里必跑（`.github/workflows/demo.yml` 已接上）。
`check:behavior` 要 playwright-core 与本机 Chrome（`CHROME_PATH` 指过去）；
缺任何一样它整体跳过并说明原因，不会假装通过，所以没放进 CI。
在别的工作区里跑它可以指认已装好的内核：
`ZERO_PLAYWRIGHT=/path/to/node_modules/playwright-core node scripts/check-behavior.mjs <产物目录>`。

改主题文件后在真实站点里验证时，记住三件事（都是踩过的坑）：

1. 同步主题进 `themes/zero` 是整目录替换，**必须重启 hugo**，否则 shortcode 注册表是旧的，
   轻则 500，重则服务直接退出；
2. 起服务用 `hugo server --disableFastRender`，否则新加的页面 / 模板改动不会重建；
3. 站点目录下 `.hugo_build.lock` 会串行化所有构建，进程被强杀后留下的锁会让之后每次构建
   一动不动地等 —— 确认没有 hugo 进程在跑再删掉它。

## 常见问题

| 现象 | 原因与解法 |
| --- | --- |
| 后台改了文章 / 设置，前台还是旧的 | 前台是静态页，要触发站点重建；本地看 `hugo server` 有没有在跑、是不是 `--disableFastRender` |
| 本地能看到某篇文章，线上没有 | 那篇是草稿（`draft: true`），本地服务是用 `-D` 起的；去掉 `-D` |
| 「修改于 …」不显示 | 只认 `lastmod`，且要和 `date` 不同才会显示；`updated` 是旧写法，Hugo 不读 |
| 未来日期的文章凭空消失 | Hugo 没有对应配置项（`[build].future` 与 `enableFuture` 都不认），只有构建命令加 `-F/--buildFuture` 才生成；后台保存时已把这类稿子转成显式草稿，到时间后取消草稿再保存 |
| 评论区高度 0 / 组件没加载 | 组件脚本没随 `zero/boot.html` 输出（不要用 `.Scratch` 去重）；或 `apiBaseURL` 没填 |
| 图片全是外链、没有 WebP | `[image] remote_fetch = false`，或图源不可达；`hugo server` 卡住就是抓取超时，调 `remote_timeout` |
| 改了 `params.toml` 没反应 | 那一项已经有 `data/*.json` 覆盖（导航 / 首页 / 页脚 / 关于 / 工坊 / 时刻 / 基本信息 / SEO 都是），改后台才对 |
| SEO 配置不生效 | `data/seo.json` 的键区分大小写，统一 snake_case；params 那份则大小写不敏感 |
| 首屏字体抖动 / 空白久 | 主题不引外部字体；若你自己加了 `head_custom` 字体链接，用 `font-display: swap` 并预留尺寸 |
| `hugo` 命令不返回 | 残留的 `.hugo_build.lock`，确认没进程后删掉 |

## 许可证

Apache-2.0，全文见仓库根目录的 `LICENSE`（与 `zero-stack` 保持一致，专利授权条款比 MIT 更明确）。
页脚的主题作者署名不属于「可自定义内容」，请保留。
