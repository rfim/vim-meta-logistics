// In-browser engines, loaded only when someone presses Run.
// Pyodide: CPython compiled to WebAssembly. PGlite: PostgreSQL compiled to WebAssembly.
// Versions are pinned (both released at least two weeks before this site was built).

export const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";
export const PGLITE_URL = "https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.15/dist/index.js";

export type Table = { fields: string[]; rows: Record<string, unknown>[] };
export type Output =
  | { kind: "text"; text: string }
  | { kind: "table"; table: Table; note?: string }
  | { kind: "error"; text: string };

export interface Engine {
  run(code: string): Promise<Output>;
  reset(): Promise<void>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function startPython(files: Record<string, string>): Promise<Engine> {
  const mod: any = await import(/* @vite-ignore */ PYODIDE_URL + "pyodide.mjs");
  const py: any = await mod.loadPyodide({ indexURL: PYODIDE_URL });
  for (const [name, src] of Object.entries(files)) py.FS.writeFile(name, src);
  await py.runPythonAsync("import sys\nif '.' not in sys.path: sys.path.insert(0, '.')");
  let ns = py.globals.get("dict")();
  return {
    async run(code) {
      let out = "";
      py.setStdout({ batched: (s: string) => { out += s + "\n"; } });
      py.setStderr({ batched: (s: string) => { out += s + "\n"; } });
      try {
        const r = await py.runPythonAsync(code, { globals: ns });
        if (r !== undefined && r !== null && !out) out = String(r);
        return { kind: "text", text: out.trimEnd() || "(ran, no output)" };
      } catch (e: any) {
        const msg = String(e?.message || e).split("\n").filter((l: string) => l.trim()).slice(-3).join("\n");
        return { kind: "error", text: (out ? out + "\n" : "") + msg };
      }
    },
    async reset() { ns.destroy?.(); ns = py.globals.get("dict")(); },
  };
}

export async function startPostgres(): Promise<Engine> {
  const { PGlite }: any = await import(/* @vite-ignore */ PGLITE_URL);
  let db: any = new PGlite();
  await db.waitReady;
  return {
    async run(code) {
      try {
        const results: any[] = await db.exec(code);
        const withRows = [...results].reverse().find((r) => r.fields?.length);
        const n = results.length;
        if (!withRows) return { kind: "text", text: `${n} statement${n === 1 ? "" : "s"} ran.` };
        return { kind: "table", table: { fields: withRows.fields.map((f: any) => f.name), rows: withRows.rows }, note: n > 1 ? `${n} statements ran; showing the last result.` : undefined };
      } catch (e: any) {
        return { kind: "error", text: String(e?.message || e) };
      }
    },
    async reset() { await db.close(); db = new PGlite(); await db.waitReady; },
  };
}
