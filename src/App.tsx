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
  autoMaxDraws,
  Resources,
} from "./lib/prob";

export default function App() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  const [targets, setTargets] = useState<Targets>({
    A: { pickup: 1, desired: 0 },
    E: { pickup: 2, desired: 1 },
    T: { pickup: 3, desired: 1 },
  });

  const [settings, setSettings] = useState<GlobalSettings>({
    autoRecommend: true,
    ownAllExistingPoolEgo: false,
  });

  const [resources, setResources] = useState({
    lunacy: 0,
    ticket1: 0,
    ticket10: 0,
  });

  const pityAlloc = useMemo(() => {
    const max = autoMaxDraws(targets);
    return computeGreedyPityAlloc(max, settings, targets);
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
