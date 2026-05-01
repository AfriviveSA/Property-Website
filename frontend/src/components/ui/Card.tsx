import React from "react";

export function Card({
  title,
  children,
  pad = true,
  className
}: {
  title?: string;
  children: React.ReactNode;
  pad?: boolean;
  className?: string;
}) {
  return (
    <div className={`pg-card ${className ?? ""}`.trim()}>
      <div className={pad ? "pg-card-pad" : ""}>
        {title ? <div className="pg-card-title">{title}</div> : null}
        {children}
      </div>
    </div>
  );
}

