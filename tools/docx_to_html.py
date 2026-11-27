"""Turn a Word paper (.docx) into the clean HTML the paper pages use (src/content/papers/<slug>.html).

    python3 tools/docx_to_html.py paper.docx <slug>

Keeps headings, paragraphs, bold/italic, lists, tables, figures and their captions. Front matter
(title block, table of contents) is dropped because the page hero already shows the title and year.
Figures are copied to src/assets/img/papers/<slug>/ as PNG (charts stay crisp).
Headings come from Word styles (Heading 1/2/3) or, in documents without styles, from numbering:
"1. INTRODUCTION" becomes an h2 and "1.1 Background" an h3.
"""
import html
import re
import subprocess
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}
W = "{%s}" % NS["w"]
SKIP_STYLES = {"Title", "Subtitle", "Author", "Date", "TOCHeading", "TOC1", "TOC2", "TOC3"}


KEEP_SET = {"OTT", "DTH", "DVR", "GDP", "INR", "TV", "IP", "UK", "US", "M&AMP;E", "FY23", "FY24", "FY25", "CBA", "IMI"}
KEEP = {"VS": "vs", "YOUTUBE": "YouTube", "INDIA'S": "India's"}
SMALL = {"a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "vs"}


def title_case(text):
    """'2. INDIA'S MEDIA ECONOMY: MACRO CONTEXT' -> '2. India's Media Economy: Macro Context'."""
    words = text.split(" ")
    out = []
    for i, w in enumerate(words):
        key = w.rstrip(":,").upper()
        tail = w[len(w.rstrip(":,")):]
        if key in KEEP:
            out.append(KEEP[key] + tail)
        elif key in KEEP_SET:
            out.append(key + tail)
        elif i > 1 and key.lower() in SMALL:
            out.append(key.lower() + tail)
        else:
            out.append(key.capitalize() + tail)
    return " ".join(out)


def looks_like_code(line):
    """An assignment, a call or a comment line rather than a sentence."""
    if re.match(r"(def|for|if|elif|else|return|import|from|while|print)\b", line):
        return True
    return bool(re.match(r"[\w\[\], .]+\s*[+\-*/]?=\s*\S", line) or re.search(r"\bnp\.|\w\(.*\)\s*(#.*)?$", line)) and not line.endswith(".")


def q(tag):
    p, t = tag.split(":")
    return "{%s}%s" % (NS[p], t)


def on(el, name):
    """A run property is on when present without w:val="0"/"false"."""
    x = el.find(f"w:rPr/w:{name}", NS) if el is not None else None
    return x is not None and x.get(W + "val", "1") not in ("0", "false")


class Paper:
    def __init__(self, path, slug):
        self.z = zipfile.ZipFile(path)
        self.slug = slug
        self.doc = ET.fromstring(self.z.read("word/document.xml"))
        rels = ET.fromstring(self.z.read("word/_rels/document.xml.rels"))
        self.rels = {r.get("Id"): r.get("Target") for r in rels.findall("rel:Relationship", NS)}
        self.bullets = self._numbering()
        self.figs = 0
        self.out = []
        self.list = None  # open list tag
        self.code = False  # inside a section whose heading mentions code

    def _numbering(self):
        """numId -> True when its first level is a bullet list."""
        try:
            n = ET.fromstring(self.z.read("word/numbering.xml"))
        except KeyError:
            return {}
        fmt = {}
        for a in n.findall("w:abstractNum", NS):
            lvl = a.find("w:lvl[@w:ilvl='0']/w:numFmt", NS)
            fmt[a.get(W + "abstractNumId")] = lvl is not None and lvl.get(W + "val") == "bullet"
        return {num.get(W + "numId"): fmt.get(num.find("w:abstractNumId", NS).get(W + "val"), True)
                for num in n.findall("w:num", NS)}

    # ---------------------------------------------------------- inline
    def runs(self, p):
        parts = []
        for el in p:
            if el.tag == q("w:r"):
                parts.append(self.run(el))
            elif el.tag == q("w:hyperlink"):
                inner = "".join(self.run(r) for r in el.findall("w:r", NS))
                target = self.rels.get(el.get(q("r:id")), "")
                parts.append(f'<a href="{html.escape(target)}">{inner}</a>' if target.startswith("http") else inner)
            elif el.tag in (q("w:ins"), q("w:smartTag"), q("w:sdt")):
                parts.append(self.runs(el.find("w:sdtContent", NS) if el.tag == q("w:sdt") else el))
        return "".join(parts)

    def run(self, r):
        text = ""
        for el in r:
            if el.tag == q("w:t"):
                text += html.escape(el.text or "", quote=False)
            elif el.tag == q("w:tab"):
                text += " "
            elif el.tag == q("w:br"):
                text += "<br>"
            elif el.tag == q("w:drawing"):
                self.pending_img += self.image(el)
        if not text.strip():
            return text
        if on(r, "b"):
            text = f"<strong>{text}</strong>"
        if on(r, "i"):
            text = f"<em>{text}</em>"
        return text

    def image(self, drawing):
        blip = drawing.find(".//a:blip", NS)
        if blip is None:
            return ""
        target = self.rels.get(blip.get(q("r:embed")), "")
        if not target:
            return ""
        self.figs += 1
        folder = ROOT / "src/assets/img/papers" / self.slug
        folder.mkdir(parents=True, exist_ok=True)
        name = f"fig-{self.figs}"
        png = folder / f"{name}.png"
        png.write_bytes(self.z.read("word/" + target.lstrip("/").replace("word/", "")))
        dims = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(png)], capture_output=True, text=True).stdout
        w, h = re.findall(r"pixel\w+: (\d+)", dims)
        alt = (drawing.find(".//wp:docPr", NS).get("descr") or "") if drawing.find(".//wp:docPr", NS) is not None else ""
        src = f"/assets/img/papers/{self.slug}/{name}"
        # charts stay PNG: they are small, flat and crisp, and sips' AVIF encoder blanked some of them
        return f'<img src="{src}.png" alt="{html.escape(alt)}" width="{w}" height="{h}" loading="lazy" decoding="async">'

    # ---------------------------------------------------------- blocks
    def close_list(self):
        if self.list:
            self.out.append(f"</{self.list}>")
            self.list = None

    def para(self, p):
        style = p.find("w:pPr/w:pStyle", NS)
        style = style.get(W + "val") if style is not None else ""
        if style in SKIP_STYLES:
            return
        self.pending_img = ""
        inner = self.runs(p).strip()
        img = self.pending_img
        plain = re.sub(r"<[^>]+>", "", inner).strip()
        if img:
            self.close_list()
            self.out.append(f"<figure>{img}</figure>")
            if not plain:
                return
        if not plain:
            return
        num = p.find("w:pPr/w:numPr/w:numId", NS)
        if num is not None and style not in ("Heading1", "Heading2", "Heading3"):
            tag = "ul" if self.bullets.get(num.get(W + "val"), True) else "ol"
            if self.list != tag:
                self.close_list()
                self.out.append(f"<{tag}>")
                self.list = tag
            self.out.append(f"<li>{inner}</li>")
            return
        self.close_list()
        bare = re.sub(r"</?(strong|em)>", "", inner)
        if style == "Heading1" or re.fullmatch(r"(\d+\.\s+)?[A-Z0-9][A-Z0-9 ,:&;'’\-–()/]+", plain) and len(plain) < 90:
            self.out.append(f"<h2>{title_case(bare) if bare.isupper() else bare}</h2>")
            self.code = "code" in plain.lower()
        elif style == "Heading2" or (re.match(r"\d+\.\d+\s+\S", plain) and len(plain) < 90 and not plain.endswith(".")):
            self.out.append(f"<h3>{bare}</h3>")
        elif style == "Heading3":
            self.out.append(f"<h4>{bare}</h4>")
        elif self.code and looks_like_code(plain):
            # code pasted as plain paragraphs: one <pre> per line, merged into blocks in convert()
            self.out.append(f"<pre><code>{html.escape(html.unescape(plain), quote=False)}</code></pre>")
        elif style in ("ImageCaption", "TableCaption") or re.match(r"((Figure|Table)\s+\d+[.:]|(Sources?|Notes?)[:.])", plain):
            caption = re.sub(r"^(<em>|<strong>)?\s+", r"\1", inner)
            self.out.append(f'<p class="caption">{caption}</p>')
        else:
            self.out.append(f"<p>{inner}</p>")

    def table(self, tbl):
        self.close_list()
        rows = []
        for k, tr in enumerate(tbl.findall("w:tr", NS)):
            cells = []
            for tc in tr.findall("w:tc", NS):
                text = "<br>".join(t for t in (self.runs(p).strip() for p in tc.findall("w:p", NS)) if t)
                text = re.sub(r"</?strong>", "", text) if k == 0 else text
                span = tc.find("w:tcPr/w:gridSpan", NS)
                attr = f' colspan="{span.get(W + "val")}"' if span is not None else ""
                tag = "th" if k == 0 else "td"
                cells.append(f"<{tag}{attr}>{text}</{tag}>")
            rows.append("<tr>" + "".join(cells) + "</tr>")
        if rows:
            self.out.append(f'<figure class="table"><table><thead>{rows[0]}</thead><tbody>{"".join(rows[1:])}</tbody></table></figure>')

    def convert(self):
        body = self.doc.find("w:body", NS)
        for el in body:
            if el.tag == q("w:p"):
                self.para(el)
            elif el.tag == q("w:tbl"):
                self.table(el)
            # w:sdt blocks are the generated table of contents: skipped
        self.close_list()
        # the title block above the first heading is front matter: the page hero already shows it
        first = next((i for i, b in enumerate(self.out) if b.startswith("<h2>")), 0)
        self.out = [b for i, b in enumerate(self.out) if i >= first or not b.startswith("<p>")]
        return re.sub(r"</code></pre>\n<pre><code>", "\n", "\n".join(self.out)) + "\n"


def main():
    src, slug = sys.argv[1], sys.argv[2]
    text = Paper(src, slug).convert()
    out = ROOT / "src/content/papers" / f"{slug}.html"
    out.write_text(text)
    print("wrote", out.relative_to(ROOT), f"({len(text.split())} words)")


if __name__ == "__main__":
    main()
