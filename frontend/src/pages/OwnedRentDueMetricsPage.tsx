import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { getProperties, getProperty } from "../api/ownedProperties";

export function OwnedRentDueMetricsPage() {
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
      console.error("[RentDueMetrics] Load failed", e);
      setError(e?.response?.data?.message ?? "Failed to load rent due.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    const today = new Date();
    const in7 = new Date();
    in7.setDate(today.getDate() + 7);
    const invoices = details.flatMap((p) => (p.invoices ?? []).map((i: any) => ({ property: p, invoice: i })));
    const unpaid = invoices.filter((x) => !["PAID", "CANCELLED"].includes(x.invoice.status));

    const dedup = new Map<string, any>();
    unpaid.forEach((x) => {
      const due = new Date(x.invoice.dueDate);
      const key = `${x.invoice.tenantId}-${due.getFullYear()}-${due.getMonth() + 1}`;
      const existing = dedup.get(key);
      if (!existing || new Date(existing.invoice.dueDate) > due) dedup.set(key, x);
    });

    return Array.from(dedup.values()).map((x: any) => {
      const due = new Date(x.invoice.dueDate);
      const overdue = due < today;
      const dueSoon = due >= today && due <= in7;
      const daysOverdue = overdue ? Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      return { ...x, due, overdue, dueSoon, daysOverdue };
    });
  }, [details]);

  const overdue = rows.filter((r) => r.overdue).length;
  const dueSoon = rows.filter((r) => r.dueSoon).length;

  return (
    <Section>
      <Helmet><title>Rent Due / Overdue | The Property Guy</title></Helmet>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="pg-h2" style={{ margin: 0 }}>Rent Due / Overdue</h1>
            <div className="pg-muted" style={{ marginTop: 6 }}>Shows unpaid invoices due soon (7 days) or overdue.</div>
          </div>
          <Button onClick={load} loading={loading}>Refresh</Button>
        </div>

        {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}
        <div style={{ height: 12 }} />
        <Card title={`Attention: overdue ${overdue}, due soon ${dueSoon}`}>
          <div style={{ overflowX: "auto" }}>
            <table className="pg-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Property</th>
                  <th align="left">Tenant</th>
                  <th align="left">Invoice</th>
                  <th align="left">Status</th>
                  <th align="left">Due date</th>
                  <th align="right">Days overdue</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .sort((a, b) => a.due.getTime() - b.due.getTime())
                  .map((r) => (
                    <tr key={r.invoice.id}>
                      <td>{r.property.name}</td>
                      <td>{r.invoice.tenantId}</td>
                      <td>{r.invoice.invoiceNumber}</td>
                      <td>{r.invoice.status}</td>
                      <td>{r.due.toLocaleDateString()}</td>
                      <td align="right">{r.overdue ? r.daysOverdue : "-"}</td>
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

