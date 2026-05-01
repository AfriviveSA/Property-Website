import React from "react";

export function Grid({
  children,
  cols,
  className
}: {
  children: React.ReactNode;
  cols: 2 | 3 | 4;
  className?: string;
}) {
  const cls = cols === 2 ? "pg-grid pg-grid-2" : cols === 3 ? "pg-grid pg-grid-3" : "pg-grid pg-grid-4";
  return <div className={`${cls} ${className ?? ""}`.trim()}>{children}</div>;
}

