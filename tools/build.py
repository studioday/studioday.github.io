#!/usr/bin/env python3
"""Build the static site from src/ into site/.

    python3 tools/build.py

Templates use three tags:
  {{name}}          value from the page context
  {{> partial}}     contents of src/templates/partials/partial.html
  {{roll:text}}     text-roll markup (two stacked copies, used for hover)

Content lives in src/content/*.json and src/content/papers/*.html.
Creative galleries: drop images into src/assets/img/work/<slug>/ as 01.avif + 01.jpg, 02...
(and an optional src/assets/video/<slug>.mp4); they show up on the console in that order.
Tech projects: src/content/tech.json. Set "repo": "owner/name" to pull the live GitHub panel.
Values in [brackets] are placeholders and are styled as such on the page.
"""
import base64
import hashlib
import html
import json
import math
import os
import random
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
OUT = ROOT / "site"
TPL = SRC / "templates"

site = json.loads((SRC / "content/site.json").read_text())
papers = json.loads((SRC / "content/papers.json").read_text())
creative = json.loads((SRC / "content/creative.json").read_text())
tech = json.loads((SRC / "content/tech.json").read_text())
cv = json.loads((SRC / "content/cv.json").read_text())
intro_frames = json.loads((SRC / "content/intro.json").read_text()) if (SRC / "content/intro.json").exists() else []
# the live address can come from the host's build settings (SITE_URL) instead of site.json
site["url"] = os.environ.get("SITE_URL", "").strip() or site.get("url", "")

esc = html.escape
SR_ONLY = ' class="sr-only"'


def asset_hash(folder):
    h = hashlib.sha1()
    for f in sorted(folder.rglob("*")):
        if f.is_file():
            h.update(f.name.encode()); h.update(f.read_bytes())
    return h.hexdigest()[:8]


# Scripts live in a content-hashed folder and the stylesheet carries a version query, so every
# change gets new URLs (relative module imports drop query strings, hence the folder).
JS_DIR = f"js-{asset_hash(SRC / 'assets/js')}"
CSS_VER = asset_hash(SRC / "assets/css")


# ---------------------------------------------------------------- helpers
def roll(text):
    t = esc(text)
    return f'<span class="roll"><span>{t}</span><span aria-hidden="true">{t}</span></span>'


def ph(text):
    """Escape text; bracketed placeholders get a visible placeholder style."""
    t = esc(text)
    return f'<span class="ph">{t}</span>' if text.strip().startswith("[") else t


def icon(name, cls="icon"):
    svg = (SRC / "assets/icons" / f"{name}.svg").read_text().strip()
    return svg.replace("<svg ", f'<svg class="{cls}" aria-hidden="true" focusable="false" ', 1)


def picture(name, alt="", width=None, height=None, position=None, eager=False, fallback="jpg"):
    style = f' style="object-position:{position}"' if position else ""
    size = f' width="{width}" height="{height}"' if width and height else ""
    loading = 'fetchpriority="high"' if eager else 'loading="lazy"'
    return (
        f'<picture><source srcset="/assets/img/{name}.avif" type="image/avif">'
        f'<img src="/assets/img/{name}.{fallback}" alt="{esc(alt)}"{size}{style} {loading} decoding="async"></picture>'
    )


def render(template, ctx):
    text = (TPL / template).read_text()
    # {{include:key}} renders the partial named by ctx[key]
    text = re.sub(r"\{\{include:(\w+)\}\}", lambda m: render(ctx[m.group(1)], ctx), text)
    text = re.sub(r"\{\{>\s*(\w+)\s*\}\}", lambda m: (TPL / "partials" / f"{m.group(1)}.html").read_text(), text)
    text = re.sub(r"\{\{(\w+)\}\}", lambda m: str(ctx.get(m.group(1), "")), text)
    text = re.sub(r"\{\{roll:([^}]+)\}\}", lambda m: roll(m.group(1)), text)
    leftover = re.findall(r"\{\{[^}]*\}\}", text)
    if leftover:
        raise SystemExit(f"{template}: unresolved tags {leftover}")
    return text


def footer(scene=False):
    cls = "site-footer site-footer--scene" if scene else "site-footer"
    e = site["email"]
    return f"""<footer class="{cls}">
    <span>built for kaper</span>
    <a href="mailto:{e}">{roll("reach out")}</a>
    <a href="mailto:{e}">{roll(e)}</a>
    <span class="site-footer__social">
      <a href="{site["instagram"]}" aria-label="Instagram" target="_blank" rel="noopener">{roll("IN")}</a><span class="site-footer__sep" aria-hidden="true">,</span><a href="{site["linkedin"]}" aria-label="LinkedIn" target="_blank" rel="noopener">{roll("LK")}</a><span class="site-footer__sep" aria-hidden="true">,</span><a href="{site["github"]}" aria-label="GitHub" target="_blank" rel="noopener">{roll("GH")}</a>
    </span>
    <span class="site-footer__place">bom, india</span>
  </footer>"""


def back_button(parent):
    if not parent:
        return ""
    # the ring round the arrow fills as you read (paper pages)
    return (f'<a class="back-button" href="{parent}" data-back data-magnetic aria-label="Back">'
            f'<span class="back-button__icon">{icon("arrow-left")}<svg class="back-button__ring" viewBox="0 0 36 36" aria-hidden="true">'
            f'<circle cx="18" cy="18" r="16" pathLength="1"/></svg></span><span class="label">{roll("Back")}</span></a>')


def sky(seed, count, variant="day", start=0.0, hero=True):
    """Shared sky backdrop: fixed gradient that moves as you scroll, plus seeded clouds at depth.
    start: share of the page height before the first drifting cloud; hero=False drops the two hero clouds."""
    rnd = random.Random(seed)
    clouds = [] if not hero else [
        f'<span class="sky-cloud cloud-img-{1 + seed % 3}" style="top:14vh;left:-12%;width:42vw;opacity:0.95;--bob:20s" '
        f'data-parallax="0.32" data-parallax-origin="center" data-sway="10"><i></i></span>',
        f'<span class="sky-cloud cloud-img-{1 + (seed + 1) % 3}" style="top:62vh;left:70%;width:36vw;opacity:0.9;--bob:24s" '
        f'data-parallax="0.18" data-parallax-origin="center" data-sway="16"><i></i></span>',
    ]
    for i in range(count):
        top = (start + (i + 0.15 + rnd.random() * 0.6) / count * (1 - start)) * 100
        left = rnd.uniform(-28, 8) if i % 2 == 0 else rnd.uniform(52, 88)
        width = rnd.uniform(34, 62)
        depth = rnd.uniform(0.08, 0.42)
        sway = round(6 + (0.45 - depth) * 40)
        clouds.append(
            f'<span class="sky-cloud cloud-img-{rnd.randint(1, 3)}" style="top:{top:.1f}%;left:{left:.1f}%;width:{width:.1f}vw;'
            f'opacity:{rnd.uniform(0.75, 1):.2f};--bob:{rnd.uniform(14, 26):.0f}s" '
            f'data-parallax="{depth:.2f}" data-parallax-origin="center" data-sway="{sway}"><i></i></span>'
        )
    return (
        # the fixed frame holds a tall picture of the sky that parallax.js slides with a transform
        f'<div class="sky-world sky-world--{variant}" aria-hidden="true"><div class="sky-world__sky" data-sky><i></i></div>'
        + "".join(clouds) + "</div>"
    )


PAGES = []  # every public path, for the sitemap


def absolute(path):
    """Absolute URL once site.json has a "url"; until then a root-relative one."""
    return f'{site["url"].rstrip("/")}{path}'


def ld(*things):
    """JSON-LD blocks for the head ("</" escaped so a value can never close the script)."""
    blocks = []
    for t in things:
        data = json.dumps({"@context": "https://schema.org", **t}, ensure_ascii=False).replace("</", "<\\/")
        blocks.append(f'<script type="application/ld+json">{data}</script>\n')
    return "".join(blocks)


def person():
    return {
        "@type": "Person", "@id": absolute("/#tanmay"), "name": site["name"], "url": absolute("/"),
        "email": f'mailto:{site["email"]}', "image": absolute("/assets/img/portrait.jpg"),
        "sameAs": [site["instagram"], site["linkedin"], site["github"]],
        "address": {"@type": "PostalAddress", "addressLocality": "Bombay", "addressCountry": "IN"},
        "homeLocation": {"@type": "Place", "name": site["about"]["hometown"]},
        "alumniOf": [{"@type": "CollegeOrUniversity", "name": "SVKM's NMIMS, Sarla Anil Modi School of Economics"},
                     {"@type": "School", "name": "Edubridge International School"}],
        "knowsLanguage": ["English", "Hindi", "Japanese"],
        "award": [f'{a["event"]}: {a["what"]}' for a in cv["awards"]],
        "knowsAbout": ["Economics", "Econometrics", "Cost-benefit analysis", "Media economics", "Philosophy", "Business",
                       "Web design", "Apparel design", "Video editing", "Software development"],
        "description": site["description"],
    }


def breadcrumbs(*trail):
    items = [("Home", "/"), *trail]
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": name, "item": absolute(path)} for i, (name, path) in enumerate(items)
    ]}


INLINE_SCRIPTS = set()  # every inline script's text, hashed into the Content-Security-Policy


def page(path, template, title, body_class, ctx, theme="#5793c7", description=None, back=None, data=(), og_type="website", head="", phase="day"):
    if path != "/404.html":
        PAGES.append(path)
    canonical = ""
    origin = site["url"].rstrip("/")
    if origin:
        canonical = f'<link rel="canonical" href="{origin}{path}">\n<meta property="og:url" content="{origin}{path}">'
    content = render(template, {"footer": footer(), **ctx})
    full = render(
        "base.html",
        {
            "title": esc(title),
            "description": esc(description or site["description"]),
            "theme_color": theme,
            "canonical": canonical,
            # crawlers need an absolute image URL: it becomes one once "url" is set in site.json
            "og_image": f"{origin}/assets/og.jpg",
            "head_extra": head + ld(*data) + ('<meta name="robots" content="noindex">\n' if path == "/404.html" else ""),
            "og_type": og_type,
            "body_class": body_class, "phase": phase,
            "content": content,
            "back": back_button(back),
            "js_dir": JS_DIR, "css_ver": CSS_VER,
        },
    )
    for m in re.finditer(r"<script>(.*?)</script>", full, re.S):
        INLINE_SCRIPTS.add(m.group(1))
    out = OUT / path.lstrip("/") / "index.html" if path.endswith("/") else OUT / path.lstrip("/")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(full)
    print("wrote", out.relative_to(ROOT))


def catmull_rom(points):
    """Smooth SVG path through points (Catmull-Rom converted to cubic Bezier)."""
    d = f"M{points[0][0]:.1f} {points[0][1]:.1f}"
    for i in range(len(points) - 1):
        p0 = points[max(0, i - 1)]
        p1, p2 = points[i], points[i + 1]
        p3 = points[min(len(points) - 1, i + 2)]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}"
    return d


def gallery(slug):
    items = []
    folder = SRC / "assets/img/work" / slug
    item = next((c for c in creative if c["slug"] == slug), None)
    if item and item.get("image"):
        name = item["image"]["src"]
        items.append({"type": "image", "avif": f"/assets/img/{name}.avif", "jpg": f"/assets/img/{name}.jpg",
                      "fit": "contain" if "logo" in name else "cover", "alt": item["image"].get("alt", "")})
    if folder.exists():
        alts = (item or {}).get("galleryAlts", [])
        for k, f in enumerate(sorted(folder.glob("*.jpg"))):
            alt = alts[k] if k < len(alts) else f'{item["title"] if item else slug}, gallery image {k + 1}'
            items.append({"type": "image", "avif": f"/assets/img/work/{slug}/{f.stem}.avif",
                          "jpg": f"/assets/img/work/{slug}/{f.name}", "fit": "cover", "alt": alt})
    # long-form YouTube edits: thumbnails come from YouTube itself, Play opens the video
    for v in (item or {}).get("youtube", []):
        items.append({"type": "youtube", "id": v["id"], "title": v["title"]})
    video = SRC / "assets/video" / f"{slug}.mp4"
    if video.exists():
        items.append({"type": "video", "src": f"/assets/video/{slug}.mp4",
                      "label": (item or {}).get("videoLabel", f"{slug} video")})
    return items


def tags_line(names):
    return " / ".join(esc(n) for n in names)


def excerpt(text, limit=210):
    text = text.strip()
    return text if len(text) <= limit else text[: text.rfind(" ", 0, limit)] + "..."


# Creatives loader (after pamidordesign.co). It plays once per browser session: the head script sets
# html[data-intro] before the first paint, so the screen is up from the first frame and the queen card
# does not fly in underneath it. The timeout is a failsafe in case the script never loads.
INTRO_HEAD = """<script>
try {
  if (!sessionStorage.getItem("sd-intro") && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.setAttribute("data-intro", "");
    setTimeout(function () {
      if (!document.documentElement.hasAttribute("data-intro")) return;
      document.documentElement.removeAttribute("data-intro");
      document.dispatchEvent(new Event("intro:done"));
    }, 9000);
  }
} catch (e) {}
</script>
"""


def intro_screen():
    """STUDIO [photo window] day: letters rise, the window opens and flicks through every project."""
    if not intro_frames:
        return ""

    def letters(text, start, cls=""):
        return "".join(f'<span class="intro__l{cls}"><span style="--i:{start + k}">{esc(ch)}</span></span>' for k, ch in enumerate(text))

    pics = []
    for f in intro_frames:
        contain = " intro__img--contain" if f["fit"] == "contain" else ""
        pics.append(
            f'<picture class="intro__img{contain}" data-intro-img data-w="{f["w"]}" data-h="{f["h"]}">'
            f'<source srcset="{f["src"]}.avif" type="image/avif">'
            f'<img src="{f["src"]}.jpg" alt="{esc(f["alt"])}" width="{f["w"]}" height="{f["h"]}" decoding="async"></picture>'
        )
    return (
        '<div class="intro" data-intro-screen aria-hidden="true"><p class="intro__word">'
        + letters("Studio", 0)
        + '<span class="intro__chip" data-intro-chip><span class="intro__frame" data-intro-frame>' + "".join(pics) + "</span></span>"
        + letters("day", 6, " intro__l--day") + "</p></div>"
    )


FEATHER = (
    '<svg viewBox="0 0 40 130" class="feather feather--{tone}"><path d="M20 126 C 20 96, 22 52, 19 6"/>'
    '<path d="M19 10 C 3 32, 4 76, 20 104"/><path d="M19 10 C 35 30, 35 74, 20 104"/>'
    '<path d="M19 30 l-10 9 M19 44 l-12 10 M19 58 l-12 10 M19 72 l-10 9 M20 30 l10 8 M20 44 l12 10 M20 58 l12 9 M20 72 l10 8"/></svg>'
)


# ---------------------------------------------------------------- pages
def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SRC / "assets", OUT / "assets")
    (OUT / "assets/js").rename(OUT / "assets" / JS_DIR)

    # Home (with About merged in) ------------------------------------
    # the page itself is written at the end, once the papers, creative work and tech are known
    bank_pass = "".join(
        f'<span class="sky-cloud cloud-img-{img}" style="left:{left}%;top:{top}px;width:{w}vw"><i style="animation-delay:-{d}s"></i></span>'
        for img, left, top, w, d in ((2, -22, 40, 74, 3), (1, 34, 0, 80, 9), (3, 70, 120, 62, 5))
    )
    # evening mist in front of the name at the bottom of the page, dimmed to dusk
    finale_mist = "".join(
        f'<span class="sky-cloud cloud-img-{img}" style="left:{left}%;bottom:{bottom}%;width:{w}vw;opacity:{o}"><i style="animation-delay:-{d}s"></i></span>'
        for img, left, bottom, w, o, d in ((3, -6, -40, 34, 0.62, 2), (2, 26, -70, 36, 0.5, 7), (1, 58, -44, 34, 0.62, 11), (1, 6, -120, 44, 0.9, 5), (3, 50, -118, 46, 0.9, 9))
    )
    c = site.get("cat") or {}
    cat = ""
    if c.get("standing") and c.get("run1") and c.get("run2"):
        cat = (
            f'<div class="cat-zone" aria-hidden="true" data-cat data-standing="{c["standing"]}" '
            f'data-run1="{c["run1"]}" data-run2="{c["run2"]}"><div class="cat"><img alt="Doodle of a white cat sitting on the clouds; it runs from the cursor" width="120" height="96"></div></div>'
        )

    # Academics ----------------------------------------------------
    ordered = sorted(papers, key=lambda p: (p.get("order", 0)))
    short = lambda p: p.get("shortTitle") or p["title"]  # labels and tiles; the paper page keeps the full title
    n = len(ordered)
    H = 700 + (n - 1) * 1000 + 460  # last node at 700 + (n-1)*1000, then a short tail
    pts = [(500, 60)]
    nodes = []
    for i, p in enumerate(ordered):
        x = 330 if i % 2 == 0 else 670
        y = 700 + i * 1000
        pts.append(((pts[-1][0] + x) / 2 + (60 if i % 2 == 0 else -60), y - 380))
        pts.append((x, y))
        nodes.append((x, y, p))
    pts.append((500, H - 200))
    pts.append((510, H - 30))
    path_d = catmull_rom(pts)
    rnd = random.Random(7)
    fp_clouds = []
    for k in range(12):
        y = (k + 0.5) * H / 12 + rnd.uniform(-90, 90)
        width = rnd.uniform(680, 980)
        left = rnd.uniform(-1300, -640) if k % 2 == 0 else rnd.uniform(860, 1350)
        fp_clouds.append(
            f'<span class="fp-cloud cloud-img-{rnd.randint(1, 3)}" style="left:{left:.0f}px;top:{y:.0f}px;'
            f'width:{width:.0f}px;transform:rotateX(-62deg) translateZ({rnd.uniform(-220, -40):.0f}px);'
            f'transform-origin:50% 100%;opacity:{rnd.uniform(0.75, 0.95):.2f}"></span>'
        )
    fp_nodes = "".join(
        f'<div class="fp-node {"fp-node--right" if x < 500 else "fp-node--left"}{" fp-node--long" if len(short(p)) > 30 else ""}" style="left:{x}px;top:{y}px" data-fp-node="{i}">'
        f'<span class="fp-cube"></span><div class="fp-label"><p class="fp-label__year">{esc(p["year"])}</p>'
        f'<p class="fp-label__title">{esc(short(p))}</p><p class="fp-label__subject">{tags_line(p["subjects"])}</p></div></div>'
        for i, (x, y, p) in enumerate(nodes)
    )
    # the flight-path card shows the whole research question; long ones step the type down instead
    fp_tiles = "".join(
        f'<a class="tile{" tile--long" if len(p["abstract"]) > 260 else ""}{" tile--long-title" if len(short(p)) > 30 else ""}" '
        f'href="/academic/{p["slug"]}/" data-fp-tile="{i}">'
        f'<span class="tile__tag">{esc(p["year"])}</span><span class="tile__title">{esc(short(p))}</span>'
        f'<span class="tile__text">{esc(p["abstract"].strip())}</span><span class="tile__subjects">{tags_line(p["subjects"])}</span>'
        f'<span class="tile__cta">Read paper <span aria-hidden="true">&#8599;</span></span></a>'
        for i, (_, _, p) in enumerate(nodes)
    )
    index_tiles = "".join(
        f'<a class="tile" href="/academic/{p["slug"]}/" data-reveal style="--delay:{i * 0.1:.1f}s">'
        f'<span class="tile__tag">{esc(p["year"])}</span><span class="tile__title">{esc(short(p))}</span>'
        f'<span class="tile__text">{esc(excerpt(p["abstract"], 260))}</span><span class="tile__subjects">{tags_line(p["subjects"])}</span>'
        f'<span class="tile__cta">Read <span aria-hidden="true">&#8599;</span></span></a>'
        for i, p in enumerate(ordered)
    )
    page(
        "/academic/", "academic.html", "Academic Papers | Tanmay Kaper", "page-academic",
        {
            "sky": sky(11, 7), "card": picture("card-king", "King of clubs playing card", 320, 480, eager=True),
            "fp_height": f"{(n + 2) * 100}vh", "fp_plane_h": H, "fp_path": path_d, "fp_clouds": "".join(fp_clouds),
            "fp_nodes": fp_nodes, "fp_tiles": fp_tiles, "index_tiles": index_tiles,
        },
        description="Research by Tanmay Kaper in economics, philosophy and business: drone delivery of vaccines, India's media economy and electric vehicle policy.",
        back="/#deck", data=(
            {"@type": "CollectionPage", "name": "Academic papers", "url": absolute("/academic/"), "author": {"@id": absolute("/#tanmay")},
             "mainEntity": {"@type": "ItemList", "itemListElement": [
                 {"@type": "ListItem", "position": i + 1, "url": absolute(f'/academic/{p["slug"]}/'), "name": p["title"]} for i, p in enumerate(ordered)]}},
            breadcrumbs(("Academics", "/academic/")),
        ),
    )
    by_slug = {p["slug"]: p for p in papers}
    for p in papers:
        nxt = by_slug[p["next"]]
        content = (SRC / "content/papers" / f'{p["slug"]}.html').read_text()
        # charts whose Word file carried no description get theirs from papers.json ("figureAlts")
        for k, alt in enumerate(p.get("figureAlts", []), 1):
            content = re.sub(rf'(src="/assets/img/papers/{p["slug"]}/fig-{k}\.png" alt=")[^"]*"', lambda m: m.group(1) + esc(alt) + '"', content)
        # every section heading gets an id, and the sections become the paper's contents list
        toc, used = [], set()
        def anchor(m):
            text = re.sub(r"<[^>]+>", "", m.group(2)).strip()
            slug = re.sub(r"[^a-z0-9]+", "-", html.unescape(text).lower()).strip("-")[:48] or "section"
            while slug in used:
                slug += "-2"
            used.add(slug)
            toc.append((slug, text))
            return f'<h2{m.group(1)} id="{slug}">{m.group(2)}</h2>'
        content = re.sub(r"<h2([^>]*)>(.*?)</h2>", anchor, content, flags=re.S)
        words = len(re.sub(r"<[^>]+>", " ", content).split())
        minutes = max(1, round(words / 230))
        contents = ""
        if len(toc) >= 3:
            items = "".join(f'<li><a href="#{a}">{t}</a></li>' for a, t in toc)
            contents = f'<nav class="toc" aria-label="Contents" data-toc><p class="toc__title">Contents</p><ol>{items}</ol></nav>'
        download = ""
        if p.get("pdf"):
            download = f'<a class="paper-button" href="{esc(p["pdf"])}" download>{roll("Download paper")}</a>'
        page(
            # long paper titles drop the name suffix so search results show the title whole
            f'/academic/{p["slug"]}/', "paper.html",
            f'{p["title"]} | Tanmay Kaper' if len(p["title"]) <= 44 else p.get("seoTitle", p["title"]), "page-paper",
            {
                "sky": sky(len(p["slug"]), 18), "toc": contents, "minutes": minutes,
                "title_class": " page-title--long" if len(p["title"]) > 44 else "",
                "title": esc(p["title"]), "year": esc(p["year"]), "abstract": esc(p["abstract"].strip()),
                "subjects": tags_line(p["subjects"]), "content": content, "download": download,
                "next_slug": nxt["slug"], "next_title": esc(short(nxt)), "next_year": esc(nxt["year"]),
            },
            description=excerpt(p.get("summary") or f'Paper by Tanmay Kaper. {p["abstract"].strip()}', 155), back="/academic/", og_type="article", data=(
                {"@type": "ScholarlyArticle", "headline": p["title"], "abstract": p["abstract"].strip(),
                 "author": person(), "datePublished": str(p["year"]).split()[-1], "inLanguage": "en",
                 "about": p["subjects"], "url": absolute(f'/academic/{p["slug"]}/'),
                 "isPartOf": {"@type": "CollectionPage", "name": "Academic papers", "url": absolute("/academic/")}},
                breadcrumbs(("Academics", "/academic/"), (p["title"], f'/academic/{p["slug"]}/')),
            ),
        )

    # Creatives ----------------------------------------------------
    arcade, sr = [], []
    flow = {"intro": {"title": "Now playing", "text": "Web design, apparel, video and one cartridge still compiling."}}
    for i, c in enumerate(creative):
        link = (c.get("link") or {})
        arcade.append({
            "title": c["title"], "subtitle": c["cartridge"], "year": c["year"],
            "subjects": c["subjects"], "link": link.get("url"), "linkLabel": link.get("label"),
            "gallery": gallery(c["slug"]), "dev": bool(c.get("dev")), "slug": c["slug"],
        })
        flow[str(i)] = {"title": c["title"], "text": c["description"]}
        a = f' <a href="{esc(link["url"])}">{esc(link["label"])}</a>' if link.get("url") else ""
        sr.append(f'<li>{esc(c["title"])} ({esc(c["year"])}): {esc(c["description"])}{a}</li>')
    page(
        "/creative/", "creative.html", "Creative Work: Web, Apparel & Video | Tanmay Kaper", "page-creative",
        {
            "sky": sky(23, 8, "dusk"), "card": picture("card-queen", "Queen of clubs playing card", 320, 480, eager=True),
            "intro": intro_screen(),
            "sr_projects": "\n    ".join(sr),
            "arcade_json": json.dumps(arcade).replace("</", "<\\/"),
            "flow_json": json.dumps(flow).replace("</", "<\\/"),
        },
        theme="#14213b", back="/#deck", head=INTRO_HEAD if intro_frames else "", phase="dusk",
        description="Creative work by Tanmay Kaper: web design for Morf Media, the Nightwalk Fashion apparel label, video for Arnifi and Kinda Jeety, and an auto-editing model.",
        data=(
            {"@type": "CollectionPage", "name": "Creative work", "url": absolute("/creative/"), "author": {"@id": absolute("/#tanmay")},
             "mainEntity": {"@type": "ItemList", "itemListElement": [
                 {"@type": "ListItem", "position": i + 1, "item": {
                     "@type": "CreativeWork", "name": c["title"], "description": c["description"], "dateCreated": str(c["year"]),
                     "genre": c["subjects"], "creator": {"@id": absolute("/#tanmay")},
                     **({"url": absolute(c["link"]["url"]) if c["link"]["url"].startswith("/") else c["link"]["url"]} if (c.get("link") or {}).get("url") else {})}}
                 for i, c in enumerate(creative)]}},
            breadcrumbs(("Creative work", "/creative/")),
        ),
    )

    # Tech ---------------------------------------------------------
    # the dial carries every project plus one last stop: the whole GitHub profile. Each stop has its own
    # identity: a typeface for its name ("face") and a glow that blooms behind the dial when it is picked.
    dial = tech + [{
        "slug": None, "title": "All repos", "href": site["github"], "icon": "github-logo",
        "tagline": "Everything else on GitHub, including research forks and work in progress.",
        "overview": "Everything else lives on GitHub: research forks of curated quant lists, experiments and work in progress.",
        "stack": [site["github"].split("://")[1]], "face": "display", "glow": {"color": "#c8b6ff", "shape": "wide"},
    }]
    for t in dial:
        t["url"] = t.get("href") or f'/tech/{t["slug"]}/'
        t["out"] = ' data-external target="_blank" rel="noopener"' if t.get("href") else ""  # leaves the site
        t["cta"] = "View on GitHub" if t.get("href") else "Open"
    N = len(dial)
    # with few stops the neighbours would sit below the fold: repeat the cycle round the wheel like a
    # slot reel until there are at least five positions (repeats are hidden from assistive tech)
    M = N * math.ceil(5 / N)
    step = 360 / M
    repeat = ' aria-hidden="true" tabindex="-1"'
    ridges = "".join(
        f'<line x1="{440 * math.sin(math.radians(a)):.1f}" y1="{-440 * math.cos(math.radians(a)):.1f}" '
        f'x2="{490 * math.sin(math.radians(a)):.1f}" y2="{-490 * math.cos(math.radians(a)):.1f}"/>'
        for a in range(0, 360, 3)
    )
    dividers = "".join(
        f'<line x1="{196 * math.sin(math.radians(a)):.1f}" y1="{-196 * math.cos(math.radians(a)):.1f}" '
        f'x2="{430 * math.sin(math.radians(a)):.1f}" y2="{-430 * math.cos(math.radians(a)):.1f}"/>'
        for a in [(i + 0.5) * step for i in range(M)]
    )
    segments = "".join(
        f'<a class="dial__seg" id="dial-seg-{i}" data-index="{i % N}" role="option" aria-selected="{"true" if i == 0 else "false"}"'
        f'{repeat if i >= N else ""} '
        f'href="{t["url"]}" style="--a:{i * step:.2f}deg"{t["out"]} '
        f"data-dial-seg='{esc(json.dumps({'title': t['title'], 'tagline': t['tagline'], 'stack': t['stack'], 'face': t['face']}), quote=True)}'>"
        f'<span class="dial__seg-inner">{icon(t["icon"], "dial__seg-icon")}<span class="dial__seg-label" data-face="{t["face"]}">{esc(t["title"])}</span>'
        + (f'<span class="dial__seg-status">{esc(t["status"])}</span>' if t.get("status") else "") + '</span></a>'
        for i, t in ((k, dial[k % N]) for k in range(M))
    )
    glows = "".join(
        f'<span class="tech-glow__orb tech-glow__orb--{t["glow"]["shape"]}{" is-on" if i == 0 else ""}" data-glow="{i}" '
        f'style="--glow:{t["glow"]["color"]}"></span>'
        for i, t in enumerate(dial)
    )
    # The file folder: one sheet per stop, its tab staggered along the top edge. Tabs pop up out of the
    # folder as it scrolls in; pulling one lifts the sheet to show its description, then it opens.
    tab_w = 30 if N <= 3 else 72 / N
    sheets = []
    for i, t in enumerate(dial):
        fid = f'file-{t["slug"] or "github"}'
        meta = " / ".join(x for x in (t.get("year"), t.get("status") or t.get("role")) if x) or site["github"].split("://")[1]
        stack = "".join(f"<li>{esc(x)}</li>" for x in t["stack"])
        label = "Open on GitHub" if t.get("href") else "Open file"
        x = 2 + i * (96 - tab_w) / max(1, N - 1)
        sheets.append(
            f'<div class="folder__sheet" data-sheet="{i}" style="--i:{i};--tab-x:{x:.1f}%;--tab-w:{tab_w:.1f}%;--glow:{t["glow"]["color"]}">'
            f'<button class="folder__tab" type="button" aria-expanded="false" aria-controls="{fid}" data-folder-tab>'
            f'<span class="folder__tab-no">{i + 1:02d}</span><span class="folder__tab-label" data-face="{t["face"]}">{esc(t["title"])}</span></button>'
            f'<div class="folder__paper" id="{fid}" data-folder-paper>'
            f'<p class="folder__meta">File {i + 1:02d} / {esc(meta)}</p>'
            f'<h3 class="folder__title" data-face="{t["face"]}">{esc(t["title"])}</h3>'
            + (f'<span class="folder__wip" aria-label="Status: {esc(t["status"])}">{esc(t["status"])}</span>' if t.get("status") else "") +
            f'<span class="folder__mark" aria-hidden="true">{icon(t["icon"])}</span>'
            f'<p class="folder__text">{esc(excerpt(t.get("overview") or t["tagline"], 240))}</p>'
            f'<p class="folder__text folder__text--short">{esc(t["tagline"])}</p>'
            f'<ul class="folder__stack">{stack}</ul>'
            f'<a class="folder__open" href="{t["url"]}"{t["out"]} data-folder-open>{label} {icon("arrow-up-right")}</a>'
            f"</div></div>"
        )
    first = tech[0]
    page(
        "/tech/", "tech.html", "Tech Projects | Tanmay Kaper", "page-tech",
        {
            "sky": sky(31, 6), "count": f"{N:02d}", "step": f"{step:.3f}",
            "first_title": esc(first["title"]), "first_face": first["face"], "first_tagline": esc(first["tagline"]),
            "first_stack": "".join(f"<li>{esc(s)}</li>" for s in first["stack"]),
            "first_href": f'/tech/{first["slug"]}/', "dial_ridges": ridges, "dial_dividers": dividers,
            "dial_segments": segments, "glows": glows, "folder_sheets": "".join(sheets), "file_count": f"{N:02d}",
            "icon_prev": icon("caret-left"), "icon_next": icon("caret-right"),
            "card": picture("card-jack", "Jack of spades playing card", 320, 480, eager=True),
        },
        description=f'Tech projects by Tanmay Kaper: {" and ".join(t["title"] for t in tech)}, each shown with its live GitHub repository.',
        back="/#deck", data=(
            {"@type": "CollectionPage", "name": "Tech projects", "url": absolute("/tech/"), "author": {"@id": absolute("/#tanmay")},
             "mainEntity": {"@type": "ItemList", "itemListElement": [
                 {"@type": "ListItem", "position": i + 1, "url": absolute(f'/tech/{t["slug"]}/'), "name": t["title"]} for i, t in enumerate(tech)]}},
            breadcrumbs(("Tech", "/tech/")),
        ),
    )
    for i, t in enumerate(tech):
        nxt = tech[(i + 1) % len(tech)]
        links = []
        if t.get("repo"):
            links.append(f'<a class="tile__cta" href="https://github.com/{esc(t["repo"])}" target="_blank" rel="noopener">{icon("github-logo")} GitHub</a>')
        if t.get("live"):
            links.append(f'<a class="tile__cta" href="{esc(t["live"])}" target="_blank" rel="noopener">Live site <span aria-hidden="true">&#8599;</span></a>')
        if not links:
            links.append('<span class="ph">[Add "repo" and "live" links in src/content/tech.json]</span>')
        repo = t.get("repo", "")
        if not repo and t.get("status"):
            links = [f'<a class="tile__cta" href="/creative/">Also on the Creatives console <span aria-hidden="true">&#8599;</span></a>']
        page(
            f'/tech/{t["slug"]}/', "tech-project.html", f'{t["title"]} | Tech | Tanmay Kaper', "page-project",
            {
                "sky": sky(40 + i, 9),
                "title": esc(t["title"]), "tagline": ph(t["tagline"]), "year": ph(t["year"]), "role": ph(t["role"]),
                "face": t.get("face", "display"), "glow": t.get("glow", {}).get("color", "#d9e6ff"),
                "glow_shape": t.get("glow", {}).get("shape", "wide"),
                "stack": "".join(f'<li class="pill">{ph(s)}</li>' for s in t["stack"]),
                "links": " ".join(links), "overview": ph(t["overview"]),
                "highlights": "".join(f"<li>{ph(h)}</li>" for h in t["highlights"]),
                "repo": esc(repo), "repo_url": f"https://github.com/{esc(repo)}" if repo else "#",
                "repo_label": esc(repo) if repo else "[owner]/[repo]",
                "updated": "Updated [date]" if not repo else "Loading",
                "topics": "".join(f'<li class="repo__topic">{ph(s)}</li>' for s in t["stack"]),
                "readme_placeholder": (
                    '<h3><span class="ph">[Project title]</span></h3>'
                    '<p><span class="ph">[The README from GitHub renders here once "repo" is set in src/content/tech.json.]</span></p>'
                    '<pre><code>git clone https://github.com/[owner]/[repo]\nnpm install\nnpm run dev</code></pre>'
                ),
                "repo_status": "" if repo else "Placeholder: no GitHub repo linked yet.",
                "next_slug": nxt["slug"], "next_title": esc(nxt["title"]), "status": esc(t.get("status", "")),
                "repo_template": "partials/repo.html" if repo or not t.get("status") else "partials/status.html",
                "icon_github": icon("github-logo"), "icon_star": icon("star"), "icon_fork": icon("git-fork"),
                "icon_eye": icon("eye"), "icon_book": icon("book-open"),
            },
            # placeholders in brackets are never shipped as the meta description
            description=t["tagline"] if not t["tagline"].startswith("[") else f'{t["title"]}: a tech project by Tanmay Kaper, with its GitHub repository.',
            back="/tech/", data=(
                *(() if t.get("placeholder") else ({"@type": "SoftwareSourceCode", "name": t["title"], "description": t["tagline"],
                   "author": {"@id": absolute("/#tanmay")}, "programmingLanguage": t["stack"],
                   **({"codeRepository": f'https://github.com/{t["repo"]}'} if t.get("repo") else {})},)),
                breadcrumbs(("Tech", "/tech/"), (t["title"], f'/tech/{t["slug"]}/')),
            ),
        )

    # About --------------------------------------------------------
    ab = site["about"]
    analysis = "".join(
        f'<li><a href="/academic/{p["slug"]}/"><strong>{esc(p["title"])}</strong>'
        f'<span>{esc(p["year"])} / {tags_line(p["subjects"])}</span></a></li>' for p in ordered
    )
    expression = "".join(
        f'<li><div><strong>{esc(c["title"])}</strong><span>{esc(c["cartridge"])}, {esc(c["year"])}</span></div></li>'
        for c in creative
    )
    tech_items = "".join(
        f'<li><a href="/tech/{t["slug"]}/"><strong>{esc(t["title"])}</strong><span>{ph(t["tagline"])}</span></a></li>'
        for t in tech[:3]
    )
    toolkit = "".join(f'<li class="pill">{esc(x)}</li>' for x in site["toolkit"])
    # an interest shows its photo once there is one; until then a drawn card with its icon
    interests = "".join(
        f'<figure class="interest interest--{i + 1}" data-reveal style="--delay:{i * 0.07:.2f}s">'
        + (f'<img src="{esc(it["photo"])}" alt="{esc(it["label"])}" loading="lazy">' if it.get("photo")
           else f'<span class="interest__card">{icon(it["icon"], "interest__icon") if it.get("icon") else ""}'
                f'<span class="interest__name">{ph(it["label"])}</span>'
                + (f'<span class="interest__note">{esc(it["note"])}</span>' if it.get("note") else "") + "</span>")
        # the drawn card already shows the name, so its caption is for screen readers only
        + f'<figcaption{"" if it.get("photo") else SR_ONLY}>{ph(it["label"])}</figcaption></figure>'
        for i, it in enumerate(ab["interests"])
    )
    # the record: the CV as a page section (no date of birth, phone or address)
    def entries(items):
        out = []
        for e in items:
            when = f'<span class="record__when">{esc(e["when"])}</span>' if e.get("when") else ""
            detail = f'<span class="record__detail">{esc(e["detail"])}</span>' if e.get("detail") else ""
            points = "".join(f"<li>{esc(x)}</li>" for x in e["points"])
            out.append(f'<li class="record__item" data-reveal><div class="record__head"><h4>{esc(e["role"])}</h4>{when}</div>'
                       f'<p class="record__org">{esc(e["org"])}{detail}</p><ul class="record__points">{points}</ul></li>')
        return "".join(out)
    education = "".join(
        f'<li data-reveal style="--delay:{i * 0.06:.2f}s"><span class="record__when">{esc(e["when"])}</span><h4>{esc(e["what"])}</h4>'
        f'<p>{esc(e["where"])}</p><p class="record__note">{esc(e["note"])}</p></li>'
        for i, e in enumerate(cv["education"])
    )
    awards = "".join(
        f'<li data-reveal style="--delay:{i * 0.06:.2f}s"><span class="record__prize">{esc(a["what"])}</span><h4>{esc(a["event"])}</h4>'
        f'<p>{esc(a["note"])}</p></li>'
        for i, a in enumerate(cv["awards"])
    )
    languages = "".join(f'<li class="pill">{esc(x)}</li>' for x in cv["languages"])
    rnd = random.Random(19)
    feathers = "".join(
        f'<span class="icarus__feather" data-feather data-x="{rnd.uniform(0.18, 0.8):.3f}" data-start="{0.05 + k * 0.085:.3f}" '
        f'data-speed="{rnd.uniform(0.5, 1.1):.2f}" data-spin="{rnd.uniform(-0.6, 0.6):.2f}" data-size="{rnd.uniform(0.7, 1.3):.2f}">'
        + FEATHER.format(tone="ink" if k % 3 else "chalk") + "</span>"
        for k in range(10)
    )
    resume = ab.get("resume", "")
    if resume.startswith("#"):  # scrolls back up to the record on the same page
        resume = f'<a class="me-resume" href="{esc(resume)}">Resume {icon("arrow-up")}</a>'
    elif resume:
        resume = f'<a class="me-resume" href="{esc(resume)}" target="_blank" rel="noopener">Resume {icon("arrow-up-right")}</a>'
    else:
        resume = '<span class="me-resume is-placeholder" title="Add your resume link in src/content/site.json">Resume <span class="ph">[link]</span></span>'
    page(
        "/", "home.html", "Tanmay Kaper | Economics, Design & Code", "page-home",
        {
            "sky": sky(5, 10, start=0.46, hero=False),
            "card_king": picture("card-king", "King of clubs playing card, the way into Academics", 320, 480),
            "card_queen": picture("card-queen", "Queen of clubs playing card, the way into Creatives", 320, 480),
            "card_jack": picture("card-jack", "Jack of spades playing card, the way into Tech", 320, 480),
            "cloud_bank_pass": bank_pass, "finale_mist": finale_mist, "cat": cat,
            "analysis_items": analysis, "expression_items": expression, "tech_items": tech_items,
            "toolkit": toolkit, "interest_cards": interests, "feathers": feathers, "resume": resume,
            "open_class": " is-on" if ab.get("open") else "",
            "open_text": "Open for collaborations<br>and new work" if ab.get("open") else "Currently booked",
            "currently": ph(ab["currently"]), "based": esc(ab["based"]), "after_hours": ph(ab["afterHours"]),
            "hometown": ph(ab["hometown"]), "focus": esc(ab["focus"]),
            "email": site["email"], "instagram": site["instagram"], "linkedin": site["linkedin"], "github": site["github"],
            "icon_linkedin": icon("linkedin-logo"), "icon_instagram": icon("instagram-logo"), "icon_github": icon("github-logo"),
            "icon_email": icon("envelope-simple"),
            "record_experience": entries(cv["experience"]), "record_leadership": entries(cv["leadership"]),
            "record_education": education, "record_awards": awards, "record_languages": languages,
            "icon_briefcase": icon("briefcase"), "icon_cap": icon("graduation-cap"), "icon_trophy": icon("trophy"),
        },
        description="Tanmay Kaper, economics student at NMIMS Mumbai from Gurugram: research papers, web design, apparel, video and code, built in analysis and expression.",
        data=({"@type": "WebSite", "name": "Tanmay Kaper", "url": absolute("/"), "author": {"@id": absolute("/#tanmay")}},
              {"@type": "ProfilePage", "url": absolute("/"), "mainEntity": person()}),
    )
    # /about/ now lives on the home page: old links forward to it
    redirect = OUT / "about" / "index.html"
    redirect.parent.mkdir(parents=True, exist_ok=True)
    redirect.write_text(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>About Tanmay Kaper</title>'
        '<meta name="robots" content="noindex"><link rel="canonical" href="/">'
        '<meta http-equiv="refresh" content="0; url=/#about"><script>location.replace("/#about")</script></head>'
        '<body><a href="/#about">About Tanmay Kaper</a></body></html>\n'
    )
    print("wrote", redirect.relative_to(ROOT), "(forwards to /#about)")

    page("/404.html", "404.html", "Not found | Tanmay Kaper", "page-404", {"sky": sky(3, 5)}, back="/")

    # Crawling ------------------------------------------------------
    # a sitemap needs absolute URLs, so it is written once "url" is set in site.json
    origin = site["url"].rstrip("/")
    robots = "User-agent: *\nAllow: /\n"
    if origin:
        urls = "".join(f"  <url><loc>{origin}{p}</loc></url>\n" for p in PAGES)
        (OUT / "sitemap.xml").write_text(
            f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n')
        robots += f"\nSitemap: {origin}/sitemap.xml\n"
        print("wrote site/sitemap.xml")
    else:
        print("note: set \"url\" in src/content/site.json to write sitemap.xml and absolute share URLs")
    (OUT / "robots.txt").write_text(robots)

    # Hosting (Cloudflare reads these from the output folder) ---------------
    (OUT / "site.webmanifest").write_text(json.dumps({
        "name": "Tanmay Kaper", "short_name": "Tanmay", "start_url": "/", "display": "browser",
        "background_color": "#5793c7", "theme_color": "#5793c7",
        "icons": [{"src": "/assets/favicon.svg", "type": "image/svg+xml", "sizes": "any"},
                  {"src": "/assets/apple-touch-icon.png", "type": "image/png", "sizes": "180x180"}],
    }, indent=1) + "\n")
    (OUT / "_redirects").write_text("/about /#about 301\n/about/ /#about 301\n")
    hashes = " ".join(f"'sha256-{base64.b64encode(hashlib.sha256(x.encode()).digest()).decode()}'" for x in sorted(INLINE_SCRIPTS))
    csp = ("default-src 'self'; "
           f"script-src 'self' {hashes}; "
           "style-src 'self' 'unsafe-inline'; "
           "img-src 'self' data: https://i.ytimg.com https://*.githubusercontent.com https://github.com https://camo.githubusercontent.com https://img.shields.io; "
           "media-src 'self'; font-src 'self'; connect-src 'self' https://api.github.com; "
           "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests")
    (OUT / "_headers").write_text(f"""/*
  Content-Security-Policy: {csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin

/assets/{JS_DIR}/*
  Cache-Control: public, max-age=31536000, immutable
/assets/css/*
  Cache-Control: public, max-age=31536000, immutable
/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/assets/img/*
  Cache-Control: public, max-age=604800, stale-while-revalidate=86400
/assets/video/*
  Cache-Control: public, max-age=604800
/assets/icons/*
  Cache-Control: public, max-age=604800
""")
    print("wrote site/_headers, site/_redirects, site/site.webmanifest")


if __name__ == "__main__":
    build()
