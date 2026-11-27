// Page titles blur in word by word on load; list sections rise in as they enter the viewport.
export function initReveal() {
  for (const title of document.querySelectorAll(".reveal-words")) {
    const text = title.textContent.trim();
    title.setAttribute("aria-label", text);
    title.textContent = "";
    text.split(/\s+/).forEach((word, i) => {
      if (i) title.append(" ");
      const span = document.createElement("span");
      span.className = "word";
      span.setAttribute("aria-hidden", "true");
      span.style.setProperty("--i", i);
      span.textContent = word;
      title.append(span);
    });
    requestAnimationFrame(() => requestAnimationFrame(() => title.classList.add("is-in")));
  }

  const appear = document.querySelectorAll(".appear, [data-reveal]");
  if (!appear.length) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -10% 0px" }
  );
  appear.forEach((el) => io.observe(el));
}
