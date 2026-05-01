import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { api, authHeader } from "../api/client";
import { Card } from "../components/ui/Card";
import { Container } from "../components/ui/Container";
import { Grid } from "../components/ui/Grid";
import { Section } from "../components/ui/Section";
import { Button } from "../components/ui/Button";

type Report = {
  id: number;
  type: string;
  created_at: string;
  hasPdf: boolean;
  downloadUrl: string | null;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
};

function getKeyMetric(result: Record<string, unknown>) {
  const first = Object.entries(result).find(([, v]) => typeof v === "number") as [string, number] | undefined;
  if (!first) return null;
  const [k, v] = first;
  const pretty = typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v);
  return { label: k, value: pretty };
}

export function DashboardPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/user/reports", { headers: authHeader() });
      setReports(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to load reports. Are you logged in?");
    } finally {
      setLoading(false);
    }
  };

  const generate = async (id: number) => {
    setError("");
    try {
      await api.post(`/reports/${id}/generate`, {}, { headers: authHeader() });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to generate report.");
    }
  };

  const del = async (id: number) => {
    setError("");
    try {
      await api.delete(`/user/reports/${id}`, { headers: authHeader() });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to delete report.");
    }
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }, []);

  return (
    <Section>
      <Helmet>
        <title>My Reports | The Property Guy</title>
        <meta name="description" content="View, generate and download your saved property calculation reports." />
      </Helmet>
      <Container>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            <h1 className="pg-h2" style={{ margin: 0 }}>
              {greeting}
            </h1>
            <p className="pg-lead" style={{ margin: "6px 0 0" }}>
              Your saved calculations and PDF reports live here.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button onClick={load} loading={loading}>
              Refresh
            </Button>
            <Link className="pg-btn pg-btn-secondary" to="/calculators/cash-on-cash-return">
              New calculation
            </Link>
          </div>
        </div>

        {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 16 }}>{error}</div> : null}

        <div style={{ height: 16 }} />

        {reports.length === 0 && !loading ? (
          <Card>
            <h2 className="pg-h2" style={{ marginTop: 0 }}>
              No reports yet
            </h2>
            <p className="pg-lead">
              Run a calculator while logged in and your results will show up here automatically.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link className="pg-btn pg-btn-primary" to="/calculators/noi">
                Start with NOI
              </Link>
              <Link className="pg-btn pg-btn-ghost" to="/calculators/cash-flow">
                Explore cash flow
              </Link>
            </div>
          </Card>
        ) : null}

        {reports.length > 0 ? (
          <Grid cols={3}>
            {reports.map((r) => {
              const metric = getKeyMetric(r.result);
              return (
                <Card key={r.id}>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ fontWeight: 900 }}>{r.type}</div>
                      <div className="pg-muted" style={{ fontSize: 12 }}>
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>

                    {metric ? (
                      <div className="pg-kpi">
                        <div className="pg-kpi-value">{metric.value}</div>
                        <div className="pg-kpi-label">{metric.label}</div>
                      </div>
                    ) : (
                      <div className="pg-muted">No numeric key metric detected.</div>
                    )}

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Link className="pg-btn pg-btn-ghost" to={`/calculators/${r.type}`}>
                        View
                      </Link>
                      {r.downloadUrl ? (
                        <a className="pg-btn pg-btn-secondary" href={`${import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"}${r.downloadUrl}`}>
                          Download
                        </a>
                      ) : (
                        <Button variant="secondary" onClick={() => generate(r.id)}>
                          Generate PDF
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => del(r.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </Grid>
        ) : null}
      </Container>
    </Section>
  );
}

