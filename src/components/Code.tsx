import { useState } from "react";

export type CodeFile = { name: string; path: string; lang: "py" | "sql" | "ts" | "txt"; code: string; note?: string };

const KW: Record<string, string[]> = {
  py: ["def", "return", "for", "in", "if", "else", "elif", "import", "from", "as", "class", "with", "not", "and", "or", "None", "True", "False", "lambda", "continue", "nonlocal", "yield", "while", "field"],
  sql: ["SELECT", "FROM", "WHERE", "JOIN", "LEFT", "ANTI", "ON", "GROUP", "BY", "ORDER", "HAVING", "WITH", "AS", "AND", "OR", "NOT", "IN", "IS", "NULL", "CASE", "WHEN", "THEN", "ELSE", "END", "MERGE", "INTO", "USING", "MATCHED", "UPDATE", "SET", "INSERT", "VALUES", "DELETE", "CREATE", "TABLE", "VIEW", "INDEX", "IF", "EXISTS", "PRIMARY", "KEY", "REFERENCES", "DEFAULT", "CHECK", "UNIQUE", "OVER", "PARTITION", "ROWS", "BETWEEN", "UNBOUNDED", "PRECEDING", "CURRENT", "ROW", "UNION", "ALL", "DISTINCT", "LIMIT", "TRIGGER", "FUNCTION", "RETURNS", "BEGIN", "RAISE", "EXCEPTION", "FOR", "EACH", "EXECUTE", "AFTER", "BEFORE", "REVOKE", "GENERATED", "ALWAYS", "IDENTITY", "CROSS", "FILTER", "DESC", "ASC", "OR REPLACE", "LANGUAGE", "INTERVAL", "CAST", "COALESCE", "SUM", "COUNT", "MAX", "MIN", "AVG", "LEAST", "STDDEV", "ROW_NUMBER", "DELTA", "TO", "PUBLIC"],
  ts: ["import", "export", "from", "const", "let", "function", "return", "if", "else", "for", "of", "in", "type", "new", "true", "false", "null", "undefined", "typeof", "as", "default"],
};

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

/** A tiny, dependency-free highlighter: comments, strings, numbers, keywords. */
function highlight(code: string, lang: CodeFile["lang"]) {
  if (lang === "txt") return esc(code);
  const kw = KW[lang] || [];
  const comment = lang === "py" ? "#[^\\n]*|\"\"\"[\\s\\S]*?\"\"\"" : lang === "sql" ? "--[^\\n]*|\\{#[\\s\\S]*?#\\}" : "\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/";
  const re = new RegExp(`(${comment})|('(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*"|\`[^\`]*\`)|(\\b\\d+(?:\\.\\d+)?\\b)|\\b(${kw.map((k) => k.replace(" ", "\\s+")).join("|")})\\b`, lang === "sql" ? "gi" : "g");
  let out = "", last = 0;
  for (const m of code.matchAll(re)) {
    out += esc(code.slice(last, m.index));
    const cls = m[1] ? "c" : m[2] ? "s" : m[3] ? "n" : "k";
    out += `<span class="${cls}">${esc(m[0])}</span>`;
    last = m.index! + m[0].length;
  }
  return out + esc(code.slice(last));
}

export function CodeTabs({ files, label }: { files: CodeFile[]; label: string }) {
  const [i, setI] = useState(0);
  const [copied, setCopied] = useState(false);
  const f = files[i];
  const copy = async () => { try { await navigator.clipboard.writeText(f.code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } };
  return (
    <div className="code-tabs">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <div className="seg" role="tablist" aria-label={label}>
          {files.map((x, k) => <button key={x.path} role="tab" aria-selected={k === i} onClick={() => setI(k)}>{x.name}</button>)}
        </div>
        <div className="row">
          <button className="btn btn-ghost" style={{ padding: "8px 14px" }} onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button>
          <a className="btn btn-ghost" style={{ padding: "8px 14px" }} href={`https://github.com/rfim/vim-meta-logistics/blob/main/${f.path}`}>GitHub ↗</a>
        </div>
      </div>
      {f.note && <p className="small muted" style={{ marginTop: 0 }}>{f.note}</p>}
      <pre className="code" tabIndex={0} aria-label={`${f.path} source`}><code dangerouslySetInnerHTML={{ __html: highlight(f.code, f.lang) }} /></pre>
      <p className="small muted" style={{ marginTop: 8 }}><code>{f.path}</code> · {f.code.split("\n").length} lines</p>
    </div>
  );
}
