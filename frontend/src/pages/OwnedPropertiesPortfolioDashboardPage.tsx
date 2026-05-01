import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Doughnut, Line, Bar } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/DashboardKit";
import { getPortfolioDashboardSummary, getProperties } from "../api/ownedProperties";

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

function parseMonthParam(search: string) {
  const raw = new URLSearchParams(search).get("month");
  if (!raw) return null;
  return /^\d{4}-\d{2}$/.test(raw) ? raw : null;
}

function parsePropertyParam(search: string) {
  const raw = new URLSearchParams(search).get("propertyId");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

export function OwnedPropertiesPortfolioDashboardPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(() => parseTypesParam(search));
  const [month, setMonth] = useState<string | null>(() => parseMonthParam(search) ?? new Date().toISOString().slice(0, 7));
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState<number | null>(() => parsePropertyParam(search));

  const load = async (types = selectedTypes, nextMonth = month, nextPropertyId = propertyId) => {
    setLoading(true);
    setError("");
    try {
      const res = await getPortfolioDashboardSummary({ propertyTypes: types, month: nextMonth, propertyId: nextPropertyId });
      setData(res);
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
    const nextMonth = parseMonthParam(search) ?? month;
    const nextPropertyId = parsePropertyParam(search);
    if (nextMonth) setMonth(nextMonth);
    setPropertyId(nextPropertyId);
    void load(next, nextMonth, nextPropertyId);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    async function loadProps() {
      try {
        const rows = await getProperties();
        if (!cancelled) setProperties(rows);
      } catch {
        if (!cancelled) setProperties([]);
      }
    }
    void loadProps();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasProperties = (data?.kpis?.totalProperties?.value ?? data?.totalProperties ?? 0) > 0;

  const noiTrend = useMemo(() => {
    const rows = data?.charts?.monthlyNOITrend ?? [];
    return {
      labels: rows.map((r: any) => r.label),
      datasets: [
        { label: "Monthly NOI", data: rows.map((r: any) => r.noi), borderColor: "#20C997", backgroundColor: "rgba(32,201,151,0.2)" }
      ]
    };
  }, [data]);

  const expenseMix = useMemo(() => {
    const rows = (data?.charts?.incomeExpenseComposition ?? []).filter((r: any) => r.type === "expense");
    const labels = rows.map((r: any) => r.category);
    const values = rows.map((r: any) => r.amount);
    const colors = labels.map((_l: any, idx: number) => ["#FFB020", "#20C997", "#4D96FF", "#FF4D4F", "#9B59B6", "#00C2A8"][idx % 6]);
    return { labels, datasets: [{ data: values, backgroundColor: colors }] };
  }, [data]);

  const incomeVsExpenseByProperty = useMemo(() => {
    const rows = data?.charts?.cashFlowByProperty ?? [];
    return {
      labels: rows.map((r: any) => r.name),
      datasets: [
        { label: "Income", data: rows.map((r: any) => r.monthlyIncome ?? 0), backgroundColor: "rgba(32,201,151,0.35)", borderColor: "#20C997" },
        { label: "Expenses", data: rows.map((r: any) => r.monthlyExpenses ?? 0), backgroundColor: "rgba(255,176,32,0.35)", borderColor: "#FFB020" }
      ]
    };
  }, [data]);

  const toggleType = (id: string) => {
    const next = selectedTypes.includes(id) ? selectedTypes.filter((t) => t !== id) : [...selectedTypes, id];
    const params = new URLSearchParams(search);
    if (next.length) params.set("types", next.join(","));
    else params.delete("types");
    if (month) params.set("month", month);
    if (propertyId != null) params.set("propertyId", String(propertyId));
    navigate(`/owned-properties/dashboard?${params.toString()}`);
  };

  const clearTypes = () => {
    const params = new URLSearchParams(search);
    params.delete("types");
    navigate(`/owned-properties/dashboard?${params.toString()}`);
  };

  const k = data?.kpis ?? {};
  const monthlyNOI = Number(k?.monthlyNOI?.value ?? 0);
  const monthlyOperatingExpenses = Number(k?.monthlyNOI?.operatingExpenses ?? data?.totalMonthlyOperatingExpenses ?? 0);
  const monthlyCashFlow = Number(data?.monthlyNetCashFlow ?? 0);
  const occupancyRate = Number(data?.occupancyRate ?? 0);
  const leasesExpiringSoon = Number(data?.leases?.expiringSoon ?? 0);
  const leasesMonthToMonth = Number(data?.leases?.monthToMonth ?? 0);
  const rentDueSoon = Number(data?.rentDue?.dueSoon ?? 0);
  const rentOverdue = Number(data?.rentDue?.overdue ?? 0);
  const portfolioEquity = Number(data?.portfolioEquity ?? 0);
  const currentValue = Number(data?.totalCurrentEstimatedValue ?? 0);
  const bondBalance = Number(data?.totalOutstandingBondBalance ?? 0);
  const missingDocs = Number(data?.missingData?.missingLeaseDocuments ?? 0);
  const missingExpenses = Number(data?.missingData?.missingExpenseData ?? 0);
  const missingValues = Number(data?.missingData?.missingCurrentEstimatedValue ?? 0);
  const missingBonds = Number(data?.missingData?.missingOutstandingBondBalance ?? 0);
  const negativeCashFlowProps = (data?.charts?.cashFlowByProperty ?? []).filter((r: any) => Number(r.netCashFlow ?? 0) < 0).length;

  const setParam = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(search);
    Object.entries(patch).forEach(([k, v]) => {
      if (v == null || v === "") params.delete(k);
      else params.set(k, v);
    });
    navigate(`/owned-properties/dashboard?${params.toString()}`);
  };

  return (
    <Section>
      <Helmet><title>Portfolio Dashboard | The Property Guy</title></Helmet>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="pg-h2" style={{ margin: 0 }}>Portfolio Dashboard</h1>
            <div className="pg-muted" style={{ marginTop: 6 }}>
              Monitor performance, risks and next actions across your portfolio.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={() => load()} loading={loading}>Refresh</Button>
            <Link className="pg-btn pg-btn-secondary" to="/owned-properties/new">Add Property</Link>
            <Link className="pg-btn pg-btn-ghost" to="/financials">Add income/expense</Link>
            <Link className="pg-btn pg-btn-ghost" to="/dashboard">My reports</Link>
          </div>
        </div>

        {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}

        <div style={{ height: 12 }} />
        <Card title="Filters">
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            <div>
              <div className="pg-muted" style={{ marginBottom: 6 }}>Property</div>
              <select className="pg-input" value={propertyId ?? ""} onChange={(e) => setParam({ propertyId: e.target.value ? String(Number(e.target.value)) : null })}>
                <option value="">All properties</option>
                {properties.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="pg-muted" style={{ marginBottom: 6 }}>Property types</div>
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
                  Clear types
                </button>
              </div>
            </div>
            <div>
              <div className="pg-muted" style={{ marginBottom: 6 }}>Month</div>
              <input className="pg-input" type="month" value={month ?? ""} onChange={(e) => setParam({ month: e.target.value || null })} />
              <div className="pg-muted" style={{ marginTop: 6 }}>Figures reflect the selected month.</div>
            </div>
            <div>
              <div className="pg-muted" style={{ marginBottom: 6 }}>Status</div>
              <select className="pg-input" value={"ALL"} onChange={() => {}}>
                <option value="ALL">All</option>
              </select>
              <div className="pg-muted" style={{ marginTop: 6 }}>More status filters coming soon.</div>
            </div>
          </div>
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Occupancy rate</div>
                <div className="pg-stat-value">{(occupancyRate * 100).toFixed(0)}%</div>
                <div className="pg-stat-hint">Tenant-required properties only.</div>
              </div>
              <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Rent due / overdue</div>
                <div className="pg-stat-value">{rentDueSoon} due soon · {rentOverdue} overdue</div>
                <div className="pg-stat-hint">Based on open invoices.</div>
              </div>
              <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Monthly NOI</div>
                <div className="pg-stat-value" style={{ color: monthlyNOI >= 0 ? "#20C997" : "#FF4D4F" }}>R {monthlyNOI.toLocaleString()}</div>
                <div className="pg-stat-hint">Before debt service.</div>
              </div>
              <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Monthly cash flow</div>
                <div className="pg-stat-value" style={{ color: monthlyCashFlow >= 0 ? "#20C997" : "#FF4D4F" }}>R {monthlyCashFlow.toLocaleString()}</div>
                <div className="pg-stat-hint">After debt service.</div>
              </div>
            </div>

            <div style={{ height: 10 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Operating expenses</div>
                <div className="pg-stat-value">R {monthlyOperatingExpenses.toLocaleString()}</div>
                <div className="pg-stat-hint">Excludes bond payments.</div>
              </div>
              <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Lease reviews</div>
                <div className="pg-stat-value">{leasesExpiringSoon} expiring · {leasesMonthToMonth} month-to-month</div>
                <div className="pg-stat-hint">Next 90 days + rollovers.</div>
              </div>
              <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Portfolio equity</div>
                <div className="pg-stat-value">R {portfolioEquity.toLocaleString()}</div>
                <div className="pg-stat-hint">Value less outstanding bonds.</div>
              </div>
              <div className="pg-stat-card" style={{ padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pg-stat-title">Current value / bonds</div>
                <div className="pg-stat-value">R {currentValue.toLocaleString()} · R {bondBalance.toLocaleString()}</div>
                <div className="pg-stat-hint">Based on captured values.</div>
              </div>
            </div>

            <div style={{ height: 12 }} />
            <Card title="Alerts & next actions">
              <div style={{ display: "grid", gap: 8 }}>
                {rentOverdue > 0 ? <Link className="pg-link" to="/invoices">Overdue rent ({rentOverdue}) — review invoices</Link> : null}
                {rentDueSoon > 0 ? <Link className="pg-link" to="/invoices">Rent due soon ({rentDueSoon}) — follow up early</Link> : null}
                {leasesExpiringSoon > 0 ? <Link className="pg-link" to="/leases">Leases expiring soon ({leasesExpiringSoon}) — plan renewals</Link> : null}
                {leasesMonthToMonth > 0 ? <Link className="pg-link" to="/leases">Month-to-month leases ({leasesMonthToMonth}) — confirm terms</Link> : null}
                {missingDocs > 0 ? <Link className="pg-link" to="/documents">Missing documents ({missingDocs}) — upload agreements</Link> : null}
                {missingExpenses > 0 ? <Link className="pg-link" to="/financials">No expense data ({missingExpenses}) — capture operating costs</Link> : null}
                {negativeCashFlowProps > 0 ? <Link className="pg-link" to="/owned-properties/my-properties?sort=LOWEST_CASH">Negative cash flow ({negativeCashFlowProps}) — review costs</Link> : null}
                {missingValues + missingBonds > 0 ? (
                  <Link className="pg-link" to="/owned-properties/metrics/equity">
                    Missing value/bond figures ({missingValues + missingBonds}) — update equity inputs
                  </Link>
                ) : null}
                {!rentOverdue && !rentDueSoon && !leasesExpiringSoon && !leasesMonthToMonth && !missingDocs && !missingExpenses && !negativeCashFlowProps && !(missingValues + missingBonds) ? (
                  <div className="pg-muted">No urgent alerts based on your current filters.</div>
                ) : null}
              </div>
            </Card>

            <div style={{ height: 12 }} />
            <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 12, alignItems: "stretch" }}>
              <Card title="Monthly NOI trend">
                <Line data={noiTrend} />
              </Card>
              <Card title="Expense mix (month)">
                {(data?.charts?.incomeExpenseComposition?.length ?? 0) ? <Doughnut data={expenseMix} /> : <div className="pg-muted">No expense data captured yet.</div>}
              </Card>
            </div>

            <div style={{ height: 12 }} />
            <Card title="Income vs expenses by property (month)">
              {(data?.charts?.cashFlowByProperty?.length ?? 0) ? <Bar data={incomeVsExpenseByProperty} /> : <div className="pg-muted">No property-level financials available yet.</div>}
            </Card>
          </>
        ) : null}
      </Container>
    </Section>
  );
}

