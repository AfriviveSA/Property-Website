import React, { useEffect, useState } from "react";
import { TopNav } from "../components/nav/TopNav";
import { Sidebar } from "../components/nav/Sidebar";
import { api, authHeader } from "../api/client";

type Me = {
  email?: string;
  role?: "USER" | "ADMIN";
  freeUsesRemaining?: number | null;
} | null;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [me, setMe] = useState<Me>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));

  const signedIn = Boolean(token);

  useEffect(() => {
    const t = window.setInterval(() => {
      const next = localStorage.getItem("token");
      setToken((curr) => (curr === next ? curr : next));
    }, 500);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!localStorage.getItem("token")) return;
      try {
        const res = await api.get("/auth/me", { headers: authHeader() });
        if (!cancelled) setMe(res.data);
      } catch {
        if (!cancelled) setMe(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="pg-app">
      <TopNav onMenu={() => setMenuOpen(true)} userEmail={me?.email ?? null} userRole={me?.role ?? null} signedIn={signedIn} />
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} showReports={signedIn} />
      <main className="pg-main">{children}</main>
    </div>
  );
}

