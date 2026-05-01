import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { getEquityMetrics, updateEquityMetrics } from "../api/ownedProperties";

export function OwnedValuationsMetricsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [draft, setDraft] = useState<Record<number, string>>({});
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
      const next: Record<number, string> = {};
      data.forEach((r: any) => (next[r.id] = r.currentEstimatedValue == null ? "" : String(r.currentEstimatedValue)));
      setDraft(next);
    } catch (e: any) {
      console.error("[Valuations] load failed", e);
      setError(e?.response?.data?.message ?? "Failed to load valuations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const totals = useMemo(() => {
    const totalValue = rows.reduce((a, r) => a + Number(r.currentEstimatedValue ?? 0), 0);
    const missing = rows.filter((r) => r.currentEstimatedValue == null).length;
    return { totalValue, missing };
  }, [rows]);

  const saveAll = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updates = rows.map((r) => ({
        propertyId: r.id,
        currentEstimatedValue: draft[r.id] === "" ? null : Number(draft[r.id]),
        outstandingBondBalance: r.outstandingBondBalance ?? null
      }));
      await updateEquityMetrics(updates);
      setMessage("Saved.");
      await load();
    } catch (e: any) {
      console.error("[Valuations] save failed", e);
      setError(e?.response?.data?.message ?? "Failed to save valuations.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section>
      <Helmet><title>Valuations | The Property Guy</title></Helmet>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 className="pg-h2" style={{ margin: 0 }}>Valuations</h1>
            <div className="pg-muted" style={{ marginTop: 6 }}>Edit current estimated market values.</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={load} loading={loading}>Refresh</Button>
            <Button onClick={saveAll} loading={saving}>Save all</Button>
          </div>
        </div>

        {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}
        {message ? <div className="pg-alert" style={{ marginTop: 12 }}>{message}</div> : null}

        <div style={{ height: 12 }} />
        <Card title={`Total property value: R ${totals.totalValue.toLocaleString()} · Missing: ${totals.missing}`}>
          <div style={{ overflowX: "auto" }}>
            <table className="pg-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Property</th>
                  <th align="left">Address</th>
                  <th align="right">Current estimated value</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td className="pg-muted">{r.addressLine1}, {r.city}</td>
                    <td align="right">
                      <Input type="number" value={draft[r.id] ?? ""} onChange={(e) => setDraft({ ...draft, [r.id]: e.target.value })} />
                    </td>
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

