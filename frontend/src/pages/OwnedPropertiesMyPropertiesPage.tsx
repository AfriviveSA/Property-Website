import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Grid } from "../components/ui/Grid";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { getProperties } from "../api/ownedProperties";
import { StatusPill } from "../components/ui/DashboardKit";

function displayType(t: string | null | undefined) {
  const map: Record<string, string> = {
    LONG_TERM_RENTAL: "Long-Term Rental",
    SHORT_TERM_RENTAL: "Airbnb / Short-Term Rental",
    PRIMARY_RESIDENCE: "Primary Residence",
    HOUSE_HACK: "House Hack",
    BRRRR: "BRRRR Property",
    FLIP: "Flip / Renovation Project",
    VACANT_LAND: "Vacant Land",
    COMMERCIAL: "Commercial Property",
    MIXED_USE: "Mixed Use",
    OTHER: "Other"
  };
  return (t && map[t]) || t || "Other";
}

export function OwnedPropertiesMyPropertiesPage() {
  const { search } = useLocation();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("ALL");
  const [status, setStatus] = useState<string>(new URLSearchParams(search).get("filter") ?? "ALL");
  const [sort, setSort] = useState<string>(new URLSearchParams(search).get("sort") ?? "RECENT");
  const [view, setView] = useState<"cards" | "list">((new URLSearchParams(search).get("view") as any) ?? "cards");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await getProperties());
    } catch (e: any) {
      console.error("[MyProperties] Load failed", e);
      setError(e?.response?.data?.message ?? "Failed to load properties.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let next = [...rows];
    if (needle) {
      next = next.filter((p) => `${p.name ?? ""} ${p.addressLine1 ?? ""} ${p.city ?? ""}`.toLowerCase().includes(needle));
    }
    if (type !== "ALL") next = next.filter((p) => (p.investmentType ?? p.propertyType) === type);
    if (status !== "ALL") {
      next = next.filter((p) => {
        if (status === "OCCUPIED") return p.occupancyStatus === "OCCUPIED";
        if (status === "VACANT") return p.occupancyStatus === "VACANT" && (p.investmentType ?? p.propertyType) !== "VACANT_LAND";
        if (status === "LAND") return (p.investmentType ?? p.propertyType) === "VACANT_LAND";
        if (status === "STR") return (p.investmentType ?? p.propertyType) === "SHORT_TERM_RENTAL";
        if (status === "RENOVATION") return (p.investmentType ?? p.propertyType) === "FLIP" || (p.investmentType ?? p.propertyType) === "BRRRR";
        return true;
      });
    }

    const asNum = (v: any) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
    const equity = (p: any) => {
      const v = asNum(p.currentEstimatedValue);
      const b = asNum(p.outstandingBondBalance);
      return v != null && b != null ? v - b : null;
    };

    const cashFlow = (p: any) => asNum(p.monthlyCashFlowAfterDebtService ?? p.netCashFlow) ?? 0;
    const noi = (p: any) => asNum(p.monthlyNOI) ?? (asNum(p.monthlyIncome) ?? 0) - (asNum(p.monthlyOperatingExpenses) ?? 0);
    const leaseEnd = (p: any) => (p.currentLease?.fixedTermEndDate ? new Date(p.currentLease.fixedTermEndDate).getTime() : Infinity);

    if (sort === "HIGHEST_NOI") next.sort((a, b) => noi(b) - noi(a));
    if (sort === "HIGHEST_EQUITY") next.sort((a, b) => (equity(b) ?? -Infinity) - (equity(a) ?? -Infinity));
    if (sort === "HIGHEST_CASH") next.sort((a, b) => cashFlow(b) - cashFlow(a));
    if (sort === "LOWEST_CASH") next.sort((a, b) => cashFlow(a) - cashFlow(b));
    if (sort === "URGENT_EXPIRIES") next.sort((a, b) => leaseEnd(a) - leaseEnd(b));
    if (sort === "OVERDUE_RENT") next.sort((a, b) => Number(Boolean(b.rentOverdue)) - Number(Boolean(a.rentOverdue)));
    if (sort === "RECENT") next.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    return next;
  }, [rows, q, type, status, sort]);

  return (
    <Section>
      <Helmet><title>My Properties | The Property Guy</title></Helmet>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 className="pg-h2" style={{ margin: 0 }}>My Properties</h1>
            <div className="pg-muted" style={{ marginTop: 6 }}>View and manage every property in your portfolio.</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={load} loading={loading}>Refresh</Button>
            <Link className="pg-btn pg-btn-primary" to="/owned-properties/new">Add Property</Link>
          </div>
        </div>

        {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}

        <div style={{ height: 12 }} />
        <Card title="Filters">
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
            <input className="pg-input" placeholder="Search name/address..." value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="pg-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="ALL">All types</option>
              {["LONG_TERM_RENTAL", "SHORT_TERM_RENTAL", "PRIMARY_RESIDENCE", "HOUSE_HACK", "BRRRR", "FLIP", "VACANT_LAND", "COMMERCIAL", "MIXED_USE", "OTHER"].map((t) => (
                <option key={t} value={t}>{displayType(t)}</option>
              ))}
            </select>
            <select className="pg-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="VACANT">Vacant</option>
              <option value="LAND">Land / No Tenant Required</option>
              <option value="STR">Short-Term Rental</option>
              <option value="RENOVATION">Under Renovation / Project</option>
            </select>
            <select className="pg-input" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="RECENT">Recently added</option>
              <option value="HIGHEST_NOI">Highest NOI</option>
              <option value="HIGHEST_EQUITY">Highest equity</option>
              <option value="HIGHEST_CASH">Highest cash flow</option>
              <option value="LOWEST_CASH">Lowest cash flow</option>
              <option value="URGENT_EXPIRIES">Most urgent expiries</option>
              <option value="OVERDUE_RENT">Overdue rent</option>
            </select>
            <select className="pg-input" value={view} onChange={(e) => setView(e.target.value as any)}>
              <option value="cards">Card view</option>
              <option value="list">List view</option>
            </select>
          </div>
        </Card>

        <div style={{ height: 12 }} />
        {view === "list" ? (
          <Card title="Properties">
            {filtered.length === 0 ? (
              <div className="pg-muted">No properties match your filters.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {filtered.map((p) => {
                  const typeKey = p.investmentType ?? p.propertyType;
                  const isLand = typeKey === "VACANT_LAND";
                  const isStr = typeKey === "SHORT_TERM_RENTAL";
                  const statusLabel = isLand ? "Land / no tenant required" : isStr ? "Short-term rental" : p.occupancyStatus === "OCCUPIED" ? "Occupied" : "Vacant";
                  const tone = isLand ? "accent" : isStr ? "accent" : p.occupancyStatus === "OCCUPIED" ? "success" : "warning";
                  const v = p.currentEstimatedValue;
                  const b = p.outstandingBondBalance;
                  const equity = v != null && b != null ? Number(v) - Number(b) : null;
                  const cash = Number(p.monthlyCashFlowAfterDebtService ?? p.netCashFlow ?? 0);
                  const noi = Number(p.monthlyNOI ?? 0);
                  return (
                    <div key={p.id} style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
                        <div style={{ minWidth: 260 }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                            <strong>{p.name}</strong>
                            <StatusPill label={statusLabel} tone={tone as any} />
                          </div>
                          <div className="pg-muted">{p.addressLine1}, {p.city}</div>
                          <div className="pg-muted" style={{ marginTop: 6 }}>{displayType(typeKey)}</div>
                        </div>
                        <div style={{ display: "grid", gap: 4, minWidth: 280 }}>
                          <div>Value: {v == null ? <span className="pg-muted">Missing</span> : `R ${Number(v).toLocaleString()}`}</div>
                          <div>Bond: {b == null ? <span className="pg-muted">Missing</span> : `R ${Number(b).toLocaleString()}`}</div>
                          <div>Equity: {equity == null ? <span className="pg-muted">Missing</span> : `R ${equity.toLocaleString()}`}</div>
                        </div>
                        <div style={{ display: "grid", gap: 4, minWidth: 280 }}>
                          <div>Monthly income: R {Number(p.monthlyIncome ?? 0).toLocaleString()}</div>
                          <div>Operating expenses: R {Number(p.monthlyOperatingExpenses ?? 0).toLocaleString()}</div>
                          <div>Monthly NOI: <strong style={{ color: noi >= 0 ? "#20C997" : "#FF4D4F" }}>R {noi.toLocaleString()}</strong></div>
                          <div>Monthly cash flow: <strong style={{ color: cash >= 0 ? "#20C997" : "#FF4D4F" }}>R {cash.toLocaleString()}</strong></div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Link className="pg-btn pg-btn-ghost" to={`/owned-properties/${p.id}`}>View</Link>
                          <Link className="pg-btn pg-btn-ghost" to={`/owned-properties/${p.id}?tab=financials`}>Financials</Link>
                          <Link className="pg-btn pg-btn-ghost" to={`/owned-properties/${p.id}?tab=leases`}>Leases</Link>
                          <Link className="pg-btn pg-btn-ghost" to={`/owned-properties/${p.id}?tab=documents`}>Documents</Link>
                        </div>
                      </div>
                      {(p.rentOverdue || p.leaseExpiringSoon || p.leaseMonthToMonth) ? (
                        <div className="pg-muted" style={{ marginTop: 8 }}>
                          Attention: {p.rentOverdue ? "overdue rent" : null}
                          {p.rentOverdue && (p.leaseExpiringSoon || p.leaseMonthToMonth) ? " · " : null}
                          {p.leaseExpiringSoon ? "lease expiring soon" : null}
                          {p.leaseExpiringSoon && p.leaseMonthToMonth ? " · " : null}
                          {p.leaseMonthToMonth ? "month-to-month lease" : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ) : (
          <Grid cols={3}>
            {filtered.map((p) => {
              const typeKey = p.investmentType ?? p.propertyType;
              const isLand = typeKey === "VACANT_LAND";
              const isStr = typeKey === "SHORT_TERM_RENTAL";
              const statusLabel = isLand ? "Land / no tenant required" : isStr ? "Short-term rental" : p.occupancyStatus === "OCCUPIED" ? "Occupied" : "Vacant";
              const tone = isLand ? "accent" : isStr ? "accent" : p.occupancyStatus === "OCCUPIED" ? "success" : "warning";
              const v = p.currentEstimatedValue;
              const b = p.outstandingBondBalance;
              const equity = v != null && b != null ? Number(v) - Number(b) : null;
              const cash = Number(p.monthlyCashFlowAfterDebtService ?? p.netCashFlow ?? 0);
              const noi = Number(p.monthlyNOI ?? 0);
              return (
                <div key={p.id} className="pg-property-card" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <h3 style={{ margin: 0 }}>{p.name}</h3>
                      <div className="pg-muted">{p.addressLine1}, {p.city}</div>
                      <div className="pg-muted" style={{ marginTop: 6 }}>{displayType(typeKey)}</div>
                    </div>
                    <StatusPill label={statusLabel} tone={tone as any} />
                  </div>
                  <div className="pg-property-metrics" style={{ marginTop: 10 }}>
                    <div>Market value: {v == null ? <span className="pg-muted">Missing</span> : `R ${Number(v).toLocaleString()}`}</div>
                    <div>Bond: {b == null ? <span className="pg-muted">Missing</span> : `R ${Number(b).toLocaleString()}`}</div>
                    <div>Equity: {equity == null ? <span className="pg-muted">Missing</span> : `R ${equity.toLocaleString()}`}</div>
                    <div>Monthly NOI: <strong style={{ color: noi >= 0 ? "#20C997" : "#FF4D4F" }}>R {noi.toLocaleString()}</strong></div>
                    <div>Monthly cash flow: <strong style={{ color: cash >= 0 ? "#20C997" : "#FF4D4F" }}>R {cash.toLocaleString()}</strong></div>
                    <div>Tenant: {p.currentTenant?.firstName ? `${p.currentTenant.firstName} ${p.currentTenant.lastName}` : isLand || isStr ? <span className="pg-muted">Not required</span> : <span className="pg-muted">No tenant</span>}</div>
                    <div>Lease: {p.currentLease?.displayStatus ? p.currentLease.displayStatus : isLand || isStr ? <span className="pg-muted">Not required</span> : <span className="pg-muted">No lease</span>}</div>
                  </div>
                  {(p.rentOverdue || p.leaseExpiringSoon || p.leaseMonthToMonth) ? (
                    <div className="pg-alert" style={{ marginTop: 10 }}>
                      Needs attention: {p.rentOverdue ? "overdue rent" : null}
                      {p.rentOverdue && (p.leaseExpiringSoon || p.leaseMonthToMonth) ? " · " : null}
                      {p.leaseExpiringSoon ? "lease expiring soon" : null}
                      {p.leaseExpiringSoon && p.leaseMonthToMonth ? " · " : null}
                      {p.leaseMonthToMonth ? "month-to-month lease" : null}
                    </div>
                  ) : null}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    <Link className="pg-btn pg-btn-ghost" to={`/owned-properties/${p.id}`}>View</Link>
                    <Link className="pg-btn pg-btn-ghost" to={`/owned-properties/${p.id}?tab=financials`}>Financials</Link>
                    <Link className="pg-btn pg-btn-ghost" to={`/owned-properties/${p.id}?tab=leases`}>Leases</Link>
                    <Link className="pg-btn pg-btn-ghost" to={`/owned-properties/${p.id}?tab=documents`}>Documents</Link>
                  </div>
                </div>
              );
            })}
          </Grid>
        )}
      </Container>
    </Section>
  );
}

