import type { Targets } from "@/lib/prob";
import { useAppStore } from "@/store/appStore";
import { useEffect } from "react";

// Dash-separated encoding to avoid URL encoding of commas
export function encodeTargets(tgt: Targets): string {
  return [tgt.A.pickup, tgt.A.desired, tgt.E.pickup, tgt.E.desired, tgt.T.pickup, tgt.T.desired]
    .map((n) => Math.max(0, Math.floor(Number(n) || 0)))
    .join("-");
}

export function decodeTargets(s: string | null): Targets | null {
  if (!s) return null;
  const parts = s.split("-").map((x) => Math.max(0, Math.floor(Number(x) || 0)));
  if (parts.length !== 6) return null;
  const out: Targets = {
    A: { pickup: parts[0], desired: parts[1] },
    E: { pickup: parts[2], desired: parts[3] },
    T: { pickup: parts[4], desired: parts[5] },
  };
  out.A.desired = Math.min(out.A.desired, out.A.pickup);
  out.E.desired = Math.min(out.E.desired, out.E.pickup);
  out.T.desired = Math.min(out.T.desired, out.T.pickup);
  return out;
}

// Sync only targets + syncDesired to URL (t, sd) and back.
export function useTargetsUrlSync() {
  const targets = useAppStore((s) => s.targets);
  const setTargets = useAppStore((s) => s.setTargets);
  const syncDesired = useAppStore((s) => s.syncDesired);
  const setSyncDesired = useAppStore((s) => s.setSyncDesired);

  // Mount: read URL and apply to store
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const tParam = sp.get("t");
      const parsed = decodeTargets(tParam);
      if (parsed) {
        const cur = encodeTargets(useAppStore.getState().targets);
        const inc = encodeTargets(parsed);
        if (cur !== inc) setTargets(parsed);
      }
      const sd = sp.get("sd");
      if (sd === "1") {
        const st = useAppStore.getState();
        if (!st.syncDesired) {
          setSyncDesired(true);
          const tg = st.targets;
          setTargets({
            A: { ...tg.A, desired: tg.A.pickup },
            E: { ...tg.E, desired: tg.E.pickup },
            T: { ...tg.T, desired: tg.T.pickup },
          });
        }
      }
    } catch {}
  }, [setTargets, setSyncDesired]);

  // Reflect store → URL
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      sp.set("t", encodeTargets(targets));
      sp.set("sd", syncDesired ? "1" : "0");
      const url = `${window.location.pathname}?${sp.toString()}${window.location.hash}`;
      window.history.replaceState({}, "", url);
    } catch {}
  }, [targets, syncDesired]);
}
