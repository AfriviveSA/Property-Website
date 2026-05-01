import { NavLink, useLocation } from "react-router-dom";
import { calculators } from "../../data/calculators";
import { Button } from "../ui/Button";
import { useMemo, useState } from "react";

export function Sidebar({
  open,
  onClose,
  showReports
}: {
  open: boolean;
  onClose: () => void;
  showReports: boolean;
}) {
  const { pathname } = useLocation();
  const [calcOpen, setCalcOpen] = useState(true);

  const activeSlug = useMemo(() => {
    const m = pathname.match(/\/calculators\/([^/]+)/);
    return m?.[1] ?? null;
  }, [pathname]);

  return (
    <>
      <div className="pg-overlay" data-open={open ? "true" : "false"} onClick={onClose} />
      <aside className="pg-sidebar" data-open={open ? "true" : "false"} aria-hidden={!open}>
        <div className="pg-sidebar-header">
          <div className="pg-logo">The Property Guy</div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="pg-sidebar-body">
          <div className="pg-nav-group-title">Navigation</div>

          <div className="pg-disclosure">
            <button className="pg-disclosure-btn" type="button" onClick={() => setCalcOpen((v) => !v)}>
              <span>Property Calculators</span>
              <span className="pg-nav-muted">{calcOpen ? "–" : "+"}</span>
            </button>
            {calcOpen ? (
              <div className="pg-disclosure-panel">
                {calculators.map((c) => (
                  <NavLink
                    key={c.slug}
                    to={`/calculators/${c.slug}`}
                    className="pg-nav-link"
                    data-active={activeSlug === c.slug ? "true" : "false"}
                    onClick={onClose}
                  >
                    <span>{c.name}</span>
                    <span className="pg-nav-muted">→</span>
                  </NavLink>
                ))}
              </div>
            ) : null}
          </div>

          <div className="pg-nav-group-title">Resources</div>
          <NavLink to="/learn" className="pg-nav-link" data-active={pathname === "/learn" ? "true" : "false"} onClick={onClose}>
            Learn <span className="pg-nav-muted">→</span>
          </NavLink>
          <NavLink to="/about" className="pg-nav-link" data-active={pathname === "/about" ? "true" : "false"} onClick={onClose}>
            About <span className="pg-nav-muted">→</span>
          </NavLink>
          <NavLink to="/contact" className="pg-nav-link" data-active={pathname === "/contact" ? "true" : "false"} onClick={onClose}>
            Contact <span className="pg-nav-muted">→</span>
          </NavLink>

          {showReports ? (
            <>
              <div className="pg-nav-group-title">Reports</div>
              <NavLink
                to="/dashboard"
                className="pg-nav-link"
                data-active={pathname === "/dashboard" ? "true" : "false"}
                onClick={onClose}
              >
                My Reports <span className="pg-nav-muted">→</span>
              </NavLink>
              <div className="pg-nav-group-title">Owned Properties</div>
              <NavLink to="/owned-properties/my-properties" className="pg-nav-link" data-active={pathname.startsWith("/owned-properties/my-properties") ? "true" : "false"} onClick={onClose}>
                My Properties <span className="pg-nav-muted">→</span>
              </NavLink>
              <NavLink to="/owned-properties/dashboard" className="pg-nav-link" data-active={pathname.startsWith("/owned-properties/dashboard") ? "true" : "false"} onClick={onClose}>
                Portfolio Dashboard <span className="pg-nav-muted">→</span>
              </NavLink>
              <NavLink to="/owned-properties/new" className="pg-nav-link" data-active={pathname === "/owned-properties/new" ? "true" : "false"} onClick={onClose}>
                Add Property <span className="pg-nav-muted">→</span>
              </NavLink>
              <NavLink to="/tenants" className="pg-nav-link" data-active={pathname.startsWith("/tenants") ? "true" : "false"} onClick={onClose}>
                Tenants <span className="pg-nav-muted">→</span>
              </NavLink>
              <NavLink to="/leases" className="pg-nav-link" data-active={pathname.startsWith("/leases") ? "true" : "false"} onClick={onClose}>
                Leases <span className="pg-nav-muted">→</span>
              </NavLink>
              <NavLink to="/financials" className="pg-nav-link" data-active={pathname.startsWith("/financials") ? "true" : "false"} onClick={onClose}>
                Financials <span className="pg-nav-muted">→</span>
              </NavLink>
              <NavLink to="/invoices" className="pg-nav-link" data-active={pathname.startsWith("/invoices") ? "true" : "false"} onClick={onClose}>
                Invoices <span className="pg-nav-muted">→</span>
              </NavLink>
              <NavLink to="/documents" className="pg-nav-link" data-active={pathname.startsWith("/documents") ? "true" : "false"} onClick={onClose}>
                Documents <span className="pg-nav-muted">→</span>
              </NavLink>
              <NavLink to="/owned-properties/reports" className="pg-nav-link" data-active={pathname.includes("/owned-properties/reports") ? "true" : "false"} onClick={onClose}>
                Reports <span className="pg-nav-muted">→</span>
              </NavLink>
              <div className="pg-nav-group-title">Account</div>
              <NavLink to="/account" className="pg-nav-link" data-active={pathname === "/account" ? "true" : "false"} onClick={onClose}>
                Account <span className="pg-nav-muted">→</span>
              </NavLink>
            </>
          ) : null}
        </div>
      </aside>
    </>
  );
}

