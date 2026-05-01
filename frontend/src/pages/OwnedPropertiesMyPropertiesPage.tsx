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
  const [sort, setSort] = useState<string>("RECENT");

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

    const cashFlow = (p: any) => asNum(p.netCashFlow) ?? 0;

    if (sort === "HIGHEST_EQUITY") next.sort((a, b) => (equity(b) ?? -Infinity) - (equity(a) ?? -Infinity));
    if (sort === "HIGHEST_CASH") next.sort((a, b) => cashFlow(b) - cashFlow(a));
    if (sort === "LOWEST_CASH") next.sort((a, b) => cashFlow(a) - cashFlow(b));
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
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
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
              <option value="HIGHEST_EQUITY">Highest equity</option>
              <option value="HIGHEST_CASH">Highest cash flow</option>
              <option value="LOWEST_CASH">Lowest cash flow</option>
            </select>
          </div>
        </Card>

        <div style={{ height: 12 }} />
        <Grid cols={3}>
          {filtered.map((p) => {
            const typeKey = p.investmentType ?? p.propertyType;
            const isLand = typeKey === "VACANT_LAND";
            const isStr = typeKey === "SHORT_TERM_RENTAL";
            const statusLabel = isLand ? "Land / No Tenant Required" : isStr ? "Short-Term Rental" : p.occupancyStatus === "OCCUPIED" ? "Occupied" : "Vacant";
            const tone = isLand ? "accent" : isStr ? "accent" : p.occupancyStatus === "OCCUPIED" ? "success" : "warning";
            const v = p.currentEstimatedValue;
            const b = p.outstandingBondBalance;
            const equity = v != null && b != null ? Number(v) - Number(b) : null;
            const cash = Number(p.netCashFlow ?? 0);
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
                  <div>Market value: {v == null ? <span className="pg-muted">Add value</span> : `R ${Number(v).toLocaleString()}`}</div>
                  <div>Bond: {b == null ? <span className="pg-muted">Add bond</span> : `R ${Number(b).toLocaleString()}`}</div>
                  <div>Equity: {equity == null ? <span className="pg-muted">Missing</span> : `R ${equity.toLocaleString()}`}</div>
                  <div>Purchase price: R {Number(p.purchasePrice ?? 0).toLocaleString()}</div>
                  <div>Monthly income: R {Number(p.monthlyIncome ?? 0).toLocaleString()}</div>
                  <div>Monthly expenses: R {Number(p.monthlyExpenses ?? 0).toLocaleString()}</div>
                  <div>Net cash flow: <span style={{ color: cash >= 0 ? "#20C997" : "#FF4D4F" }}>R {cash.toLocaleString()}</span></div>
                  <div>Tenant: {p.currentTenant?.firstName ? `${p.currentTenant.firstName} ${p.currentTenant.lastName}` : isLand || isStr ? <span className="pg-muted">Not required</span> : <span className="pg-muted">None</span>}</div>
                  <div>Lease: {p.currentLease?.displayStatus ? p.currentLease.displayStatus : isLand || isStr ? <span className="pg-muted">Not required</span> : <span className="pg-muted">None</span>}</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  <Link className="pg-btn pg-btn-ghost" to={`/owned-properties/${p.id}`}>View</Link>
                  <Link className="pg-btn pg-btn-ghost" to={`/owned-properties/${p.id}/edit`}>Edit</Link>
                  <Link className="pg-btn pg-btn-ghost" to={`/owned-properties/${p.id}?tab=financials`}>Financials</Link>
                  <Link className="pg-btn pg-btn-ghost" to={`/owned-properties/${p.id}?tab=documents`}>Documents</Link>
                </div>
              </div>
            );
          })}
        </Grid>
      </Container>
    </Section>
  );
}

