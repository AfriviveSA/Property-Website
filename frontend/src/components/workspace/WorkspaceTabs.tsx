import { Link } from "react-router-dom";

export function WorkspaceTabs({
  basePath,
  active,
  tabs
}: {
  basePath: string;
  active: string;
  tabs: Array<{ key: string; label: string }>;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      {tabs.map((t) => (
        <Link key={t.key} to={`${basePath}?tab=${t.key}`} className={`pg-btn ${active === t.key ? "pg-btn-primary" : "pg-btn-ghost"}`}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}

