// A small Petri net renderer with moving tokens (SVG, no dependencies).
// Places are circles, transitions are boxes. Tokens follow a route of node ids: they queue at places
// and pause briefly at transitions. Below 620 px the net switches to its vertical layout.

export type NodeSpec = { type: "p" | "t"; label?: string; sub?: string };
export type Layout = { w: number; h: number; nodes: Record<string, [number, number]> };
export type Bend = number | { h?: number; v?: number };
export type PetriSpec = {
  title: string;
  desc: string;
  vw?: number; // transition width in the vertical layout
  nodes: Record<string, NodeSpec>;
  layouts: { h: Layout; v?: Layout };
  arcs: [string, string, string?, Bend?][];
  hidden?: string[]; // node ids or "a>b" arc keys hidden until revealed
};
export type SimConfig = {
  spawnEvery: number;
  speed: number;
  dwell: Record<string, number>;
  route: () => string[];
  max?: number;
  lateAt?: string; // place whose long wait marks a token red
};
type Token = { route: string[]; i: number; mode: "dwell" | "move"; t: number; seed: number; late: boolean; done?: boolean; el?: SVGCircleElement | null };

const NS = "http://www.w3.org/2000/svg";
function mk<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  parent?.appendChild(e);
  return e;
}

export function createPetri(host: HTMLElement, spec: PetriSpec) {
  let layout: "h" | "v" = "h";
  let svg: SVGSVGElement;
  let tokLayer: SVGGElement;
  let paths: Record<string, SVGPathElement> = {};
  let tokens: Token[] = [];
  let running = false, want = false, visible = true, last = 0, spawnAcc = 0, raf = 0;
  let cfg: SimConfig = { spawnEvery: 0.9, speed: 160, dwell: {}, route: () => [], max: 60 };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hot = new Set<string>(), fixd = new Set<string>(), hidden = new Set(spec.hidden || []);
  const uid = host.id || "pn" + Math.random().toString(36).slice(2, 8);

  const pickLayout = () => (host.clientWidth < 620 && spec.layouts.v ? "v" : "h");

  function render() {
    layout = pickLayout();
    const L = spec.layouts[layout]!;
    host.innerHTML = "";
    svg = mk("svg", { viewBox: `0 0 ${L.w} ${L.h}`, class: "diagram", role: "img", "aria-labelledby": `${uid}-t ${uid}-d` });
    mk("title", { id: uid + "-t" }, svg).textContent = spec.title;
    mk("desc", { id: uid + "-d" }, svg).textContent = spec.desc;
    const defs = mk("defs", {}, svg);
    ([["ah", "var(--text-3)"], ["ahr", "var(--bad)"], ["ahb", "var(--act)"]] as const).forEach(([id, c]) => {
      const m = mk("marker", { id: uid + id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
      mk("path", { d: "M0,0 L10,5 L0,10 z", style: `fill:${c}` }, m);
    });
    const gA = mk("g", {}, svg), gN = mk("g", {}, svg);
    paths = {};
    const TW = (layout === "v" ? spec.vw || 150 : 112) / 2, TH = 20;
    const edge = (id: string, ux: number, uy: number) =>
      spec.nodes[id].type === "p" ? 17 : Math.min(TW / (Math.abs(ux) || 1e-6), TH / (Math.abs(uy) || 1e-6)) + 2;

    for (const [a, b, cls = "", bend = 0] of spec.arcs) {
      const A = L.nodes[a], B = L.nodes[b];
      if (!A || !B) continue;
      const [x1, y1] = A, [x2, y2] = B;
      const bb = typeof bend === "object" ? bend[layout] || 0 : bend;
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      let d: string;
      if (!bb) {
        const ta = edge(a, dx / len, dy / len), tb = edge(b, dx / len, dy / len);
        d = `M${x1 + (dx / len) * ta},${y1 + (dy / len) * ta} L${x2 - (dx / len) * tb},${y2 - (dy / len) * tb}`;
      } else {
        const mx = (x1 + x2) / 2 - (dy / len) * bb, my = (y1 + y2) / 2 + (dx / len) * bb;
        const t1 = Math.hypot(mx - x1, my - y1), t2 = Math.hypot(x2 - mx, y2 - my);
        const ta = edge(a, (mx - x1) / t1, (my - y1) / t1), tb = edge(b, (x2 - mx) / t2, (y2 - my) / t2);
        d = `M${x1 + ((mx - x1) / t1) * ta},${y1 + ((my - y1) / t1) * ta} Q${mx},${my} ${x2 - ((x2 - mx) / t2) * tb},${y2 - ((y2 - my) / t2) * tb}`;
      }
      const marker = cls.includes("rework") ? "ahr" : cls.includes("fix") ? "ahb" : "ah";
      const p = mk("path", { d, class: "arc " + cls, "marker-end": `url(#${uid + marker})` }, gA);
      if (hidden.has(a + ">" + b)) p.style.display = "none";
      paths[a + ">" + b] = p;
    }
    for (const id in spec.nodes) {
      const n = spec.nodes[id], pos = L.nodes[id];
      if (!pos) continue;
      const [x, y] = pos;
      const g = mk("g", { "data-id": id }, gN);
      if (hidden.has(id)) g.style.display = "none";
      if (n.type === "p") {
        mk("circle", { cx: x, cy: y, r: 15, class: "place" }, g);
        if (n.label) {
          const v = layout === "v";
          mk("text", { x: v ? x + 24 : x, y: v ? y + 4 : y + 34, "text-anchor": v ? "start" : "middle", class: "sub" }, g).textContent = n.label;
        }
      } else {
        const w = layout === "v" ? spec.vw || 150 : 112, h = 40;
        const cls = "trans" + (fixd.has(id) ? " fixed" : hot.has(id) ? " hot" : "");
        mk("rect", { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 8, class: cls }, g);
        mk("text", { x, y: n.sub ? y - 2 : y + 4, "text-anchor": "middle", class: "lbl" }, g).textContent = n.label || "";
        if (n.sub) mk("text", { x, y: y + 12, "text-anchor": "middle", class: "sub", style: "font-size:10px" }, g).textContent = n.sub;
      }
    }
    tokLayer = mk("g", {}, svg);
    host.appendChild(svg);
    tokens.forEach((t) => (t.el = null));
  }

  function step(dt: number) {
    spawnAcc += dt;
    while (spawnAcc > cfg.spawnEvery) {
      spawnAcc -= cfg.spawnEvery;
      if (tokens.length < (cfg.max ?? 60)) tokens.push({ route: cfg.route(), i: 0, mode: "dwell", t: 0, seed: Math.random(), late: false });
    }
    for (const t of tokens) {
      const id = t.route[t.i];
      if (t.mode === "dwell") {
        t.t += dt;
        const base = cfg.dwell[id] ?? 0.15;
        if (t.t >= base * (0.6 + 0.8 * t.seed)) {
          if (cfg.lateAt === id && base > 1.5 && t.seed > 0.45) t.late = true;
          if (t.i >= t.route.length - 1) { t.done = true; continue; }
          t.mode = "move"; t.t = 0;
        }
      } else {
        const p = paths[id + ">" + t.route[t.i + 1]];
        t.t += (dt * cfg.speed) / (p ? p.getTotalLength() : 1);
        if (t.t >= 1) { t.i++; t.mode = "dwell"; t.t = 0; }
      }
    }
    tokens = tokens.filter((t) => { if (t.done) t.el?.remove(); return !t.done; });
    draw();
  }

  function draw() {
    const L = spec.layouts[layout]!;
    const stack: Record<string, number> = {};
    for (const t of tokens) {
      if (!t.el) t.el = mk("circle", { r: 5.5 }, tokLayer);
      t.el.setAttribute("class", "token" + (t.late ? " late" : ""));
      const id = t.route[t.i];
      let x: number, y: number;
      if (t.mode === "dwell") {
        const [px, py] = L.nodes[id];
        const k = (stack[id] = (stack[id] || 0) + 1);
        if (spec.nodes[id].type === "p" && k > 1) {
          const col = (k - 2) % 5, row = Math.floor((k - 2) / 5);
          if (layout === "v") { x = px - 26 - row * 12; y = py - 24 + col * 12; }
          else { x = px - 24 + col * 12; y = py - 30 - row * 12; }
        } else { x = px; y = py; }
      } else {
        const p = paths[id + ">" + t.route[t.i + 1]];
        if (!p) continue;
        const pt = p.getPointAtLength(Math.min(1, t.t) * p.getTotalLength());
        x = pt.x; y = pt.y;
      }
      t.el.setAttribute("cx", x.toFixed(1));
      t.el.setAttribute("cy", y.toFixed(1));
    }
  }

  const loop = (ts: number) => {
    if (!running) return;
    const dt = Math.min(0.12, (ts - (last || ts)) / 1000);
    last = ts;
    step(dt);
    raf = requestAnimationFrame(loop);
  };
  const run = () => {
    if (reduced) return;
    if (want && visible && !running) { running = true; last = 0; raf = requestAnimationFrame(loop); }
    if ((!want || !visible) && running) { running = false; cancelAnimationFrame(raf); }
  };
  const settle = (seconds = 20) => { for (let s = 0; s < seconds; s += 0.05) step(0.05); };

  render();
  let rw = host.clientWidth;
  const ro = new ResizeObserver(() => {
    if (Math.abs(host.clientWidth - rw) < 2) return;
    rw = host.clientWidth;
    if (pickLayout() !== layout) render();
  });
  ro.observe(host);
  // Pauses when the slide is off-screen
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; run(); });
  io.observe(host);

  return {
    configure(c: Partial<SimConfig>) { cfg = { ...cfg, ...c }; },
    setHot(ids: string[]) { hot.clear(); ids.forEach((x) => hot.add(x)); render(); },
    setFixed(ids: string[], reveal: string[] = []) { fixd.clear(); ids.forEach((x) => fixd.add(x)); hot.clear(); reveal.forEach((x) => hidden.delete(x)); render(); },
    reset(hide: string[] = spec.hidden || []) { tokens.forEach((t) => t.el?.remove()); tokens = []; spawnAcc = 0; fixd.clear(); hide.forEach((x) => hidden.add(x)); render(); },
    count(id: string) { return tokens.filter((t) => t.mode === "dwell" && t.route[t.i] === id).length; },
    start() { want = true; if (reduced) { settle(); } run(); },
    stop() { want = false; run(); },
    settle,
    destroy() { want = false; run(); ro.disconnect(); io.disconnect(); host.innerHTML = ""; },
  };
}
export type PetriApi = ReturnType<typeof createPetri>;
