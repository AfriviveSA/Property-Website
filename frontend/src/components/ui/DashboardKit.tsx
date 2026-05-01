import type React from "react";

export function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="pg-page-shell">{children}</div>;
}

export function StatCard({
  title,
  value,
  hint,
  tone = "default",
  onClick,
  ariaLabel
}: {
  title: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "accent" | "success" | "danger" | "warning";
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const clickable = Boolean(onClick);
  return (
    <div
      className={`pg-stat-card pg-stat-${tone}`}
      onClick={onClick}
      role={clickable ? "link" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={ariaLabel}
      style={
        clickable
          ? { cursor: "pointer", border: "1px solid rgba(0, 122, 204, 0.25)" }
          : undefined
      }
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick?.();
            }
          : undefined
      }
    >
      <div className="pg-stat-title">{title}</div>
      <div className="pg-stat-value">{value}</div>
      {hint ? <div className="pg-stat-hint">{hint}</div> : null}
      {clickable ? <div className="pg-stat-hint" style={{ marginTop: 6 }}>View details</div> : null}
    </div>
  );
}

export function MetricCard({
  title,
  value,
  subtitle,
  onClick,
  ariaLabel
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const clickable = Boolean(onClick);
  return (
    <div
      className="pg-metric-card"
      onClick={onClick}
      role={clickable ? "link" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={ariaLabel}
      style={
        clickable
          ? { cursor: "pointer", border: "1px solid rgba(0, 122, 204, 0.25)" }
          : undefined
      }
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick?.();
            }
          : undefined
      }
    >
      <div className="pg-stat-title">{title}</div>
      <div className="pg-metric-value">{value}</div>
      {subtitle ? <div className="pg-stat-hint">{subtitle}</div> : null}
      {clickable ? <div className="pg-stat-hint" style={{ marginTop: 6 }}>View details</div> : null}
    </div>
  );
}

export function DashboardCard({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="pg-dashboard-card">
      <div className="pg-dashboard-card-header">
        <h3>{title}</h3>
        {actions}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function StatusPill({ label, tone = "default" }: { label: string; tone?: "default" | "success" | "warning" | "danger" | "accent" }) {
  return <span className={`pg-status-pill pg-status-${tone}`}>{label}</span>;
}

export function EmptyState({ title, body, actions }: { title: string; body: string; actions?: React.ReactNode }) {
  return (
    <div className="pg-empty-state">
      <h2>{title}</h2>
      <p>{body}</p>
      {actions ? <div className="pg-empty-actions">{actions}</div> : null}
    </div>
  );
}

export function AlertBanner({ tone = "default", title, message, action }: { tone?: "default" | "success" | "warning" | "danger" | "accent"; title: string; message: string; action?: React.ReactNode }) {
  return (
    <div className={`pg-alert-banner pg-status-${tone}`}>
      <div>
        <strong>{title}</strong>
        <div className="pg-muted">{message}</div>
      </div>
      {action}
    </div>
  );
}
