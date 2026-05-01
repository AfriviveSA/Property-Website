import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { getProperties, getProperty } from "../api/ownedProperties";

function deriveLeaseDisplayStatus(lease: any) {
  if (["CANCELLED", "TERMINATED", "EXPIRED", "DRAFT"].includes(lease.status)) return lease.status;
  const end = lease.fixedTermEndDate ?? lease.endDate;
  if (end && new Date(end).getTime() < Date.now() && lease.status === "ACTIVE") return "MONTH_TO_MONTH";
  return lease.status;
}

export function OwnedLeaseMetricsPage() {
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
      console.error("[LeaseMetrics] Load failed", e);
      setError(e?.response?.data?.message ?? "Failed to load leases.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    const now = new Date();
    const in90 = new Date();
    in90.setDate(now.getDate() + 90);
    return details.flatMap((p) =>
      (p.leases ?? []).map((l: any) => {
        const displayStatus = deriveLeaseDisplayStatus(l);
        const end = l.fixedTermEndDate ?? l.endDate ?? null;
        const endDate = end ? new Date(end) : null;
        const daysUntil = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
        const expiringSoon = endDate ? endDate >= now && endDate <= in90 : false;
        return { property: p, lease: l, displayStatus, endDate, daysUntil, expiringSoon };
      })
    );
  }, [details]);

  const attention = rows.filter((r) => ["ACTIVE", "MONTH_TO_MONTH"].includes(r.displayStatus) && (r.expiringSoon || r.displayStatus === "MONTH_TO_MONTH")).length;

  return (
    <Section>
      <Helmet><title>Lease Renewals | The Property Guy</title></Helmet>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="pg-h2" style={{ margin: 0 }}>Lease Renewals</h1>
            <div className="pg-muted" style={{ marginTop: 6 }}>Fixed-term leases become month-to-month after the end date unless cancelled.</div>
          </div>
          <Button onClick={load} loading={loading}>Refresh</Button>
        </div>

        {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}
        <div style={{ height: 12 }} />

        <Card title={`Leases needing attention: ${attention}`}>
          <div style={{ overflowX: "auto" }}>
            <table className="pg-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Property</th>
                  <th align="left">Tenant</th>
                  <th align="left">Status</th>
                  <th align="left">Fixed end date</th>
                  <th align="right">Days</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => ["ACTIVE", "MONTH_TO_MONTH"].includes(r.displayStatus))
                  .sort((a, b) => (a.endDate?.getTime() ?? 0) - (b.endDate?.getTime() ?? 0))
                  .map((r) => (
                    <tr key={r.lease.id}>
                      <td>{r.property.name}</td>
                      <td>{r.lease.tenant?.firstName ? `${r.lease.tenant.firstName} ${r.lease.tenant.lastName}` : <span className="pg-muted">Missing</span>}</td>
                      <td>{r.displayStatus}</td>
                      <td>{r.endDate ? r.endDate.toLocaleDateString() : <span className="pg-muted">Month-to-month</span>}</td>
                      <td align="right">{r.daysUntil == null ? "-" : r.daysUntil}</td>
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

