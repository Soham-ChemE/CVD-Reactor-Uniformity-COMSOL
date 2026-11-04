"""Shared page tooling for the live page (imported by docs/build_assets.py):
static PNG fallbacks for every 3D body scene, both-theme screenshots, console check and Lighthouse, through docs/tools/page-qa.mjs.

  python docs/build_assets.py --snap        assets/viz_<scene>_<theme>.png for every [data-viz] scene, both themes, quantised
  python docs/build_assets.py --qa          screenshots (hero, two body scenes, 375 px hero) in both themes to qa/<theme>/, console check
  python docs/build_assets.py --lighthouse  desktop Lighthouse run, report to qa/lighthouse.report.{html,json}
  python docs/build_assets.py --hero-png    assets/hero.png, the static hero fallback, from the hero canvas

Needs a global playwright with Chromium (npm i -g playwright && npx playwright install chromium) and, for Lighthouse, npm i -g lighthouse."""
from __future__ import annotations
import json, subprocess
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent
PAGES = ["index.html"]
FLAGS = ("--snap", "--qa", "--lighthouse", "--hero-png")


def run(cmd, cwd=DOCS.parent):
    print("$", " ".join(cmd)); subprocess.run(cmd, cwd=cwd, check=True)


def quantise(paths, colors=256, max_w=1400):
    from PIL import Image
    for p in paths:
        im = Image.open(p).convert("RGBA")
        if im.width > max_w: im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
        q = im.convert("RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
        q.save(p, optimize=True); print("quantised", p.name, p.stat().st_size, "bytes")


def qa_readme(report):
    lines = ["# QA for the live page", "", "Served from docs/ by docs/tools/page-qa.mjs, loaded in headless Chromium (software WebGL, so frame timing is not representative). Screenshots in both themes: the hero, the first two body scenes, the 375 px hero.", ""]
    for page, pr in report.get("pages", {}).items():
        lines += [f"## {page}", ""]
        if "lighthouse" in pr:
            lh = pr["lighthouse"]; lines += [f"Lighthouse (desktop preset): performance {lh['performance']}, accessibility {lh['accessibility']}, best practices {lh['bestPractices']}, SEO {lh['seo']}", "", "| Metric | Value |", "|---|---|", f"| First Contentful Paint | {lh['fcp']} |", f"| Largest Contentful Paint | {lh['lcp']} |", f"| Speed Index | {lh['si']} |", f"| Total Blocking Time | {lh['tbt']} |", f"| Cumulative Layout Shift | {lh['cls']} |", f"| Total byte weight | {lh['bytes']} |", ""]
        lines += ["| Theme | Console errors | Failed requests | Images loaded | Transfer (bytes) | Body scenes captured |", "|---|---|---|---|---|---|"]
        for theme in ("dark", "light"):
            t = pr.get(theme)
            if t: lines.append(f"| {theme} | {len(t['errors']) + len(t.get('mobileErrors', []))} | {len(t['failed'])} | {t['imagesLoaded']} | {t['transferBytes']:,} | {', '.join(t['scenes'])} |")
        lines.append("")
    lines += ["Files: `light/` and `dark/` hold `<page>-hero.png`, `<page>-scene1-*.png`, `<page>-scene2-*.png` and `<page>-mobile-375-hero.png`; `lighthouse.report.html` and `.json` are the Lighthouse run; `qa.json` is the machine-readable summary."]
    (DOCS / "qa" / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def page_tasks(flags, pages=None):
    """Run the flagged page tasks (all of them when flags is empty)."""
    pages = pages or PAGES
    tool = ["node", str(DOCS / "tools" / "page-qa.mjs"), "--docs", str(DOCS), "--pages", ",".join(pages)]
    want = lambda f: not flags or f in flags
    if want("--hero-png"): run([*tool, "--hero-png"]); quantise([DOCS / "assets" / "hero.png"], max_w=1600)
    if want("--snap"): run([*tool, "--snap"]); quantise(sorted((DOCS / "assets").glob("viz_*_*.png")))
    qa = [f for f in ("--qa", "--lighthouse") if want(f)]
    if qa:
        run([*tool, *qa]); qa_readme(json.loads((DOCS / "qa" / "qa.json").read_text()))


def handle_flags(argv, pages=None):
    """If argv carries page flags, run only those and return True; otherwise return False so the caller builds its data."""
    flags = [a for a in argv if a in FLAGS]
    if not flags: return False
    page_tasks(flags, pages); return True
