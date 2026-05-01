import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { getProperties, getProperty } from "../api/ownedProperties";

export function OwnedDepositsMetricsPage() {
  const [details, setDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const props = await getProperties();
      const settled = await Promise.allSettled(props.map((p: any) => getProperty(p.id)));
      setDetails(settled.filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled").map((r) => r.value));
    } catch (e: any) {
      console.error("[DepositsMetrics] Load failed", e);
      setError(e?.response?.data?.message ?? "Failed to load deposits.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    const leases = details.flatMap((p) => (p.leases ?? []).map((l: any) => ({ property: p, lease: l })));
    const active = leases.filter((x) => ["ACTIVE", "MONTH_TO_MONTH"].includes(x.lease.status));
    const total = active.reduce((a, x) => a + Number(x.lease.depositAmount ?? 0), 0);
    return { active, total };
  }, [details]);

  return (
    <Section>
      <Helmet><title>Deposits Held | The Property Guy</title></Helmet>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="pg-h2" style={{ margin: 0 }}>Deposits Held</h1>
            <div className="pg-muted" style={{ marginTop: 6 }}>Deposits for current leases (active or month-to-month).</div>
          </div>
          <Button onClick={load} loading={loading}>Refresh</Button>
        </div>

        {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}
        <div style={{ height: 12 }} />
        <Card title={`Total deposits held: R ${rows.total.toLocaleString()}`}>
          <div style={{ overflowX: "auto" }}>
            <table className="pg-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Property</th>
                  <th align="left">Tenant</th>
                  <th align="right">Deposit</th>
                  <th align="left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.active.map((x) => (
                  <tr key={x.lease.id}>
                    <td>{x.property.name}</td>
                    <td>{x.lease.tenant?.firstName ? `${x.lease.tenant.firstName} ${x.lease.tenant.lastName}` : <span className="pg-muted">Missing</span>}</td>
                    <td align="right">R {Number(x.lease.depositAmount ?? 0).toLocaleString()}</td>
                    <td>{x.lease.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Container>
    </Section>
  );
}

