---
title: "短代码清单：后台编辑器能插哪些"
date: "2026-09-15"
draft: false
author: "zero-author"
description: "figure、bilibili、note 等短代码的写法与在文章页里的效果。"
categories:
  - "演示"
tags:
  - "短代码"
img: ""
toc: true
math: false
comments: true
---

后台写作页有「短代码」入口，点一下就带着参数模板插进正文；下面这几条是常用写法。

{{< figure src="/img/author.svg" alt="示例图片" caption="图注：figure 短代码支持 src / alt / caption / link" >}}

外部图片只放行 `http(s)://` 与协议相对地址，`javascript:` 之类的地址会被丢掉并提示缺参数。

## 何时用哪个

- 只想插一张图：直接 `![说明](地址)` 就行，主题会走统一的图片懒加载。
- 需要图注或点图放大：用 `figure`。
- 嵌视频：用对应的站点短代码，别贴 `<iframe>`，正文里的原始 HTML 不受白名单保护。
