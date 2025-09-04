import { useTranslation } from "react-i18next";

export default function TopBar() {
  const { t, i18n } = useTranslation();

  const setLang = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("lang", lng);
  };

  const toggleDark = () => {
    const html = document.documentElement;
    const next = !html.classList.contains("dark");
    html.classList.toggle("dark", next);
    html.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 backdrop-blur bg-white/70 dark:bg-zinc-950/70">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <div className="text-xl font-bold tracking-tight">📑 {t("title")}</div>
        <div className="flex items-center gap-2">
          <select
            aria-label={t("language") as string}
            defaultValue={i18n.language}
            onChange={(e) => setLang(e.target.value)}
            className="select select-sm select-bordered"
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
          <button
            onClick={toggleDark}
            aria-label={t("darkMode") as string}
            className="btn btn-sm"
          >
            {t("darkMode")}
          </button>
        </div>
      </div>
    </header>
  );
}
