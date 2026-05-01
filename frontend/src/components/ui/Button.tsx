import React from "react";

type Variant = "primary" | "secondary" | "ghost";

export function Button({
  children,
  variant = "primary",
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  const cls =
    variant === "primary"
      ? "pg-btn pg-btn-primary"
      : variant === "secondary"
        ? "pg-btn pg-btn-secondary"
        : "pg-btn pg-btn-ghost";
  return (
    <button className={cls} {...props} disabled={props.disabled || loading}>
      {loading ? <span className="pg-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  variant = "primary",
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant }) {
  const cls =
    variant === "primary"
      ? "pg-btn pg-btn-primary"
      : variant === "secondary"
        ? "pg-btn pg-btn-secondary"
        : "pg-btn pg-btn-ghost";
  return (
    <a className={cls} {...props}>
      {children}
    </a>
  );
}

