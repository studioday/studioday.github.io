// Tech project dial (after the rotary dial on haroonrashidi.com).
// Drag the wheel, use the arrow buttons or the arrow keys to turn it; it settles on the nearest
// project. The highlighted wedge at the top marks the current project; Enter or the centre knob opens it.
// Each project has its own identity: its name is set in its own typeface (data-face) and its glow
// blooms behind the dial when the wheel lands on it.
import { onFrame, damp, reduceMotion, setStyle, sfx } from "../core/scroll.js";

export default function dial([root]) {
  const wheel = root.querySelector("[data-dial-wheel]");
  const segs = [...root.querySelectorAll("[data-dial-seg]")];
  const knob = root.querySelector("[data-dial-enter]");
  // the build may repeat the stops round the wheel: steps go by position, labels by project
  const positions = segs.length;
  if (!positions) return;
  const count = new Set(segs.map((s) => s.dataset.index)).size;
  const step = 360 / positions;
  const out = {
    index: document.querySelectorAll("[data-dial-index]"),
    title: document.querySelector("[data-dial-title]"),
    tagline: document.querySelector("[data-dial-tagline]"),
    stack: document.querySelector("[data-dial-stack]"),
  };
  const glows = [...document.querySelectorAll("[data-glow]")];
  const data = segs.map((s) => JSON.parse(s.dataset.dialSeg));

  let rot = 0, target = 0, active = -1, ticked = false;
  const mod = (n, m) => ((n % m) + m) % m;
  const indexFor = (r) => mod(Math.round(-r / step), positions);

  const show = (i) => {
    if (i === active) return;
    active = i;
    const d = data[i];
    const n = Number(segs[i].dataset.index);
    const label = `${String(n + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`;
    out.index.forEach((el) => (el.textContent = label));
    if (out.title && out.title.textContent !== d.title) {
      out.title.textContent = d.title;
      out.title.dataset.face = d.face || "display";
      // replay the entrance so the new name (and typeface) arrives rather than swaps
      out.title.classList.remove("is-swap");
      void out.title.offsetWidth;
      out.title.classList.add("is-swap");
    }
    glows.forEach((g) => g.classList.toggle("is-on", Number(g.dataset.glow) === n));
    document.dispatchEvent(new CustomEvent("dial:change", { detail: { index: n } }));
    if (ticked) sfx("tick");
    ticked = true; // the first stop is shown on load, silently
    if (out.tagline) out.tagline.textContent = d.tagline;
    if (out.stack) out.stack.replaceChildren(...d.stack.map((s) => Object.assign(document.createElement("li"), { textContent: s })));
    knob.href = segs[i].getAttribute("href");
    // a stop that leaves the site (the GitHub profile) opens in a new tab
    const external = segs[i].hasAttribute("data-external");
    if (external) { knob.target = "_blank"; knob.rel = "noopener"; } else { knob.removeAttribute("target"); knob.removeAttribute("rel"); }
    knob.setAttribute("aria-label", external ? `Open ${d.title} on GitHub (new tab)` : `Open ${d.title}`);
    segs.forEach((s, j) => {
      s.classList.toggle("is-active", j === i);
      s.setAttribute("aria-selected", String(j === i));
    });
    wheel.setAttribute("aria-activedescendant", segs[n].id); // the first copy of this stop
  };

  const turn = (dir) => { target = Math.round(target / step) * step - dir * step; };
  root.querySelector("[data-dial-next]")?.addEventListener("click", () => turn(1));
  root.querySelector("[data-dial-prev]")?.addEventListener("click", () => turn(-1));

  addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, select, [data-folder]")) return; // the folder's tabs use the arrows too
    if (e.key === "ArrowRight") { e.preventDefault(); turn(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); turn(-1); }
    else if (e.key === "Enter" && (e.target === document.body || e.target === wheel)) {
      e.preventDefault();
      if (knob.target === "_blank") open(knob.href, "_blank", "noopener");
      else location.href = knob.href;
    }
  });

  // Dragging: turn by the change in pointer angle around the wheel centre.
  let drag = null;
  const angleOf = (e) => {
    const r = wheel.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  wheel.addEventListener("pointerdown", (e) => {
    drag = { a: angleOf(e), start: target, moved: 0, x: e.clientX, y: e.clientY };
    wheel.setPointerCapture(e.pointerId);
  });
  wheel.addEventListener("pointermove", (e) => {
    if (!drag) return;
    let delta = angleOf(e) - drag.a;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    drag.a = angleOf(e);
    drag.start += delta;
    target = drag.start;
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
  });
  const release = () => {
    if (!drag) return;
    target = Math.round(target / step) * step;
    wheel.dataset.dragged = drag.moved > 6 ? "1" : "";
    drag = null;
  };
  wheel.addEventListener("pointerup", release);
  wheel.addEventListener("pointercancel", release);
  // A click on a segment only follows the link if the wheel was not dragged; otherwise it settles.
  wheel.addEventListener("click", (e) => {
    if (wheel.dataset.dragged) { e.preventDefault(); wheel.dataset.dragged = ""; return; }
    const seg = e.target.closest("[data-dial-seg]");
    if (seg && !seg.classList.contains("is-active")) {
      e.preventDefault();
      const i = segs.indexOf(seg);
      const diff = mod(i - active + positions / 2, positions) - positions / 2;
      target = Math.round(target / step) * step - diff * step;
    }
  });

  onFrame(({ dt }) => {
    if (rot === target && !drag) return;
    rot = reduceMotion ? target : damp(rot, target, drag ? 30 : 7, dt);
    if (Math.abs(rot - target) < 0.01) rot = target;
    setStyle(wheel, "--rot", `${rot.toFixed(2)}deg`);
    show(indexFor(drag ? rot : target));
  });
  show(0);
}
