import React from "react";

export function Field({
  label,
  help,
  children
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pg-field">
      <div>
        <div className="pg-label">{label}</div>
        {help ? <div className="pg-help">{help}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="pg-input" {...props} />;
}

