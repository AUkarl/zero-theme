---
title: "时刻"
type: "moments"
layout: "list"
outputs: ["HTML", "RSS"]
# 时刻不生成详情页：卡片、评论、点赞、收藏都留在 /moments/ 时间线上。
# list=always 让每条时刻仍出现在 .Site.RegularPages 里，时间线才有数据。
cascade:
  build:
    render: never
    list: always
build:
  render: always
---
