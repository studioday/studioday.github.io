// Magnetic controls: a button leans a little toward the cursor while it is near, then springs back.
// Fine pointers only, never under reduced motion; each control animates only while it is in play.
import { finePointer, reduceMotion, damp } from "../core/scroll.js";

const PULL = 0.28, REACH = 24;

export default function magnetic(nodes) {
  if (!finePointer || reduceMotion) return;
  for (const el of nodes) {
    const m = { x: 0, y: 0, tx: 0, ty: 0, raf: 0, last: 0 };
    const step = (t) => {
      const dt = m.last ? Math.min(0.05, (t - m.last) / 1000) : 1 / 60;
      m.last = t;
      m.x = damp(m.x, m.tx, 14, dt);
      m.y = damp(m.y, m.ty, 14, dt);
      el.style.translate = `${m.x.toFixed(1)}px ${m.y.toFixed(1)}px`;
      if (Math.abs(m.x - m.tx) < 0.05 && Math.abs(m.y - m.ty) < 0.05) {
        m.raf = 0; m.last = 0;
        if (!m.tx && !m.ty) el.style.translate = "";
        return;
      }
      m.raf = requestAnimationFrame(step);
    };
    const kick = () => { if (!m.raf) m.raf = requestAnimationFrame(step); };
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      m.tx = Math.max(-REACH, Math.min(REACH, dx * PULL));
      m.ty = Math.max(-REACH, Math.min(REACH, dy * PULL));
      kick();
    });
    el.addEventListener("pointerleave", () => { m.tx = 0; m.ty = 0; kick(); });
  }
}
