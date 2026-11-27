// Entry point. The scroll core (Lenis + one frame loop) starts first; shared behaviour loads on
// every page, heavier components only where their markup exists.
import "./core/scroll.js";
import { initReveal } from "./components/reveal.js";

initReveal();

// Back button: return to the previous page when it was on this site, otherwise go to the parent page.
document.querySelector("[data-back]")?.addEventListener("click", (e) => {
  const fromHere = document.referrer && new URL(document.referrer).origin === location.origin;
  if (fromHere && history.length > 1) {
    e.preventDefault();
    history.back();
  }
});

const components = [
  ["[data-intro-screen]", () => import("./components/intro.js")],
  ["[data-parallax], [data-sway], [data-sky]", () => import("./components/parallax.js")],
  ["[data-drop-title]", () => import("./components/drop-title.js")],
  ["[data-typewriter]", () => import("./components/typewriter.js")],
  ["[data-home]", () => import("./components/home.js")],
  ["[data-cat]", () => import("./components/cat.js")],
  ["[data-flightpath]", () => import("./components/flightpath.js")],
  ["[data-arcade]", () => import("./components/arcade.js")],
  ["[data-dial]", () => import("./components/dial.js")],
  ["[data-folder]", () => import("./components/folder.js")],
  ["[data-ascii]", () => import("./components/ascii-portrait.js")],
  ["[data-github-repo]", () => import("./components/github-repo.js")],
  ["[data-icarus]", () => import("./components/icarus.js")],
  ["[data-logo-word]", () => import("./components/phase.js")],
  ["[data-sound]", () => import("./components/sound.js")],
  ["[data-magnetic]", () => import("./components/magnetic.js")],
  ["[data-reading]", () => import("./components/reading.js")],
  ["[data-clock]", () => import("./components/clock.js")],
];

for (const [selector, load] of components) {
  const nodes = document.querySelectorAll(selector);
  if (nodes.length) load().then((m) => m.default(nodes));
}
