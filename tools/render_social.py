"""Render the share image (og.jpg, 1200x630) and the home-screen icon (apple-touch-icon.png, 180x180)
from the site's own assets, fonts and stylesheet, using headless Chrome.

Needs the built site served on port 4322 (python3 -m http.server 4322 from site/).
Usage: python3 tools/render_social.py
"""
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from cdp import Chrome  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "assets"
BASE = "http://localhost:4322"

# Composed in the page itself so fonts and images load same-origin from the running site.
OG = """
<style>
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
  body { position: relative; color: #fff; font-family: "Helvetica Neue", Helvetica, Inter, Arial, sans-serif;
    background: #5793c7 url(/assets/img/sky.jpg) center 30% / cover no-repeat; }
  .cloud { position: absolute; aspect-ratio: 16 / 9; background: center / contain no-repeat; }
  .c1 { left: -330px; bottom: -250px; width: 720px; background-image: url(/assets/img/cloud-1.png); }
  .c2 { right: -220px; top: -120px; width: 700px; background-image: url(/assets/img/cloud-3.png); opacity: 0.9; }
  .logo { position: absolute; left: 64px; top: 56px; display: flex; align-items: baseline; gap: 8px; }
  .logo b { font: 900 21px/1 Inter; text-transform: uppercase; letter-spacing: -0.03em; }
  .logo i { font: italic 400 30px/1 "Instrument Serif"; }
  h1 { position: absolute; left: 64px; top: 196px; margin: 0; font: 900 112px/0.86 Inter; letter-spacing: -0.045em; text-transform: uppercase;
    text-shadow: 0 6px 40px rgba(26, 58, 102, 0.3); }
  p { position: absolute; left: 68px; top: 430px; margin: 0; width: 540px; font: italic 400 38px/1.12 "Instrument Serif", serif;
    text-shadow: 0 2px 14px rgba(26, 58, 102, 0.3); }
  p em { color: #0f2152; text-shadow: none; }
  .deck { position: absolute; left: 748px; top: 178px; width: 350px; height: 300px; }
  .deck img { position: absolute; top: 0; width: 160px; height: 240px; border-radius: 9px; object-fit: cover;
    box-shadow: 0 22px 40px rgba(26, 58, 102, 0.38); transform-origin: 50% 120%; }
</style>
<div class="cloud c2"></div>
<div class="logo"><b>Studio</b><i>day</i></div>
<h1>Tanmay<br>Kaper</h1>
<p>Experiences built in <em>analysis</em> and <em>expression</em>.</p>
<div class="deck">
  <img src="/assets/img/card-king.jpg" style="left:0;rotate:-13deg">
  <img src="/assets/img/card-queen.jpg" style="left:95px;top:-6px;rotate:0deg">
  <img src="/assets/img/card-jack.jpg" style="left:190px;rotate:13deg">
</div>
<div class="cloud c1"></div>
"""

# the site's own @font-face rules, so the card is set in the same faces
FONTS = "<style>" + "\n".join(re.findall(r"@font-face \{.*?\}", (ROOT / "src/assets/css/site.css").read_text(), re.S)) + "</style>"

ICON = """
<style>
  html, body { margin: 0; width: 180px; height: 180px; overflow: hidden; }
  body { background: linear-gradient(#5793c7, #afc8dc); display: grid; place-items: center; }
  img { width: 74px; height: 111px; border-radius: 6px; rotate: -8deg; box-shadow: 0 10px 22px rgba(26, 58, 102, 0.35); }
</style>
<img src="/assets/img/card-jack.jpg">
"""


def render(c, html, width, height, path):
    c.call("Emulation.setDeviceMetricsOverride", {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": False}, session=True)
    c.goto(f"{BASE}/404.html", settle=0.5)
    c.js(f"document.open(); document.write({(FONTS + html)!r}); document.close(); 1")
    c.js("""Promise.all([document.fonts.load('900 112px Inter'), document.fonts.load('italic 400 38px "Instrument Serif"'),
                        ...[...document.images].map(i => i.decode().catch(() => {}))]).then(() => 1)""")
    c.js("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))).then(() => 1)")
    return c.shot(str(path))


def main():
    c = Chrome(1200, 630)
    try:
        png = render(c, OG, 1200, 630, OUT / "og.png")
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "82", png, "--out", str(OUT / "og.jpg")],
                       check=True, stdout=subprocess.DEVNULL)
        Path(png).unlink()
        render(c, ICON, 180, 180, OUT / "apple-touch-icon.png")
    finally:
        c.close()
    print("wrote src/assets/og.jpg and src/assets/apple-touch-icon.png")


if __name__ == "__main__":
    main()
