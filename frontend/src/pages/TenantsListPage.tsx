import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { getTenants } from "../api/ownedProperties";

export function TenantsListPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await getTenants());
    } catch (e: any) {
      console.error("[TenantsList] Load failed", e);
      setError(e?.response?.data?.message ?? "Failed to load tenants.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => `${a.lastName ?? ""}`.localeCompare(`${b.lastName ?? ""}`));
  }, [rows]);

  return (
    <Section>
      <Helmet><title>Tenants | The Property Guy</title></Helmet>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 className="pg-h2" style={{ margin: 0 }}>Tenants</h1>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={load} loading={loading}>Refresh</Button>
            <Link className="pg-btn pg-btn-primary" to="/tenants/new">Add Tenant</Link>
          </div>
        </div>
        {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}
        <div style={{ height: 12 }} />
        <Card title="Tenant directory">
          <div style={{ display: "grid", gap: 8 }}>
            {sorted.map((t) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <Link className="pg-link" to={`/tenants/${t.id}`}>
                    {t.firstName} {t.lastName}
                  </Link>
                  <div className="pg-muted">
                    {t.property?.name ? `Property: ${t.property.name}` : "Property: -"}{" "}
                    {t.phone ? `| Phone: ${t.phone}` : ""} {t.email ? `| Email: ${t.email}` : ""}
                  </div>
                </div>
                <div className="pg-muted">Status: {t.status}</div>
              </div>
            ))}
            {!sorted.length && !loading ? <div className="pg-muted">No tenants yet.</div> : null}
          </div>
        </Card>
      </Container>
    </Section>
  );
}

