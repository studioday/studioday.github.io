"""Pick the photos that flash through the Creatives loader and make light thumbnails of them.

    python3 tools/intro_frames.py

Takes every project in src/content/creative.json in turn (its featured image, then every other
gallery image), so each project shows up early and the shapes keep changing. Writes 400px-tall
JPEG + AVIF thumbnails to src/assets/img/work/intro/ and their sizes to src/content/intro.json,
which the build reads. Rerun it after adding gallery images.
"""
import json
import re
import shutil
import subprocess
from itertools import zip_longest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "src/assets/img"
OUT = IMG / "work/intro"
MAX = 10
HEIGHT = 400


def size(path):
    out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)], capture_output=True, text=True).stdout
    w, h = re.findall(r"pixel\w+: (\d+)", out)
    return int(w), int(h)


def main():
    creative = json.loads((ROOT / "src/content/creative.json").read_text())
    queues = []
    for c in creative:
        frames = []
        if c.get("image"):
            frames.append((IMG / f'{c["image"]["src"]}.jpg', c["image"].get("alt", c["title"]), c["slug"]))
        alts = c.get("galleryAlts", [])
        gallery = sorted((IMG / "work" / c["slug"]).glob("*.jpg")) if (IMG / "work" / c["slug"]).exists() else []
        for k, f in list(enumerate(gallery))[::2]:
            frames.append((f, alts[k] if k < len(alts) else f'{c["title"]}, gallery image {k + 1}', c["slug"]))
        if frames:
            queues.append(frames)
    picked = [f for row in zip_longest(*queues) for f in row if f][:MAX]

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    manifest = []
    for i, (src, alt, slug) in enumerate(picked, 1):
        name = f"{i:02d}"
        subprocess.run(["sips", "--resampleHeight", str(HEIGHT), "-s", "format", "jpeg", "-s", "formatOptions", "78",
                        str(src), "--out", str(OUT / f"{name}.jpg")], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(["sips", "-s", "format", "avif", str(OUT / f"{name}.jpg"), "--out", str(OUT / f"{name}.avif")],
                       check=True, stdout=subprocess.DEVNULL)
        w, h = size(OUT / f"{name}.jpg")
        manifest.append({"src": f"/assets/img/work/intro/{name}", "w": w, "h": h, "alt": alt, "project": slug,
                         "fit": "contain" if "logo" in src.name else "cover"})
    (ROOT / "src/content/intro.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote {len(manifest)} frames to src/assets/img/work/intro/ and src/content/intro.json")


if __name__ == "__main__":
    main()
