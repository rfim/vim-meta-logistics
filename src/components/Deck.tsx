import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Footer, Header } from "./Chrome";

export type Slide = { id: string; label: string; body: ReactNode };

const NO_SWIPE = "input, select, textarea, pre, .table-wrap, .board, .no-swipe, .deck-bar";

/**
 * A page is a row of full-height slides. Move with ← →, the arrow buttons, the step tabs or a swipe.
 * Each slide scrolls on its own if its content is taller than the screen. The URL hash names the slide.
 */
export function Deck({ slides }: { slides: Slide[] }) {
  const fromHash = () => Math.max(0, slides.findIndex((s) => "#" + s.id === location.hash));
  const [i, setI] = useState(fromHash);
  const [live, setLive] = useState("");
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const n = slides.length;

  const go = useCallback((k: number, focus = false) => {
    const next = Math.max(0, Math.min(n - 1, k));
    setI(next);
    history.replaceState(null, "", "#" + slides[next].id);
    setLive(`Slide ${next + 1} of ${n}: ${slides[next].label}`);
    if (focus) slideRefs.current[next]?.focus({ preventScroll: true });
  }, [n, slides]);

  // Keyboard ← → (not while typing or using a slider)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, select, textarea, [contenteditable]") || e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1, true); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1, true); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [i, go]);

  // In-page links like href="#results" move the deck
  useEffect(() => {
    const f = () => { const k = slides.findIndex((s) => "#" + s.id === location.hash); if (k >= 0) go(k, true); };
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, [slides, go]);

  // Keep the active tab visible in the bar
  useEffect(() => { tabRefs.current[i]?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [i]);

  // Touch swipe
  const start = useRef<{ x: number; y: number; ok: boolean } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    start.current = { x: e.clientX, y: e.clientY, ok: !(e.target as HTMLElement).closest(NO_SWIPE) };
  };
  const onUp = (e: React.PointerEvent) => {
    const s = start.current; start.current = null;
    if (!s || !s.ok) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 1.6 * Math.abs(dy)) go(i + (dx < 0 ? 1 : -1));
  };

  return (
    <div className="app">
      <a className="skip" href={"#s-" + slides[i].id} onClick={(e) => { e.preventDefault(); slideRefs.current[i]?.focus(); }}>Skip to content</a>
      <Header />
      <main className="deck" id="main" aria-roledescription="carousel" aria-label="Page sections" onPointerDown={onDown} onPointerUp={onUp}>
        <div className="track" style={{ transform: `translateX(${-100 * i}%)` }}>
          {slides.map((s, k) => (
            <div
              key={s.id}
              id={"s-" + s.id}
              ref={(el) => { slideRefs.current[k] = el; }}
              className={"slide" + (k === i ? " active" : "")}
              role="group"
              aria-roledescription="slide"
              aria-label={`${k + 1} of ${n}: ${s.label}`}
              tabIndex={-1}
              inert={k !== i}
            >
              {s.body}
              {k === n - 1 && <Footer />}
            </div>
          ))}
        </div>
        <div className="progress" style={{ width: `${((i + 1) / n) * 100}%` }} aria-hidden="true" />
        {i === 0 && <div className="hint" aria-hidden="true">Use ← → or swipe to move between slides</div>}
      </main>
      <nav className="deck-bar" aria-label="Slides">
        <button className="nav-arrow" onClick={() => go(i - 1, true)} disabled={i === 0} aria-label="Previous slide">←</button>
        <div className="tabs" role="tablist" aria-label="Slides on this page">
          {slides.map((s, k) => (
            <button key={s.id} ref={(el) => { tabRefs.current[k] = el; }} role="tab" aria-selected={k === i} aria-controls={"s-" + s.id} onClick={() => go(k, true)}>
              <b>{k + 1}</b><span>{s.label}</span>
            </button>
          ))}
        </div>
        <span className="count" aria-hidden="true">{i + 1} / {n}</span>
        <button className="nav-arrow" onClick={() => go(i + 1, true)} disabled={i === n - 1} aria-label="Next slide">→</button>
      </nav>
      <div className="sr" aria-live="polite">{live}</div>
    </div>
  );
}
