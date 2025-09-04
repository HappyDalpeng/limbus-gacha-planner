import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GlobalSettings, Resources, Targets } from "@/lib/prob";
import { autoMaxDraws, computeGreedyPityAlloc } from "@/lib/prob";

type AppState = {
  // UI
  open: boolean;
  setOpen: (v: boolean | ((prev: boolean) => boolean)) => void;

  // Core domain state
  targets: Targets;
  setTargets: (next: Targets) => void;

  settings: GlobalSettings;
  setSettings: (next: GlobalSettings) => void;

  resources: Resources;
  setResources: (next: Resources) => void;
};

const defaults = {
  targets: {
    // Defaults for first-time visitors (desired/pickup): A 1/1, E 2/2, T 2/5
    A: { pickup: 1, desired: 1 },
    E: { pickup: 2, desired: 2 },
    T: { pickup: 5, desired: 2 },
  } satisfies Targets,
  settings: {
    autoRecommend: true,
    ownAllExistingPoolEgo: false,
    exchangePriority: ["E", "T", "A"],
    exchangePlan: undefined,
  } satisfies GlobalSettings,
  resources: {
    // Defaults for first-time visitors: lunacy 20000, 1-pull 26, 10-pull 4
    lunacy: 20000,
    ticket1: 26,
    ticket10: 4,
  } satisfies Resources,
};

function sanitizeTargets(raw: any): Targets {
  const co = (x: any, d: { pickup: number; desired: number }) => ({
    pickup: Math.max(0, Number.isFinite(Number(x?.pickup)) ? Number(x.pickup) : d.pickup),
    desired: Math.max(0, Number.isFinite(Number(x?.desired)) ? Number(x.desired) : d.desired),
  });
  const A = co(raw?.A, defaults.targets.A);
  const E = co(raw?.E, defaults.targets.E);
  const T = co(raw?.T, defaults.targets.T);
  A.desired = Math.min(A.desired, A.pickup);
  E.desired = Math.min(E.desired, E.pickup);
  T.desired = Math.min(T.desired, T.pickup);
  return { A, E, T };
}

function sanitizeSettings(raw: any): GlobalSettings {
  const defPrio: ("A" | "E" | "T")[] = ["E", "T", "A"];
  const pr = Array.isArray(raw?.exchangePriority) ? (raw.exchangePriority as any[]) : defPrio;
  const filtered = pr.filter((x) => x === "A" || x === "E" || x === "T");
  const uniq: ("A" | "E" | "T")[] = [];
  for (const x of filtered) if (!uniq.includes(x)) uniq.push(x as any);
  (["A", "E", "T"] as const).forEach((k) => {
    if (!uniq.includes(k)) uniq.push(k);
  });
  const plan = Array.isArray(raw?.exchangePlan)
    ? (raw.exchangePlan as any[]).filter((x) => x === "A" || x === "E" || x === "T")
    : undefined;
  return {
    autoRecommend: Boolean(raw?.autoRecommend ?? defaults.settings.autoRecommend),
    ownAllExistingPoolEgo: Boolean(
      raw?.ownAllExistingPoolEgo ?? defaults.settings.ownAllExistingPoolEgo,
    ),
    exchangePriority: uniq,
    exchangePlan: plan as ("A" | "E" | "T")[] | undefined,
  };
}

function sanitizeResources(raw: any): Resources {
  return {
    lunacy: Math.max(
      0,
      Number.isFinite(Number(raw?.lunacy)) ? Number(raw.lunacy) : defaults.resources.lunacy,
    ),
    ticket1: Math.max(
      0,
      Number.isFinite(Number(raw?.ticket1)) ? Number(raw.ticket1) : defaults.resources.ticket1,
    ),
    ticket10: Math.max(
      0,
      Number.isFinite(Number(raw?.ticket10)) ? Number(raw.ticket10) : defaults.resources.ticket10,
    ),
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      open: true,
      setOpen: (v) =>
        set((s) => ({
          open: typeof v === "function" ? (v as (b: boolean) => boolean)(s.open) : v,
        })),

      targets: defaults.targets,
      setTargets: (next) => set({ targets: sanitizeTargets(next) }),

      settings: defaults.settings,
      setSettings: (next) => set({ settings: sanitizeSettings(next) }),

      resources: defaults.resources,
      setResources: (next) => set({ resources: sanitizeResources(next) }),
    }),
    {
      name: "gpp.app.v1",
      version: 1,
      partialize: (state) => ({
        open: state.open,
        targets: state.targets,
        settings: state.settings,
        resources: state.resources,
      }),
      merge: (persisted, current) => {
        const raw = persisted as Partial<AppState> | undefined;
        if (!raw) return current;
        return {
          ...current,
          open: typeof raw.open === "boolean" ? raw.open : current.open,
          targets: raw.targets ? sanitizeTargets(raw.targets) : current.targets,
          settings: raw.settings ? sanitizeSettings(raw.settings) : current.settings,
          resources: raw.resources ? sanitizeResources(raw.resources) : current.resources,
        } as AppState;
      },
    },
  ),
);

// Derived selector: compute pity allocation from current settings/targets
export function usePityAlloc() {
  const settings = useAppStore((s) => s.settings);
  const targets = useAppStore((s) => s.targets);
  const max = autoMaxDraws(targets);
  const R = Math.floor(max / 200);
  const prefix = (settings.exchangePlan || []).slice(0, R);
  return computeGreedyPityAlloc(max, settings, targets, prefix);
}
