// Paper pages: the ring round the Back arrow fills as you read the sheet, and the contents list
// marks the section you are in.
import { onFrame, onLayout, pageTop, setStyle } from "../core/scroll.js";

export default function reading([sheet]) {
  const ring = document.querySelector(".back-button__ring circle");
  const toc = document.querySelector("[data-toc]");
  const links = toc ? [...toc.querySelectorAll("a")] : [];
  const heads = links.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
  let top = 0, height = 1, marks = [];
  const measure = () => {
    top = pageTop(sheet);
    height = Math.max(1, sheet.offsetHeight);
    marks = heads.map((h) => pageTop(h));
  };
  measure();
  onLayout(measure);
  if (ring) document.querySelector(".back-button")?.classList.add("is-reading");

  let current = -1;
  onFrame(({ y, vh }) => {
    const p = Math.min(1, Math.max(0, (y + vh * 0.6 - top) / height));
    if (ring) setStyle(ring, "strokeDashoffset", (1 - p).toFixed(3));
    if (!marks.length) return;
    let k = -1;
    for (let i = 0; i < marks.length; i++) if (marks[i] <= y + vh * 0.35) k = i;
    if (k === current) return;
    current = k;
    links.forEach((a, i) => (i === k ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
  });
}
