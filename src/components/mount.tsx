import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/meta-tone.css";
import "../styles/site.css";

export function mount(node: ReactNode) {
  createRoot(document.getElementById("root")!).render(<StrictMode>{node}</StrictMode>);
}
