import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { getProperties, getProperty } from "../api/ownedProperties";

export function OwnedCashFlowMetricsPage() {
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
      console.error("[CashFlowMetrics] Load failed", e);
      setError(e?.response?.data?.message ?? "Failed to load cash flow.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    return details.map((p) => {
      const income = (p.incomeEntries ?? []).reduce((a: number, i: any) => a + Number(i.amount ?? 0), 0);
      const expenses = (p.expenses ?? []).reduce((a: number, e: any) => a + Number(e.amount ?? 0), 0);
      const bondPayment = Number(p.monthlyBondPayment ?? 0);
      const net = income - expenses - bondPayment;
      return { property: p, income, expenses, bondPayment, net };
    });
  }, [details]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({ income: acc.income + r.income, expenses: acc.expenses + r.expenses, bond: acc.bond + r.bondPayment, net: acc.net + r.net }),
      { income: 0, expenses: 0, bond: 0, net: 0 }
    );
  }, [rows]);

  return (
    <Section>
      <Helmet><title>Monthly Net Cash Flow | The Property Guy</title></Helmet>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 className="pg-h2" style={{ margin: 0 }}>Monthly Net Cash Flow</h1>
            <div className="pg-muted" style={{ marginTop: 6 }}>Income minus expenses minus monthly bond payment.</div>
          </div>
          <Button onClick={load} loading={loading}>Refresh</Button>
        </div>

        {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}
        <div style={{ height: 12 }} />

        <Card title={`Portfolio monthly net cash flow: R ${totals.net.toLocaleString()}`}>
          <div className="pg-muted" style={{ marginBottom: 10 }}>
            Income R {totals.income.toLocaleString()} · Expenses R {totals.expenses.toLocaleString()} · Bond payments R {totals.bond.toLocaleString()}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="pg-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Property</th>
                  <th align="right">Income</th>
                  <th align="right">Expenses</th>
                  <th align="right">Bond</th>
                  <th align="right">Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.property.id}>
                    <td>{r.property.name}</td>
                    <td align="right">R {r.income.toLocaleString()}</td>
                    <td align="right">R {r.expenses.toLocaleString()}</td>
                    <td align="right">R {r.bondPayment.toLocaleString()}</td>
                    <td align="right" style={{ color: r.net >= 0 ? "#20C997" : "#FF4D4F" }}>R {r.net.toLocaleString()}</td>
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

