// Fettle, step by step, running the real code/python/fettle_mine.py in your browser (Pyodide).
// Each step shares one Python session, like a notebook. Synthetic sample log.
import type { Step } from "../components/Runner";

export const FETTLE_STEPS: Step[] = [
  {
    title: "Load an event log",
    why: "Every ERP already writes one: case id, activity, timestamp. Here it's 1,000 synthetic spares requests. Change n or seed and run it again.",
    code: `import fettle_mine as fm

log = fm.synthetic_log(n=1000, seed=42)
print(f"{len(log):,} events")
for e in log[:8]:
    print(e)`,
  },
  {
    title: "Discover the flow: the directly-follows graph",
    why: "Count how often one activity directly follows another. This is the map of what really happens, not what the process document says.",
    code: `ts = fm.traces(log)
print(f"{len(ts):,} cases\\n")
for (a, b), k in fm.directly_follows(ts).most_common(10):
    print(f"{a:>9} → {b:<9} {k:>5}")`,
  },
  {
    title: "Variants: the paths cases actually take",
    why: "The happy path is only part of the story. Rework loops and skipped approvals show up as their own variants.",
    code: `for v, k in fm.variants(ts).most_common(5):
    print(f"{k:>4}  {' → '.join(v)}")`,
  },
  {
    title: "Find where work waits",
    why: "Median wait before each step, then the bottleneck by p75 wait. Transit time isn't a queue, so it's left out. Finally the bias check: the same wait, per site.",
    code: `for act, h in sorted(fm.waits(ts).items(), key=lambda x: -x[1]):
    print(f"{act:>9} {h:6.1f} h")

worst, p75, over24 = fm.bottleneck(ts)
print(f"\\nBottleneck: {worst}  p75 {p75:.1f} h  {over24:.0%} wait > 24 h")
print("Per site:", {s: round(h, 1) for s, h in fm.waits_by_site(ts, worst).items()})`,
  },
  {
    title: "Conformance: token replay and fitness",
    why: "Replay every case through the target Petri net. Missing tokens mean a skipped step; remaining tokens mean work left hanging. fitness = ½(1 − m/c) + ½(1 − r/p).",
    code: `rep = fm.token_replay(ts)
print(f"m={rep.m}  c={rep.c}  r={rep.r}  p={rep.p}")
print(f"fitness = ½(1 − {rep.m}/{rep.c}) + ½(1 − {rep.r}/{rep.p}) = {rep.fitness:.3f}\\n")
for d, k in rep.deviations.most_common(4):
    print(f"{k:>4}  {d}")`,
  },
  {
    title: "Write Claude Code's context pack",
    why: "The mined facts, the rules from past reviews and the acceptance tests become the prompt. This is how process mining makes the AI better: precise context in, testable fixes out.",
    code: `print(fm.context_pack(ts, rep, target_wait_h=8))`,
  },
  {
    title: "Try a fix and re-mine it",
    why: "Simulate the approved fix: like-for-like requests are auto-approved within limits, so the approval wait shrinks. Then mine again and compare. This is the flywheel's proof step.",
    code: `import random
rng = random.Random(7)

# The approved fix: 60% of requests are like-for-like and auto-approved within agreed limits
fixed = []
for case, evs in fm.traces(log).items():
    shift, auto = 0.0, rng.random() < 0.6
    for i, (c, act, t, site) in enumerate(evs):
        if act == "approve" and auto and i > 0:
            shift -= max(0.0, (t - evs[i - 1][2]) - 1.0)   # approval now takes about an hour
        fixed.append((c, act, round(t + shift, 2), site))

ts2 = fm.traces(fixed)
b1, b2 = fm.bottleneck(ts), fm.bottleneck(ts2)
print(f"bottleneck before: {b1[0]:<8} p75 {b1[1]:5.1f} h, {b1[2]:.0%} wait > 24 h")
print(f"bottleneck after:  {b2[0]:<8} p75 {b2[1]:5.1f} h, {b2[2]:.0%} wait > 24 h")
print("per site after:", {s: round(h, 1) for s, h in fm.waits_by_site(ts2, "approve").items()})
print("\\n(simulated on the synthetic log; Fettle's measured result was −65% bottleneck wait)")`,
  },
];
