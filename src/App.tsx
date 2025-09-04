import { Suspense, lazy, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import TopBar from "./components/TopBar";
import SettingsPanel from "./components/SettingsPanel";
const ChartTab = lazy(() => import("./components/ChartTab"));
const PercentileTab = lazy(() => import("./components/PercentileTab"));
import { Targets, GlobalSettings, Resources } from "./lib/prob";
import { useAppStore, usePityAlloc } from "@/store/appStore";
import { useTargetsUrlSync } from "@/hooks/useTargetsUrlSync";

export default function App() {
  const { t } = useTranslation();
  const open = useAppStore((s) => s.open);
  const setOpen = useAppStore((s) => s.setOpen);
  const targets = useAppStore((s) => s.targets);
  const settings = useAppStore((s) => s.settings);
  const resources = useAppStore((s) => s.resources);
  const pityAlloc = usePityAlloc();
  // URL sync for targets + syncDesired
  useTargetsUrlSync();

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
              className="btn btn-ghost btn-sm"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
            >
              {open ? t("collapse") : t("expand")}
            </button>
          </div>
          {open && (
            <div className="mt-3 rounded-2xl bg-white/70 dark:bg-zinc-900/80 shadow p-4">
              <SettingsPanel />
            </div>
          )}
        </div>

        <Tabs />
      </main>
      <footer className="px-4 py-6 border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl text-center text-xs opacity-70 leading-relaxed">
          {t("disclaimer.line1")}
          <br />
          {t("disclaimer.line2")}
        </div>
      </footer>
    </div>
  );
}

function Tabs() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"curve" | "perc">("curve");
  return (
    <div>
      <div className="tabs tabs-border" role="tablist">
        <button
          role="tab"
          onClick={() => setTab("curve")}
          className={tab === "curve" ? "tab tab-active" : "tab"}
        >
          {t("tabs.chart")}
        </button>
        <button
          role="tab"
          onClick={() => setTab("perc")}
          className={tab === "perc" ? "tab tab-active" : "tab"}
        >
          {t("tabs.perc")}
        </button>
      </div>
      <Suspense fallback={<div className="text-sm opacity-70">Loading…</div>}>
        {tab === "curve" ? <ChartTab /> : <PercentileTab />}
      </Suspense>
    </div>
  );
}
