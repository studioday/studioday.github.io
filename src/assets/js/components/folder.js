// Tech file folder. Every project is a sheet in one folder, its tab staggered along the top edge.
// The tabs pop up out of the folder as it scrolls into view. Pulling a tab lifts that sheet clear of
// the folder to show its description; pulling it again (or its Open link) goes to the project, and
// the sheet's title flies into the project page's title through a view transition.
// The dial's current project nudges its tab up, so the two pickers stay in step.

import { scrollToY, pageTop, sfx } from "../core/scroll.js";

export default function folder([root]) {
  const sheets = [...root.querySelectorAll(".folder__sheet")];
  const tabs = sheets.map((s) => s.querySelector("[data-folder-tab]"));
  const papers = sheets.map((s) => s.querySelector("[data-folder-paper]"));
  const links = papers.map((p) => p.querySelector("[data-folder-open]"));
  const titles = sheets.map((s) => s.querySelector(".folder__title"));
  let current = -1;

  const pull = (i) => {
    current = i;
    root.classList.toggle("has-open", i >= 0);
    sheets.forEach((s, j) => {
      s.classList.toggle("is-open", j === i);
      tabs[j].setAttribute("aria-expanded", String(j === i));
      papers[j].inert = j !== i; // a sheet still in the folder keeps its link out of the tab order
    });
    if (i < 0) return;
    sfx("paper");
    // make room: the lifted sheet should clear the header
    const css = getComputedStyle(root);
    const top = root.getBoundingClientRect().top + parseFloat(css.getPropertyValue("--tab-h")) - parseFloat(css.getPropertyValue("--pull"));
    if (top < 84) scrollToY(pageTop(root) + parseFloat(css.getPropertyValue("--tab-h")) - parseFloat(css.getPropertyValue("--pull")) - 84);
  };
  pull(-1);

  // only the title of the file being opened carries the shared name, so it is unique on the page
  const nameTitle = (i) => titles.forEach((t, j) => (t.style.viewTransitionName = j === i ? "tech-title" : ""));
  const go = (i) => {
    if (links[i].target === "_blank") { window.open(links[i].href, "_blank", "noopener"); return; }
    nameTitle(i);
    location.href = links[i].href;
  };
  links.forEach((a, i) => a.addEventListener("click", () => { if (a.target !== "_blank") nameTitle(i); }));
  addEventListener("pageshow", () => nameTitle(-1)); // back from the project page (bfcache)

  tabs.forEach((tab, i) => tab.addEventListener("click", () => (current === i ? go(i) : pull(i))));
  // the lifted sheet itself is a target too
  papers.forEach((p, i) => p.addEventListener("click", (e) => {
    if (current === i && !e.target.closest("a")) go(i);
  }));

  root.addEventListener("keydown", (e) => {
    const k = tabs.indexOf(e.target);
    if (e.key === "Escape" && current >= 0) {
      const back = current;
      pull(-1);
      tabs[back].focus();
    } else if (k >= 0 && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      e.preventDefault();
      tabs[(k + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length].focus();
    }
  });
  document.addEventListener("pointerdown", (e) => { if (current >= 0 && !root.contains(e.target)) pull(-1); });

  // the tabs pop up out of the folder once it is well into view
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    root.classList.add("is-in");
    setTimeout(() => root.classList.add("is-settled"), 1500); // after the pop, tabs answer without delay
    io.disconnect();
  }, { rootMargin: "0px 0px -25% 0px" });
  io.observe(root);

  const mark = (n) => sheets.forEach((s, j) => s.classList.toggle("is-current", j === n));
  document.addEventListener("dial:change", (e) => mark(e.detail.index));
  mark(0);
}
