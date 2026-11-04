# QA for the live page

Served from docs/ by docs/tools/page-qa.mjs, loaded in headless Chromium (software WebGL, so frame timing is not representative). Screenshots in both themes: the hero, the first two body scenes, the 375 px hero.

## index.html

Lighthouse (desktop preset): performance 98, accessibility 94, best practices 100, SEO 100

| Metric | Value |
|---|---|
| First Contentful Paint | 0.8 s |
| Largest Contentful Paint | 0.9 s |
| Speed Index | 1.2 s |
| Total Blocking Time | 0 ms |
| Cumulative Layout Shift | 0 |
| Total byte weight | Total size was 601 KiB |

| Theme | Console errors | Failed requests | Images loaded | Transfer (bytes) | Body scenes captured |
|---|---|---|---|---|---|
| dark | 0 | 0 | 0/0 | 796,496 | reactor, profiles |
| light | 0 | 0 | 0/0 | 790,256 | reactor, profiles |

Files: `light/` and `dark/` hold `<page>-hero.png`, `<page>-scene1-*.png`, `<page>-scene2-*.png` and `<page>-mobile-375-hero.png`; `lighthouse.report.html` and `.json` are the Lighthouse run; `qa.json` is the machine-readable summary.
