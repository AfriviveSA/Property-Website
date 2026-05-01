import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Doughnut, Line } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Button } from "../components/ui/Button";
import { api, authHeader } from "../api/client";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/DashboardKit";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip, PointElement, LineElement);

const TYPE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "LONG_TERM_RENTAL", label: "Long-Term Rental" },
  { id: "SHORT_TERM_RENTAL", label: "Short-Term Rental / Airbnb" },
  { id: "PRIMARY_RESIDENCE", label: "Primary Residence" },
  { id: "HOUSE_HACK", label: "House Hack" },
  { id: "BRRRR", label: "BRRRR" },
  { id: "FLIP", label: "Flip / Renovation Project" },
  { id: "VACANT_LAND", label: "Vacant Land" },
  { id: "COMMERCIAL", label: "Commercial" },
  { id: "MIXED_USE", label: "Mixed Use" },
  { id: "OTHER", label: "Other" }
];

function parseTypesParam(search: string) {
  const raw = new URLSearchParams(search).get("types");
  if (!raw) return [] as string[];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function OwnedPropertiesPortfolioDashboardPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(() => parseTypesParam(search));

  const load = async (types = selectedTypes) => {
    setLoading(true);
    setError("");
    try {
      const qs = types.length ? `?propertyTypes=${encodeURIComponent(types.join(","))}` : "";
      const res = await api.get(`/properties/dashboard-summary${qs}`, { headers: authHeader() });
      setData(res.data);
    } catch (e: any) {
      console.error("[PortfolioDashboard] load failed", e);
      setError(e?.response?.data?.message ?? "Failed to load portfolio dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []); // initial

  useEffect(() => {
    const next = parseTypesParam(search);
    setSelectedTypes(next);
    void load(next);
  }, [search]);

  const hasProperties = (data?.kpis?.totalProperties?.value ?? data?.totalProperties ?? 0) > 0;

  const noiTrend = useMemo(() => {
    const rows = data?.charts?.monthlyNOITrend ?? [];
    return {
      labels: rows.map((r: any) => r.label),
      datasets: [
        { label: "NOI", data: rows.map((r: any) => r.noi), borderColor: "#20C997", backgroundColor: "rgba(32,201,151,0.2)" }
      ]
    };
  }, [data]);

  const composition = useMemo(() => {
    const rows = data?.charts?.incomeExpenseComposition ?? [];
    const labels = rows.map((r: any) => `${r.type === "income" ? "Income" : "Expense"}: ${r.category}`);
    const values = rows.map((r: any) => r.amount);
    const colors = rows.map((r: any) => (r.type === "income" ? "#20C997" : "#FFB020"));
    return { labels, datasets: [{ data: values, backgroundColor: colors }] };
  }, [data]);

  const toggleType = (id: string) => {
    const next = selectedTypes.includes(id) ? selectedTypes.filter((t) => t !== id) : [...selectedTypes, id];
    const params = new URLSearchParams(search);
    if (next.length) params.set("types", next.join(","));
    else params.delete("types");
    navigate(`/owned-properties/dashboard?${params.toString()}`);
  };

  const clearTypes = () => {
    navigate("/owned-properties/dashboard");
  };

  const k = data?.kpis ?? {};
  const monthlyNOI = Number(k?.monthlyNOI?.value ?? 0);
  const expensesTotal = k?.monthlyExpenses?.value == null ? null : Number(k.monthlyExpenses.value);
  const coc = k?.trueCashOnCashROI?.valuePercent;
  const irr = k?.portfolioIRR?.valuePercent;

  return (
    <Section>
      <Helmet><title>Portfolio Dashboard | The Property Guy</title></Helmet>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="pg-h2" style={{ margin: 0 }}>Portfolio Dashboard</h1>
            <div className="pg-muted" style={{ marginTop: 6 }}>
              Track equity, income, expenses, leases and performance across your property portfolio.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={() => load()} loading={loading}>Refresh</Button>
            <Link className="pg-btn pg-btn-secondary" to="/owned-properties/new">Add Property</Link>
            <Link className="pg-btn pg-btn-ghost" to="/financials">Add Income/Expense</Link>
            <Link className="pg-btn pg-btn-ghost" to="/invoices">Generate Portfolio Report</Link>
          </div>
        </div>

        {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}

        <div style={{ height: 12 }} />
        <Card title="Filter by property type">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TYPE_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`pg-btn ${selectedTypes.includes(o.id) ? "pg-btn-primary" : "pg-btn-ghost"}`}
                onClick={() => toggleType(o.id)}
                aria-label={`Toggle ${o.label}`}
              >
                {o.label}
              </button>
            ))}
            <button className="pg-btn pg-btn-secondary" type="button" onClick={clearTypes}>
              Clear / reset
            </button>
          </div>
          {selectedTypes.length ? (
            <div className="pg-muted" style={{ marginTop: 8 }}>
              Active: {selectedTypes.join(", ")}
            </div>
          ) : (
            <div className="pg-muted" style={{ marginTop: 8 }}>Showing all property types.</div>
          )}
        </Card>

        {!hasProperties && !loading ? (
          <div style={{ marginTop: 12 }}>
            <EmptyState
              title="Add your first property"
              body="Track equity, cash flow, tenants, leases and reports across your portfolio."
              actions={
                <>
                  <Link className="pg-btn pg-btn-primary" to="/owned-properties/new">Add Property</Link>
                  <Link className="pg-btn pg-btn-ghost" to="/calculators/cash-on-cash-return">Open Calculators</Link>
                </>
              }
            />
          </div>
        ) : null}

        {hasProperties ? (
          <>
            <div style={{ height: 12 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 }}>
              <div className="pg-stat-card pg-stat-success" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Monthly NOI</div>
                <div className="pg-stat-value" style={{ color: monthlyNOI >= 0 ? "#20C997" : "#FF4D4F" }}>R {monthlyNOI.toLocaleString()}</div>
                <div className="pg-stat-hint">Income less operating expenses, before debt service.</div>
              </div>
              <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Monthly Expenses</div>
                <div className="pg-stat-value">{expensesTotal == null ? "No expenses captured" : `R ${expensesTotal.toLocaleString()}`}</div>
                <div className="pg-stat-hint">Operating costs plus bond repayments.</div>
              </div>
              <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">True Cash-on-Cash ROI</div>
                <div className="pg-stat-value" style={{ color: coc != null && coc < 0 ? "#FF4D4F" : coc != null && coc < 5 ? "#FFB020" : "#20C997" }}>
                  {coc == null ? "Insufficient data" : `${coc.toFixed(2)}%`}
                </div>
                <div className="pg-stat-hint">Annual pre-tax cash flow / actual cash invested.</div>
              </div>
              <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Portfolio IRR</div>
                <div className="pg-stat-value">{irr == null ? "Insufficient data" : `${Number(irr).toFixed(2)}%`}</div>
                <div className="pg-stat-hint">Includes cash flow + estimated value growth.</div>
              </div>
              <div className="pg-stat-card pg-stat-accent" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Total Properties</div>
                <div className="pg-stat-value">{k?.totalProperties?.value ?? data?.totalProperties ?? 0}</div>
                <div className="pg-stat-hint">Based on selected property types.</div>
              </div>
            </div>

            {(data?.warnings?.length ?? 0) ? (
              <div className="pg-alert" style={{ marginTop: 12 }}>
                <strong>Warnings</strong>
                <div className="pg-muted" style={{ marginTop: 6 }}>
                  {(data.warnings as string[]).map((w, idx) => <div key={idx}>- {w}</div>)}
                </div>
              </div>
            ) : null}

            <div style={{ height: 12 }} />
            <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 12, alignItems: "stretch" }}>
              <Card title="Monthly NOI Trend (past five months)">
                <Line data={noiTrend} />
              </Card>
              <Card title="Income & Expense Composition">
                {(data?.charts?.incomeExpenseComposition?.length ?? 0) ? <Doughnut data={composition} /> : <div className="pg-muted">No income or expense data captured yet.</div>}
              </Card>
            </div>
          </>
        ) : null}
      </Container>
    </Section>
  );
}

