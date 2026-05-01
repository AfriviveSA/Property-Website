import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { cancelLease, deleteTenant, getTenant } from "../api/ownedProperties";

export function TenantDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      setData(await getTenant(id));
    } catch (e: any) {
      console.error("[TenantDetail] Load failed", e);
      setError(e?.response?.data?.message ?? "Failed to load tenant.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const onCancelLease = async () => {
    if (!data?.currentLease?.id) return;
    const cancellationDate = window.prompt("Cancellation date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!cancellationDate) return;
    const cancellationReason = window.prompt("Cancellation reason (optional)", "") ?? undefined;
    await cancelLease(data.currentLease.id, { cancellationDate, cancellationReason, cancelledBy: "LANDLORD" });
    await load();
  };

  const onDelete = async () => {
    if (!id) return;
    const ok = window.confirm("Delete this tenant? If they have leases, they will be marked as PAST instead.");
    if (!ok) return;
    await deleteTenant(id);
    navigate("/tenants");
  };

  const tenant = data?.tenant;
  const currentLease = data?.currentLease;

  return (
    <Section>
      <Helmet><title>Tenant | The Property Guy</title></Helmet>
      <Container>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 className="pg-h2" style={{ margin: 0 }}>{tenant ? `${tenant.firstName} ${tenant.lastName}` : "Tenant"}</h1>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={load} loading={loading}>Refresh</Button>
            {id ? <Link className="pg-btn pg-btn-secondary" to={`/tenants/${id}/edit`}>Edit Tenant</Link> : null}
            <Link className="pg-btn pg-btn-ghost" to="/tenants">Back</Link>
          </div>
        </div>
        {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}

        {tenant ? (
          <>
            <div style={{ height: 12 }} />
            <Card title="Details">
              <div style={{ display: "grid", gap: 6 }}>
                <div>Status: {tenant.status}</div>
                <div className="pg-muted">{tenant.phone ? `Phone: ${tenant.phone}` : "Phone: -"} {tenant.email ? `| Email: ${tenant.email}` : ""}</div>
                <div className="pg-muted">{tenant.idNumber ? `ID: ${tenant.idNumber}` : ""}</div>
              </div>
            </Card>

            <div style={{ height: 12 }} />
            <Card title="Linked property">
              {tenant.property ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <div>
                    <Link className="pg-link" to={`/owned-properties/${tenant.property.id}`}>{tenant.property.name}</Link>
                  </div>
                  <div className="pg-muted">{tenant.property.addressLine1}, {tenant.property.city}</div>
                </div>
              ) : (
                <div className="pg-muted">No property linked.</div>
              )}
            </Card>

            <div style={{ height: 12 }} />
            <Card title="Current lease">
              {currentLease ? (
                <div style={{ display: "grid", gap: 6 }}>
                  <div>Status: {currentLease.displayStatus ?? currentLease.status}</div>
                  <div>Type: {currentLease.leaseType}</div>
                  <div>Start: {new Date(currentLease.startDate).toLocaleDateString()}</div>
                  <div>Fixed term end: {currentLease.fixedTermEndDate ? new Date(currentLease.fixedTermEndDate).toLocaleDateString() : <span className="pg-muted">Month-to-month</span>}</div>
                  <div>Monthly rent: R {Number(currentLease.monthlyRent ?? 0).toLocaleString()}</div>
                  <div>Deposit: R {Number(currentLease.depositAmount ?? 0).toLocaleString()}</div>
                  <div>Rent due day: {currentLease.rentDueDay}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <button className="pg-btn pg-btn-secondary" type="button" onClick={() => void onCancelLease()}>
                      Cancel Lease
                    </button>
                    <Link className="pg-btn pg-btn-ghost" to="/leases">Manage Leases</Link>
                  </div>
                </div>
              ) : (
                <div className="pg-muted">No current lease.</div>
              )}
            </Card>

            <div style={{ height: 12 }} />
            <Card title="Lease history">
              <div style={{ display: "grid", gap: 8 }}>
                {(tenant.leases ?? []).map((l: any) => (
                  <div key={l.id} className="pg-muted">
                    {l.property?.name ? `${l.property.name} | ` : ""}{l.status} | start {new Date(l.startDate).toLocaleDateString()}
                  </div>
                ))}
                {!(tenant.leases ?? []).length ? <div className="pg-muted">No lease history.</div> : null}
              </div>
            </Card>

            <div style={{ height: 12 }} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="pg-btn pg-btn-ghost" type="button" onClick={() => void onDelete()}>Delete / Mark Past</button>
            </div>
          </>
        ) : null}
      </Container>
    </Section>
  );
}

