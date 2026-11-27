// Port of the Framer Typewriter: types the string with a natural delay (120-160ms per character),
// pauses 1s, deletes it (40-80ms per character) and loops. The cursor blinks via CSS.
const rand = (min, max) => min + Math.random() * (max - min);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function typewriter(nodes) {
  for (const host of nodes) {
    const out = host.querySelector(".typewriter__text");
    const text = host.dataset.typewriter;
    if (!out || !text) continue;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      out.textContent = text.trim();
      continue;
    }
    run(out, text);
  }
}

async function run(out, text) {
  out.textContent = "";
  for (;;) {
    for (let i = 1; i <= text.length; i++) {
      out.textContent = text.slice(0, i);
      await wait(rand(120, 160));
    }
    await wait(1000);
    for (let i = text.length - 1; i >= 0; i--) {
      out.textContent = text.slice(0, i);
      await wait(rand(40, 80));
    }
  }
}
