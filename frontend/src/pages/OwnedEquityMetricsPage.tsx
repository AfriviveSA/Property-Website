import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { getEquityMetrics, updateEquityMetrics } from "../api/ownedProperties";

type EquityRow = {
  id: number;
  name: string;
  addressLine1: string;
  city: string;
  province: string;
  purchasePrice: number;
  currentEstimatedValue: number | null;
  outstandingBondBalance: number | null;
  equity: number | null;
  updatedAt?: string;
};

export function OwnedEquityMetricsPage() {
  const [rows, setRows] = useState<EquityRow[]>([]);
  const [draft, setDraft] = useState<Record<number, { currentEstimatedValue: string; outstandingBondBalance: string }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await getEquityMetrics();
      setRows(data);
      const nextDraft: typeof draft = {};
      data.forEach((r: EquityRow) => {
        nextDraft[r.id] = {
          currentEstimatedValue: r.currentEstimatedValue == null ? "" : String(r.currentEstimatedValue),
          outstandingBondBalance: r.outstandingBondBalance == null ? "" : String(r.outstandingBondBalance)
        };
      });
      setDraft(nextDraft);
    } catch (e: any) {
      console.error("[EquityMetrics] Load failed", e);
      setError(e?.response?.data?.message ?? "Failed to load equity metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    const totalValue = rows.reduce((a, r) => a + Number(r.currentEstimatedValue ?? 0), 0);
    const totalBonds = rows.reduce((a, r) => a + Number(r.outstandingBondBalance ?? 0), 0);
    const missingValues = rows.filter((r) => r.currentEstimatedValue == null || r.outstandingBondBalance == null).length;
    return { totalValue, totalBonds, portfolioEquity: totalValue - totalBonds, missingValues };
  }, [rows]);

  const saveAll = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updates = rows.map((r) => {
        const d = draft[r.id] ?? { currentEstimatedValue: "", outstandingBondBalance: "" };
        return {
          propertyId: r.id,
          currentEstimatedValue: d.currentEstimatedValue === "" ? null : Number(d.currentEstimatedValue),
          outstandingBondBalance: d.outstandingBondBalance === "" ? null : Number(d.outstandingBondBalance)
        };
      });
      await updateEquityMetrics(updates);
      setMessage("Saved.");
      await load();
    } catch (e: any) {
      console.error("[EquityMetrics] Save failed", e);
      setError(e?.response?.data?.message ?? "Failed to save equity metrics.");
    } finally {
      setSaving(false);
    }
  };

  const saveRow = async (propertyId: number) => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const d = draft[propertyId];
      await updateEquityMetrics([
        {
          propertyId,
          currentEstimatedValue: d?.currentEstimatedValue === "" ? null : Number(d?.currentEstimatedValue),
          outstandingBondBalance: d?.outstandingBondBalance === "" ? null : Number(d?.outstandingBondBalance)
        }
      ]);
      setMessage("Saved.");
      await load();
    } catch (e: any) {
      console.error("[EquityMetrics] Row save failed", e);
      setError(e?.response?.data?.message ?? "Failed to save row.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section>
      <Helmet><title>Portfolio Equity | The Property Guy</title></Helmet>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 className="pg-h2" style={{ margin: 0 }}>Portfolio Equity</h1>
            <div className="pg-muted" style={{ marginTop: 6 }}>Edit current values and bond balances. These overwrite the saved Property records.</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={load} loading={loading}>Refresh</Button>
            <Button onClick={saveAll} loading={saving}>Save all</Button>
          </div>
        </div>

        {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}
        {message ? <div className="pg-alert" style={{ marginTop: 12 }}>{message}</div> : null}

        <div style={{ height: 12 }} />
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          <Card title="Total Property Value">R {summary.totalValue.toLocaleString()}</Card>
          <Card title="Total Outstanding Bonds">R {summary.totalBonds.toLocaleString()}</Card>
          <Card title="Portfolio Equity">R {summary.portfolioEquity.toLocaleString()}</Card>
          <Card title="Properties Missing Values">{summary.missingValues}</Card>
        </div>

        <div style={{ height: 12 }} />
        <Card title="Equity by property">
          <div style={{ overflowX: "auto" }}>
            <table className="pg-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Property</th>
                  <th align="left">Address</th>
                  <th align="right">Purchase price</th>
                  <th align="right">Current value</th>
                  <th align="right">Outstanding bond</th>
                  <th align="right">Equity</th>
                  <th> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = draft[r.id] ?? { currentEstimatedValue: "", outstandingBondBalance: "" };
                  const value = d.currentEstimatedValue === "" ? null : Number(d.currentEstimatedValue);
                  const bond = d.outstandingBondBalance === "" ? null : Number(d.outstandingBondBalance);
                  const equity = value != null && bond != null ? value - bond : null;
                  return (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td className="pg-muted">{r.addressLine1}, {r.city}</td>
                      <td align="right">R {Number(r.purchasePrice ?? 0).toLocaleString()}</td>
                      <td align="right">
                        <Input
                          type="number"
                          value={d.currentEstimatedValue}
                          onChange={(e) => setDraft({ ...draft, [r.id]: { ...d, currentEstimatedValue: e.target.value } })}
                        />
                      </td>
                      <td align="right">
                        <Input
                          type="number"
                          value={d.outstandingBondBalance}
                          onChange={(e) => setDraft({ ...draft, [r.id]: { ...d, outstandingBondBalance: e.target.value } })}
                        />
                      </td>
                      <td align="right">{equity == null ? <span className="pg-muted">Missing</span> : `R ${equity.toLocaleString()}`}</td>
                      <td align="right">
                        <button className="pg-btn pg-btn-secondary" type="button" onClick={() => void saveRow(r.id)} disabled={saving}>
                          Save
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </Container>
    </Section>
  );
}

