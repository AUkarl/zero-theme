#!/usr/bin/env python3
"""生成 Font Awesome 子集（solid/regular/brands）和后台可选图标清单。

用法：
  python scripts/build-fa-subset.py [--extra <内容站目录>]...

说明：
  - 清单里的图标由主题模板/数据文件 + 可选内容站里实际出现的 fa-* 类名组成；
  - 字体只保留用到的字形；CSS 里只删「纯图标字形」的 .fa-xxx:before 规则
    （基础类、尺寸/旋转/堆叠等工具类原样保留），未命中的自定义图标由 fa-css.html 回退完整 FA；
  - 生成物在 static/fa/{css,webfonts}，提交后随主题发布，构建期不需要 fonttools。
"""
from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path
from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
FA = ROOT / "static" / "fa"
CSS = FA / "css" / "all.min.css"
DATA = ROOT / "data" / "fa-icons.json"
ASSETS = ROOT / "assets" / "fa-icons.json"
STYLES = {"fa-solid": "solid", "fas": "solid", "fa-regular": "regular", "far": "regular", "fa-brands": "brands", "fab": "brands"}
COMMON = """
fa-solid fa-house fa-user fa-users fa-gear fa-magnifying-glass fa-envelope fa-envelope-open-text fa-rss fa-link fa-tag fa-tags
fa-folder fa-folder-open fa-file fa-file-alt fa-image fa-camera fa-video fa-music fa-play fa-pause fa-clock fa-calendar-days
fa-arrow-left fa-arrow-right fa-arrow-up fa-arrow-down fa-chevron-left fa-chevron-right fa-chevron-down fa-chevron-up
fa-circle-check fa-circle-info fa-circle-exclamation fa-circle-xmark fa-check fa-xmark fa-plus fa-minus fa-bars fa-ellipsis
fa-heart fa-star fa-thumbs-up fa-comment fa-comment-dots fa-share fa-share-nodes fa-copy fa-download fa-upload fa-trash
fa-pen fa-pen-to-square fa-edit fa-lock fa-key fa-shield-halved fa-shield-alt fa-eye fa-eye-slash fa-globe fa-location-dot
fa-map-location-dot fa-train-subway fa-plane fa-car fa-mug-hot fa-coffee fa-utensils fa-bell fa-book fa-bookmark fa-gift
fa-fire fa-bolt fa-wifi fa-code fa-terminal fa-database fa-server fa-cloud fa-moon fa-sun fa-adjust fa-palette fa-paintbrush
fa-language fa-robot fa-wand-magic-sparkles fa-flask fa-chart-line fa-chart-simple fa-list fa-table-list fa-table-cells-large
fa-layer-group fa-sitemap fa-plug fa-plug-circle-xmark fa-screwdriver-wrench fa-hammer fa-toolbox fa-gears fa-wrench
fa-right-to-bracket fa-right-from-bracket fa-arrow-up-right-from-square fa-external-link-alt fa-ellipsis-vertical
fa-brands fa-github fa-gitlab fa-gitee fa-weibo fa-zhihu fa-bilibili fa-instagram fa-telegram fa-x-twitter fa-twitter
fa-facebook fa-youtube fa-tiktok fa-discord fa-dribbble fa-behance fa-medium fa-linkedin fa-stack-overflow fa-dev
""".split()

def collect_icon_values(extra_dirs):
    vals = []
    roots = [ROOT / "layouts", ROOT / "assets", ROOT / "config", ROOT / "data"] + [Path(d) / p for d in extra_dirs for p in ("data", "config", "content", "layouts")]
    for base in roots:
        if not base.exists(): continue
        for f in base.rglob("*"):
            if not f.is_file() or f.suffix.lower() not in {".html",".js",".json",".toml",".yaml",".yml",".md",".css"}: continue
            try: text = f.read_text(encoding="utf-8", errors="ignore")
            except Exception: continue
            # 形如 fa-solid fa-house / fas fa-house；也收单独的 fa-house（默认 solid）
            for style, name in re.findall(r"\b(fa-(?:solid|regular|brands)|fas|far|fab)\s+(fa-[a-z0-9-]+)", text):
                vals.append((style, name))
            for name in re.findall(r"(?<![\w-])(fa-[a-z0-9-]+)(?![\w-])", text):
                vals.append(("fa-solid", name))
    return vals

def css_icon_codepoints(css, names):
    out = set()
    # 一条规则里可能多个选择器共享 content；逐个 .fa-name 匹配
    for rule in re.findall(r'([^{}]+)\{content:"\\([0-9a-fA-F]+)"\}', css):
        selectors, code = rule
        for n in names:
            if re.search(r"\.%s(?:[^\w-]|$)" % re.escape(n), selectors):
                out.add(int(code, 16))
    return out

def trim_icon_rules(css, keep_names):
    """删掉只给图标字形用的 .fa-xxx:before 规则；其余（基础/工具类）原样保留。

    一条规则可能有多个别名选择器（.fa-trash-alt:before,.fa-trash-can:before），
    只要其中一个还在清单里就整条保留，别名照旧能用。
    """
    needle = 'content:"' + chr(92)

    def repl(m):
        sels, decl = m.group(1), m.group(2)
        if needle not in decl:
            return m.group(0)
        names = []
        for part in sels.split(','):
            hit = re.fullmatch(r'\.(fa-[a-z0-9-]+):before', part.strip())
            if hit:
                names.append(hit.group(1))
        if names and not any(n in keep_names for n in names):
            return ''
        return m.group(0)

    return re.sub(r'([^{}]+)\{([^{}]*)\}', repl, css)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--extra", action="append", default=[])
    ap.add_argument("--cms", default="", help="同时把清单写成 CMS 的 fa-icons.ts（传文件路径）")
    args = ap.parse_args()
    css = CSS.read_text(encoding="utf-8")
    css_names = set(re.findall(r"\.(fa-[a-z0-9-]+)", css))
    pairs = []
    for style, name in collect_icon_values(args.extra):
        if name not in css_names: continue
        style = STYLES.get(style, "solid")
        pairs.append(f"{'fa-'+style if style != 'solid' else 'fa-solid'} {name}")
    for item in COMMON:
        parts = item.split()
        style = STYLES.get(parts[0], "solid") if len(parts) > 1 else "solid"
        name = parts[-1]
        if name in css_names: pairs.append(f"{'fa-'+style if style != 'solid' else 'fa-solid'} {name}")
    # 去重、稳定排序；保留当前模板里的 legacy 类（fas/far/fab）作为同义输入
    classes = sorted(set(pairs), key=lambda s: (s.split()[-1], s))
    # 只保留有真正 content 的 base 图标
    base_names = sorted({c.split()[-1] for c in classes})
    payload = json.dumps({"classes": classes}, ensure_ascii=False, indent=2) + "\n"
    for path in (DATA, ASSETS):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(payload, encoding="utf-8")
    print(f"catalog: {len(classes)} classes -> {DATA} / {ASSETS}")
    if args.cms:
        cms = Path(args.cms)
        cms.parent.mkdir(parents=True, exist_ok=True)
        lines = [
            "// 由 zero-theme/scripts/build-fa-subset.py 生成的图标清单；主题子集与后台选择器共用。",
            "export const FA_ICON_CLASSES: string[] = [",
        ]
        lines += [f'  "{c}",' for c in classes]
        lines += ["];", ""]
        cms.write_text("\n".join(lines), encoding="utf-8")
        print(f"cms: {len(classes)} classes -> {cms}")
    # 所有选中字形的 codepoints
    codes = css_icon_codepoints(css, base_names)
    print(f"codepoints: {len(codes)}")
    (FA / "webfonts").mkdir(parents=True, exist_ok=True)
    subsetted = []
    for filename, flavor in [("fa-solid-900.woff2","woff2"),("fa-regular-400.woff2","woff2"),("fa-brands-400.woff2","woff2")]:
        src = FA / "webfonts" / filename
        if not src.exists(): continue
        out = FA / "webfonts" / filename.replace(".woff2", "-subset.woff2")
        try:
            font = subset.load_font(str(src), subset.Options())
            opts = subset.Options(); opts.flavor = flavor; opts.desubroutinize = True
            ss = subset.Subsetter(options=opts)
            ss.populate(unicodes=codes)
            ss.subset(font)
            font.save(str(out))
            font.close()
            subsetted.append(filename.replace(".woff2", ""))
            print(f"font: {out.name} {out.stat().st_size} bytes")
        except Exception as e:
            # FontTools 对个别 FA woff2 的 glyf 变换会报错；这个字重退回完整字体，
            # 图标仍然可用，只是这部分体积不省。不要为了省 20KB 把整包发布卡死。
            print(f"font: {filename} subset skipped: {e}")
    scss = css
    for family in subsetted:
        scss = scss.replace(f"../webfonts/{family}.woff2", f"../webfonts/{family}-subset.woff2")
        scss = scss.replace(f"../webfonts/{family}.ttf", f"../webfonts/{family}-subset.woff2")
        scss = re.sub(r'url\([^)]*' + re.escape(family) + r'\.ttf\) format\("truetype"\)', '', scss)
    scss = trim_icon_rules(scss, set(base_names))
    out_css = FA / "css" / "fa-subset.css"
    out_css.write_text(scss, encoding="utf-8")
    print(f"css: {out_css} {out_css.stat().st_size} bytes")

if __name__ == "__main__": main()
