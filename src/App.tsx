import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import TopBar from "./components/TopBar";
import SettingsPanel from "./components/SettingsPanel";
const ChartTab = lazy(() => import("./components/ChartTab"));
const PercentileTab = lazy(() => import("./components/PercentileTab"));
import {
  Targets,
  GlobalSettings,
  computeGreedyPityAlloc,
  computePriorityPityAlloc,
  autoMaxDraws,
  Resources,
} from "./lib/prob";

export default function App() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  // LocalStorage keys
  const LS_KEYS = {
    targets: "gpp.targets.v1",
    settings: "gpp.settings.v1",
    resources: "gpp.resources.v1",
  } as const;

  // Safe JSON parse
  const parseJSON = <T,>(s: string | null): T | null => {
    if (!s) return null;
    try {
      return JSON.parse(s) as T;
    } catch {
      return null;
    }
  };

  const sanitizeTargets = (raw: any): Targets => {
    const def: Targets = {
      A: { pickup: 1, desired: 0 },
      E: { pickup: 2, desired: 1 },
      T: { pickup: 3, desired: 1 },
    };
    const co = (x: any) => ({
      pickup: Math.max(0, Number.isFinite(Number(x?.pickup)) ? Number(x.pickup) : 0),
      desired: Math.max(0, Number.isFinite(Number(x?.desired)) ? Number(x.desired) : 0),
    });
    const A = co(raw?.A);
    const E = co(raw?.E);
    const T = co(raw?.T);
    // Clamp desired <= pickup
    A.desired = Math.min(A.desired, A.pickup);
    E.desired = Math.min(E.desired, E.pickup);
    T.desired = Math.min(T.desired, T.pickup);
    return { A, E, T };
  };

  const sanitizeSettings = (raw: any): GlobalSettings => {
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
      autoRecommend: Boolean(raw?.autoRecommend ?? true),
      ownAllExistingPoolEgo: Boolean(raw?.ownAllExistingPoolEgo ?? false),
      exchangePriority: uniq,
      exchangePlan: plan as ("A" | "E" | "T")[] | undefined,
    };
  };

  const sanitizeResources = (raw: any): Resources => ({
    lunacy: Math.max(0, Number.isFinite(Number(raw?.lunacy)) ? Number(raw.lunacy) : 0),
    ticket1: Math.max(0, Number.isFinite(Number(raw?.ticket1)) ? Number(raw.ticket1) : 0),
    ticket10: Math.max(0, Number.isFinite(Number(raw?.ticket10)) ? Number(raw.ticket10) : 0),
  });

  // Lazy init from localStorage
  const [targets, setTargets] = useState<Targets>(() => {
    const stored = parseJSON<Targets>(localStorage.getItem(LS_KEYS.targets));
    return stored ? sanitizeTargets(stored) : sanitizeTargets(null);
  });

  const [settings, setSettings] = useState<GlobalSettings>(() => {
    const stored = parseJSON<GlobalSettings>(localStorage.getItem(LS_KEYS.settings));
    return stored ? sanitizeSettings(stored) : sanitizeSettings(null);
  });

  const [resources, setResources] = useState<Resources>(() => {
    const stored = parseJSON<Resources>(localStorage.getItem(LS_KEYS.resources));
    return stored ? sanitizeResources(stored) : sanitizeResources(null);
  });

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem(LS_KEYS.targets, JSON.stringify(targets));
  }, [targets]);
  useEffect(() => {
    localStorage.setItem(LS_KEYS.settings, JSON.stringify(settings));
  }, [settings]);
  useEffect(() => {
    localStorage.setItem(LS_KEYS.resources, JSON.stringify(resources));
  }, [resources]);

  const pityAlloc = useMemo(() => {
    const max = autoMaxDraws(targets);
    const R = Math.floor(max / 200);
    const prefix = (settings.exchangePlan || []).slice(0, R);
    return computeGreedyPityAlloc(max, settings, targets, prefix);
  }, [settings, targets]);

  useEffect(() => {
    document.title = t("title");
  }, [t]);

  return (
    <div className="min-h-screen text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-950">
      <TopBar />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("settings")}</h2>
            <button
              className="text-sm underline hover:no-underline"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
            >
              {open ? t("collapse") : t("expand")}
            </button>
          </div>
          {open && (
            <div className="mt-3 rounded-2xl bg-white/70 dark:bg-zinc-900/80 shadow p-4">
              <SettingsPanel
                settings={settings}
                setSettings={setSettings}
                targets={targets}
                setTargets={setTargets}
                resources={resources}
                setResources={setResources}
                pityAlloc={pityAlloc}
              />
            </div>
          )}
        </div>

        <Tabs targets={targets} settings={settings} resources={resources} pityAlloc={pityAlloc} />
      </main>
    </div>
  );
}

function Tabs({
  targets,
  settings,
  resources,
  pityAlloc,
}: {
  targets: Targets;
  settings: GlobalSettings;
  resources: Resources;
  pityAlloc: ("A" | "E" | "T")[];
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"curve" | "perc">("curve");
  return (
    <div>
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setTab("curve")}
          className={
            "px-3 py-2 rounded-xl text-sm " +
            (tab === "curve"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-white/70 dark:bg-zinc-900/80")
          }
        >
          {t("tabs.chart")}
        </button>
        <button
          onClick={() => setTab("perc")}
          className={
            "px-3 py-2 rounded-xl text-sm " +
            (tab === "perc"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-white/70 dark:bg-zinc-900/80")
          }
        >
          {t("tabs.perc")}
        </button>
      </div>
      <Suspense fallback={<div className="text-sm opacity-70">Loading…</div>}>
        {tab === "curve" ? (
          <ChartTab
            targets={targets}
            settings={settings}
            resources={resources}
            pityAlloc={pityAlloc}
          />
        ) : (
          <PercentileTab
            targets={targets}
            settings={settings}
            resources={resources}
            pityAlloc={pityAlloc}
          />
        )}
      </Suspense>
    </div>
  );
}
