import { useEffect, useId, useRef } from "react";
import { createPetri, type PetriApi, type PetriSpec, type SimConfig } from "../lib/petri";

type Props = {
  spec: PetriSpec;
  config: SimConfig;
  hot?: string[];
  fixed?: { ids: string[]; reveal: string[] } | null;
  onReady?: (api: PetriApi) => void;
};

/** React wrapper: the SVG engine owns the drawing; React owns state (config, hot steps, fix). */
export function PetriNet({ spec, config, hot = [], fixed = null, onReady }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<PetriApi | null>(null);
  const id = "pn" + useId().replace(/[^a-z0-9]/gi, "");

  useEffect(() => {
    const a = createPetri(host.current!, spec);
    api.current = a;
    a.configure(config);
    a.setHot(hot);
    a.start();
    onReady?.(a);
    return () => a.destroy();
    // spec is static per page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  useEffect(() => { api.current?.configure(config); }, [config]);
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    if (fixed) a.setFixed(fixed.ids, fixed.reveal);
    else { a.reset(); a.setHot(hot); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixed]);

  return <div id={id} ref={host} />;
}
