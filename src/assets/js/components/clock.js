// Local time in Bombay beside "Based in", so a visitor knows whether a reply is likely tonight.
export default function clock(nodes) {
  const fmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
  const tick = () => { for (const n of nodes) n.textContent = `· ${fmt.format(new Date()).toUpperCase()} IST`; };
  tick();
  for (const n of nodes) n.hidden = false;
  setInterval(tick, 30000);
}
