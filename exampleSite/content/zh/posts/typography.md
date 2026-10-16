---
title: "排版样张：一篇把所有元素都排一遍"
date: "2026-09-08"
draft: false
author: "zero-author"
description: "标题、列表、引用、表格、代码块、脚注、图片与提示块的实际渲染效果。"
categories:
  - "演示"
tags:
  - "排版"
  - "Markdown"
img: ""
toc: true
math: false
comments: true
---

正文第一段用来测试摘要与首字下沉：中文标点、英文 mixed、以及「引号」与书名号《》在同一段里的观感。

## 二级标题

### 三级标题

#### 四级标题

- 无序列表第一项
- 第二项，里面带一段行内代码：`pnpm check`
  - 嵌套一层
  - 再一条

1. 有序列表第一项
2. 第二项
3. 第三项

> 引用块：用于说明「这一句是引用」。
>
> 引用里的第二段。

| 名称 | 位置 | 说明 |
| --- | --- | --- |
| zero-theme | Hugo 主题 | 负责渲染 |
| zero-cms | 后台 | 负责写内容 |
| zero-api | Worker | 负责接口 |

```ts
export function greet(name: string): string {
  return `你好，${name}`;
}
```

```bash
cd zero-stack && pnpm check
```

行内公式与脚注：Hugo 需要单独开启 math[^1]。

[^1]: 脚注会出现在正文末尾，文章页的 `math: true` 打开才渲染公式。

![图片示例](/img/author.svg)

---

分隔线之后是最后一段，用来验证分隔线两侧的间距。
