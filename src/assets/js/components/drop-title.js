// Letter-drop titles (after the falling EXPERIENCE title on clevir.li): letters fall into place
// on load, then lift away at slightly different speeds as you scroll past the hero.
import { onFrame, reduceMotion, setStyle } from "../core/scroll.js";

export default function dropTitle(nodes) {
  for (const title of nodes) {
    const text = title.textContent.trim();
    title.setAttribute("aria-label", text);
    title.textContent = "";
    const letters = [];
    [...text].forEach((ch, i) => {
      const span = document.createElement("span");
      span.className = "letter";
      span.setAttribute("aria-hidden", "true");
      span.textContent = ch === " " ? " " : ch;
      span.style.setProperty("--i", i);
      span.style.setProperty("--r", `${((i * 37) % 11) - 5}deg`);
      title.append(span);
      letters.push({ el: span, k: 0.1 + ((i * 7) % 5) * 0.07 });
    });
    const drop = () => requestAnimationFrame(() => requestAnimationFrame(() => title.classList.add("is-in")));
    // behind the Creatives loader the letters wait for it to clear
    if (document.documentElement.hasAttribute("data-intro")) document.addEventListener("intro:done", drop, { once: true });
    else drop();

    if (reduceMotion) continue;
    let lastY = -1;
    onFrame(({ y, vh }) => {
      const yy = Math.min(y, vh * 1.4);
      if (yy === lastY) return;
      lastY = yy;
      for (const l of letters) setStyle(l.el, "translate", `0 ${(-yy * l.k).toFixed(1)}px`);
    });
  }
}
