import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { api, authHeader } from "../api/client";

export function OwnedReturnsMetricsPage() {
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
      console.error("[Returns] load failed", e);
      setError(e?.response?.data?.message ?? "Failed to load returns.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <Section>
      <Helmet><title>Returns | The Property Guy</title></Helmet>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 className="pg-h2" style={{ margin: 0 }}>Returns</h1>
            <div className="pg-muted" style={{ marginTop: 6 }}>
              NOI excludes debt service. Cap rate is NOI / current value for income-producing properties.
            </div>
          </div>
          <Button onClick={load} loading={loading}>Refresh</Button>
        </div>
        {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}
        <div style={{ height: 12 }} />
        <Card title="Portfolio returns">
          <div style={{ display: "grid", gap: 8 }}>
            <div>Annual NOI: <strong>R {Number(data?.annualNOI ?? 0).toLocaleString()}</strong></div>
            <div>Average cap rate: <strong>{(Number(data?.averageCapRate ?? 0) * 100).toFixed(2)}%</strong></div>
            <div className="pg-muted">
              Notes: Primary Residence, Vacant Land and Flip projects are excluded from cap-rate denominator unless they’re income-producing.
            </div>
          </div>
        </Card>
      </Container>
    </Section>
  );
}

