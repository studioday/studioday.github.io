// The logo keeps time. "STUDIO day" is the brand, and its second word follows the sky you are in:
// on the home page it reads night when Icarus kneels in the dark, dawn at the deck, day through the
// record and dusk at the name; Creatives (blue hour) reads dusk. Sections declare their time with
// data-phase; the one crossing the middle of the screen wins. The aria-label stays "Studio day".
import { onFrame, onLayout, pageTop, reduceMotion } from "../core/scroll.js";

export default function phase() {
  const word = document.querySelector("[data-logo-word]");
  if (!word) return;
  const regions = [...document.querySelectorAll("main [data-phase]")];
  const fallback = document.body.dataset.phase || "day";
  let spans = [];
  const measure = () => { spans = regions.map((el) => ({ el, top: pageTop(el), bottom: pageTop(el) + el.offsetHeight })); };
  measure();
  onLayout(measure);

  let current = "day"; // the word printed in the markup
  const show = (next) => {
    if (next === current) return;
    current = next;
    const old = word.firstElementChild;
    const span = document.createElement("span");
    span.textContent = next;
    if (reduceMotion || !old) { word.replaceChildren(span); return; }
    // the new word rolls up from below as the old one leaves upward
    span.className = "is-in";
    old.className = "is-out";
    word.append(span);
    setTimeout(() => old.remove(), 600);
  };

  // pages without regions take the page's own time once, after the title has landed
  if (!regions.length) {
    const settle = () => setTimeout(() => show(fallback), 900);
    if (document.documentElement.hasAttribute("data-intro")) document.addEventListener("intro:done", settle, { once: true });
    else settle();
    return;
  }

  onFrame(({ y, vh }) => {
    const mid = y + vh * 0.5;
    const hit = spans.find((s) => mid >= s.top && mid < s.bottom);
    show(hit ? hit.el.dataset.phase : fallback);
  });
}
