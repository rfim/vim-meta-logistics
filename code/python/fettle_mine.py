"""fettle_mine.py: the mining half of the Fettle flywheel, in plain Python (standard library only).

Event log -> directly-follows graph -> variants -> waits -> token-replay fitness -> a context pack
for Claude Code. Written for this portfolio to show the method; the production Fettle code at
Crea Digital Ventures is not published. The log below is a seeded SYNTHETIC SAMPLE.

Run:  python3 fettle_mine.py            # synthetic log
      python3 fettle_mine.py log.csv    # your own CSV: case_id,activity,timestamp_h,site
"""
from __future__ import annotations

import csv
import random
import statistics
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field

Event = tuple[str, str, float, str]  # case_id, activity, time in hours, site


# --- 1. The event log ----------------------------------------------------------------------------
def synthetic_log(n: int = 1000, seed: int = 42) -> list[Event]:
    """Spares requests: request -> approve -> pick -> ship -> receive, with the usual mess."""
    rng = random.Random(seed)
    log: list[Event] = []
    for c in range(1, n + 1):
        case, site, t = f"SR-{c:05d}", rng.choice(["DC-A", "DC-B", "DC-C"]), c * 0.7

        def add(act: str, wait: float) -> None:
            nonlocal t
            t += wait
            log.append((case, act, round(t, 2), site))

        add("request", 0)
        v = rng.random()
        if v > 0.93:  # rule breach: picked without an approval event
            add("pick", 2); add("ship", 3); add("receive", 18); continue
        add("approve", 24 + rng.random() * 30 if v < 0.32 else 2 + rng.random() * 10)  # the bottleneck
        if v > 0.89:
            add("cancelled", 4); continue
        add("pick", 2 + rng.random() * 3); add("ship", 2 + rng.random() * 2)
        if rng.random() < 0.16:  # rework: mismatch at the dock sends it back to pick
            add("mismatch", 20); add("pick", 3); add("ship", 2)
        add("receive", 18 + rng.random() * 8)
    return log


def read_csv(path: str) -> list[Event]:
    with open(path, newline="") as f:
        return [(r["case_id"], r["activity"], float(r["timestamp_h"]), r.get("site", "")) for r in csv.DictReader(f)]


def traces(log: list[Event]) -> dict[str, list[Event]]:
    by_case: dict[str, list[Event]] = defaultdict(list)
    for e in log:
        by_case[e[0]].append(e)
    for evs in by_case.values():
        evs.sort(key=lambda e: e[2])
    return by_case


# --- 2. Discovery: directly-follows graph and variants -------------------------------------------
def directly_follows(ts: dict[str, list[Event]]) -> Counter[tuple[str, str]]:
    return Counter((a[1], b[1]) for evs in ts.values() for a, b in zip(evs, evs[1:]))


def variants(ts: dict[str, list[Event]]) -> Counter[tuple[str, ...]]:
    return Counter(tuple(e[1] for e in evs) for evs in ts.values())


# --- 3. Where does work wait? ----------------------------------------------------------------------
TRANSIT = {"receive"}  # time before "receive" is the truck, not a queue: never call it a bottleneck


def wait_samples(ts: dict[str, list[Event]]) -> dict[str, list[float]]:
    """Hours spent waiting *before* each activity, every case."""
    w: dict[str, list[float]] = defaultdict(list)
    for evs in ts.values():
        for a, b in zip(evs, evs[1:]):
            w[b[1]].append(b[2] - a[2])
    return w


def waits(ts: dict[str, list[Event]]) -> dict[str, float]:
    return {act: statistics.median(v) for act, v in wait_samples(ts).items()}


def bottleneck(ts: dict[str, list[Event]], net: "PetriNet | None" = None) -> tuple[str, float, float]:
    """The queue step with the worst 75th-percentile wait -> (activity, p75 hours, share waiting > 24 h)."""
    net = net or TARGET
    w = {a: v for a, v in wait_samples(ts).items() if a in net.transitions and a not in TRANSIT and len(v) > 3}
    p75 = {a: statistics.quantiles(v, n=4)[2] for a, v in w.items()}
    worst = max(p75, key=p75.get)
    return worst, p75[worst], sum(x > 24 for x in w[worst]) / len(w[worst])


def waits_by_site(ts: dict[str, list[Event]], activity: str) -> dict[str, float]:
    """The bias check: the same wait, per site. An average can hide the site left behind."""
    w: dict[str, list[float]] = defaultdict(list)
    for evs in ts.values():
        for a, b in zip(evs, evs[1:]):
            if b[1] == activity:
                w[b[3]].append(b[2] - a[2])
    return {s: statistics.median(v) for s, v in sorted(w.items())}


# --- 4. Conformance: token replay on a Petri net --------------------------------------------------
@dataclass
class PetriNet:
    """transition label -> (input places, output places). Initial marking: one token in 'start'."""
    transitions: dict[str, tuple[list[str], list[str]]]
    start: str = "start"
    end: str = "end"


TARGET = PetriNet({
    "request": (["start"], ["p1"]),
    "approve": (["p1"], ["p2"]),
    "pick": (["p2"], ["p3"]),
    "ship": (["p3"], ["p4"]),
    "receive": (["p4"], ["end"]),
})


@dataclass
class Replay:
    m: int = 0  # missing tokens: a step fired without the token it needed
    c: int = 0  # consumed
    r: int = 0  # remaining: work left hanging when the case ended
    p: int = 0  # produced
    deviations: Counter[str] = field(default_factory=Counter)

    @property
    def fitness(self) -> float:
        """fitness = ½(1 − m/c) + ½(1 − r/p)"""
        return 0.5 * (1 - self.m / self.c) + 0.5 * (1 - self.r / self.p)


def token_replay(ts: dict[str, list[Event]], net: PetriNet = TARGET) -> Replay:
    rep = Replay()
    for evs in ts.values():
        marking: Counter[str] = Counter({net.start: 1})
        rep.p += 1
        for _, act, _, _ in evs:
            if act not in net.transitions:  # an activity the model doesn't know (e.g. mismatch)
                rep.deviations[f"unknown: {act}"] += 1
                continue
            ins, outs = net.transitions[act]
            for pl in ins:
                if marking[pl] == 0:
                    rep.m += 1
                    rep.deviations[f"missing token before {act}"] += 1
                    marking[pl] += 1
                marking[pl] -= 1
                rep.c += 1
            for pl in outs:
                marking[pl] += 1
                rep.p += 1
        if marking[net.end] == 0:
            rep.m += 1
            marking[net.end] += 1
        marking[net.end] -= 1
        rep.c += 1
        rep.r += sum(marking.values())
    return rep


# --- 5. Turn the gap into Claude Code's context ----------------------------------------------------
def context_pack(ts: dict[str, list[Event]], rep: Replay, target_wait_h: float = 8.0) -> str:
    w = waits(ts)
    worst, p75, over24 = bottleneck(ts)
    var = variants(ts)
    n = len(ts)
    rework = sum(k for v, k in var.items() if "mismatch" in v) / n
    breach = sum(k for v, k in var.items() if "approve" not in v and "receive" in v) / n
    sites = waits_by_site(ts, worst)
    lines = [
        f"## Context (mined from {n:,} cases, synthetic sample)",
        "Process: request → approve → pick → ship → receive",
        f'Bottleneck: "{worst}", median wait {w[worst]:.1f} h, p75 {p75:.1f} h, {over24:.0%} wait > 24 h (target {target_wait_h:.0f} h)',
        "Per site: " + ", ".join(f"{s} {h:.1f} h" for s, h in sites.items()),
        f"Rework: {rework:.0%} of cases loop ship → mismatch → pick",
        f"Rule breaches: {breach:.0%} of cases pick with no approval event",
        f"Process fitness: {rep.fitness:.2f}  (m={rep.m} c={rep.c} r={rep.r} p={rep.p})",
        "",
        "## Constraints (rules from past review notes)",
        "- Never auto-approve a part class that isn't on the allow-list.",
        "- Every automated decision writes an audit event, retries included.",
        "- Check per-site impact before claiming an average.",
        "",
        "## Acceptance tests (generated from the mined variants)",
        f"1. Replay the {var.most_common(1)[0][1]} happy-path cases: all still pass.",
        f'2. p75 wait before "{worst}" ≤ {target_wait_h * 1.4:.0f} h at every site.',
        "3. Every breach case now has an approval event.",
        "4. Re-mined fitness ≥ 0.80.",
    ]
    return "\n".join(lines)


def main() -> None:
    log = read_csv(sys.argv[1]) if len(sys.argv) > 1 else synthetic_log()
    ts = traces(log)
    print(f"{len(log):,} events, {len(ts):,} cases\n")
    print("Directly-follows graph (top 8):")
    for (a, b), k in directly_follows(ts).most_common(8):
        print(f"  {a:>9} → {b:<9} {k:>5}")
    print("\nVariants (top 5):")
    for v, k in variants(ts).most_common(5):
        print(f"  {k:>4}  {' → '.join(v)}")
    print("\nMedian wait before each step (h):")
    for act, h in sorted(waits(ts).items(), key=lambda x: -x[1]):
        print(f"  {act:>9} {h:6.1f}")
    rep = token_replay(ts)
    print(f"\nToken replay: m={rep.m} c={rep.c} r={rep.r} p={rep.p}  fitness={rep.fitness:.3f}")
    for d, k in rep.deviations.most_common(3):
        print(f"  {k:>4}  {d}")
    print("\n" + context_pack(ts, rep))


if __name__ == "__main__":
    main()
