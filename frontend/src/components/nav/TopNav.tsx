import { Link, useNavigate } from "react-router-dom";
import { Container } from "../ui/Container";
import { ButtonLink } from "../ui/Button";
import { HamburgerButton } from "./HamburgerButton";
import { useEffect, useRef, useState } from "react";
import { calculators } from "../../data/calculators";

export function TopNav({
  onMenu,
  userEmail,
  userRole,
  signedIn
}: {
  onMenu: () => void;
  userEmail?: string | null;
  userRole?: "USER" | "ADMIN" | null;
  signedIn: boolean;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : null;
  const isAdmin = userRole === "ADMIN";
  const [calcOpen, setCalcOpen] = useState(false);
  const [ownedOpen, setOwnedOpen] = useState(false);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    if (open) window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const logout = () => {
    localStorage.removeItem("token");
    setOpen(false);
    navigate("/");
    window.location.reload();
  };

  return (
    <div className="pg-topbar">
      <Container>
        <div className="pg-topbar-inner">
          <div className="pg-brand">
            <HamburgerButton onClick={onMenu} />
            <div>
              <Link to="/" className="pg-logo">
                The Property Guy
              </Link>
              <div className="pg-logo-tagline">Property calculators & portfolio tools</div>
            </div>
          </div>
          <nav className="pg-main-nav">
            <div className="pg-main-nav-item" onMouseEnter={() => setCalcOpen(true)} onMouseLeave={() => setCalcOpen(false)}>
              <button type="button" className="pg-main-nav-btn">
                Property Calculators
              </button>
              {calcOpen ? (
                <div className="pg-main-nav-menu">
                  {calculators.slice(0, 10).map((c) => (
                    <Link key={c.slug} to={`/calculators/${c.slug}`} className="pg-profile-item" onClick={() => setCalcOpen(false)}>
                      {c.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
            {signedIn ? (
              <div className="pg-main-nav-item" onMouseEnter={() => setOwnedOpen(true)} onMouseLeave={() => setOwnedOpen(false)}>
                <button type="button" className="pg-main-nav-btn">
                  Owned Properties
                </button>
                {ownedOpen ? (
                  <div className="pg-main-nav-menu">
                    <Link to="/owned-properties/my-properties" className="pg-profile-item" onClick={() => setOwnedOpen(false)}>My Properties</Link>
                    <Link to="/owned-properties/dashboard" className="pg-profile-item" onClick={() => setOwnedOpen(false)}>Portfolio Dashboard</Link>
                    <Link to="/owned-properties/new" className="pg-profile-item" onClick={() => setOwnedOpen(false)}>Add Property</Link>
                    <Link to="/tenants" className="pg-profile-item" onClick={() => setOwnedOpen(false)}>Tenants</Link>
                    <Link to="/leases" className="pg-profile-item" onClick={() => setOwnedOpen(false)}>Leases</Link>
                    <Link to="/financials" className="pg-profile-item" onClick={() => setOwnedOpen(false)}>Financials</Link>
                    <Link to="/invoices" className="pg-profile-item" onClick={() => setOwnedOpen(false)}>Invoices</Link>
                    <Link to="/owned-properties/recurring-invoices" className="pg-profile-item" onClick={() => setOwnedOpen(false)}>Recurring Invoices</Link>
                    <Link to="/documents" className="pg-profile-item" onClick={() => setOwnedOpen(false)}>Documents</Link>
                    <Link to="/owned-properties/reports" className="pg-profile-item" onClick={() => setOwnedOpen(false)}>Reports</Link>
                  </div>
                ) : null}
              </div>
            ) : null}
            <Link to="/learn" className="pg-main-nav-link">Learn</Link>
            <Link to="/about" className="pg-main-nav-link">About</Link>
            <Link to="/contact" className="pg-main-nav-link">Contact</Link>
          </nav>
          <div className="pg-top-actions">
            {signedIn ? (
              <div className="pg-profile" ref={menuRef}>
                <button type="button" className="pg-avatar" aria-label="Open profile menu" onClick={() => setOpen((v) => !v)}>
                  {initials}
                </button>
                {open ? (
                  <div className="pg-profile-menu">
                    <div className="pg-profile-label">{isAdmin ? "Admin" : "User"}</div>
                    <Link to="/owned-properties/dashboard" className="pg-profile-item" onClick={() => setOpen(false)}>Portfolio Dashboard</Link>
                    <Link to="/owned-properties/my-properties" className="pg-profile-item" onClick={() => setOpen(false)}>My Properties</Link>
                    <Link to="/dashboard" className="pg-profile-item" onClick={() => setOpen(false)}>
                      My Reports
                    </Link>
                    <Link to="/owned-properties/new" className="pg-profile-item" onClick={() => setOpen(false)}>Add Property</Link>
                    {isAdmin ? (
                      <Link to="/admin" className="pg-profile-item" onClick={() => setOpen(false)}>
                        Admin
                      </Link>
                    ) : (
                      <Link to="/account" className="pg-profile-item" onClick={() => setOpen(false)}>
                        Account
                      </Link>
                    )}
                    {!isAdmin ? (
                      <Link to="/subscription" className="pg-profile-item" onClick={() => setOpen(false)}>
                        Subscription
                      </Link>
                    ) : null}
                    <button type="button" className="pg-profile-item pg-profile-item-button" onClick={logout}>
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <ButtonLink href="/login" variant="secondary">
                  Sign In
                </ButtonLink>
                <ButtonLink href="/login" variant="ghost">
                  Register
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}

