import { useState } from "react";
import { Header } from "../components/Chrome";
import { ApprovalsApp } from "../tools/approvals/ApprovalsApp";

/** Back-office 1 as a real tool: one page, no deck, no Fettle. */
export function Approvals() {
  const [open, setOpen] = useState(() => { const v = (() => { try { return localStorage.getItem("sa-intro"); } catch { return null; } })(); return v ? v === "open" : innerWidth >= 760; });
  const toggle = () => { setOpen(!open); try { localStorage.setItem("sa-intro", open ? "closed" : "open"); } catch { /* private mode */ } };
  return (
    <div className="app">
      <Header />
      <div className={"sa-intro" + (open ? "" : " closed")}>
        <div className="sa-intro-row">
          <p><b>Back-office 1, built as a real tool.</b> <span className="muted">No Fettle: no AI suggestions, no process mining. This is the baseline a logistics team would ship first.</span></p>
          <button className="sa-link" onClick={toggle} aria-expanded={open}>{open ? "Hide" : "What is this?"}</button>
        </div>
        {open && (
          <div className="sa-intro-grid">
            <div><span className="sa-k">Problem</span>Spares for break-fix in a data centre wait on approvals spread across email and chat. Nobody can see what is waiting, who is late, or who approved what.</div>
            <div><span className="sa-k">What it does</span>One queue per site lead. Written policy (limits, like-for-like, stock, no self-approval) is re-checked inside the transaction. Approving reserves stock oldest-lot-first. Every change lands in an append-only audit log.</div>
            <div><span className="sa-k">Expected result</span>Approvals become visible and measurable: queue age against a 24 h SLA, p50/p90 by site, a full trail for audit. That log is what Fettle would later mine.</div>
            <div><span className="sa-k">Try it</span>Sign in as <b>Cy</b> and approve a DC-A request. Switch to <b>Kofi</b> and raise one. As <b>Mo</b>, sign the over-limit NIC. Reload: it's all still there. Data is a <b>synthetic sample</b>. <a href="spares.html#inbox">The Fettle version →</a></div>
          </div>
        )}
      </div>
      <ApprovalsApp />
      <p className="sa-disc">Synthetic sample data · Postgres (PGlite) running in your browser · An independent application, not affiliated with or endorsed by Meta.</p>
    </div>
  );
}
