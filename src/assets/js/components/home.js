// Home deck choreography (the greeting itself moves with the Icarus scene, see icarus.js).
// The four cards fan out when they come into view, then each one's doodled label writes itself
// once in turn so visitors learn the cards are the navigation. After that, labels appear on
// hover/focus (always shown on touch screens). King, queen and jack lead to Academics, Creatives and Tech.
import { finePointer, reduceMotion, sfx } from "../core/scroll.js";

export default function home([root]) {
  const cards = root.querySelector("[data-cards]");
  if (!cards) return;
  const doodles = Object.fromEntries(
    [...cards.querySelectorAll("[data-doodle-for]")].map((d) => [d.dataset.doodleFor, d])
  );
  const show = (key, on) => doodles[key]?.classList.toggle("is-on", on);

  for (const card of cards.querySelectorAll("[data-doodle]")) {
    const key = card.dataset.doodle;
    card.addEventListener("pointerenter", () => { show(key, true); sfx("flick"); });
    card.addEventListener("pointerleave", () => show(key, false));
    card.addEventListener("focus", () => show(key, true));
    card.addEventListener("blur", () => show(key, false));
  }

  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    cards.classList.add("is-in");
    const keys = ["academics", "creatives", "tech"];
    if (!finePointer || reduceMotion) {
      keys.forEach((k) => show(k, true));
      return;
    }
    // One-time hint: write each label in turn, then tuck them away.
    keys.forEach((k, i) => {
      setTimeout(() => show(k, true), 900 + i * 950);
      setTimeout(() => {
        if (!cards.querySelector(`[data-doodle="${k}"]:hover`)) show(k, false);
      }, 900 + i * 950 + 1400);
    });
  }, { rootMargin: "0px 0px -25% 0px" });
  io.observe(cards);
}
