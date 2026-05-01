import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Doughnut } from "react-chartjs-2";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { api, authHeader } from "../api/client";

export function OwnedExpensesMetricsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/properties/dashboard-summary", { headers: authHeader() });
      setData(res.data);
    } catch (e: any) {
      console.error("[Expenses] load failed", e);
      setError(e?.response?.data?.message ?? "Failed to load expenses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const chart = useMemo(() => {
    const rows = data?.charts?.expenseBreakdown ?? [];
    return {
      labels: rows.map((r: any) => r.category),
      datasets: [{ data: rows.map((r: any) => r.amount), backgroundColor: ["#007ACC", "#FFB020", "#20C997", "#FF4D4F", "#A7A7A7", "#0094F5", "#7a7a7a", "#4d4d4d"] }]
    };
  }, [data]);

  return (
    <Section>
      <Helmet><title>Expenses | The Property Guy</title></Helmet>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 className="pg-h2" style={{ margin: 0 }}>Expenses</h1>
            <div className="pg-muted" style={{ marginTop: 6 }}>
              Operating Expense Ratio = operating expenses / effective gross income (annualised).
            </div>
          </div>
          <Button onClick={load} loading={loading}>Refresh</Button>
        </div>
        {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}
        <div style={{ height: 12 }} />
        <Card title={`Operating Expense Ratio: ${(Number(data?.operatingExpenseRatio ?? 0) * 100).toFixed(2)}%`}>
          {(data?.charts?.expenseBreakdown?.length ?? 0) ? <Doughnut data={chart} /> : <div className="pg-muted">No expense data yet.</div>}
        </Card>
      </Container>
    </Section>
  );
}

