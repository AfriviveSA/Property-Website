import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { api, authHeader } from "../api/client";
import { cancelLease as cancelLeaseApi, getProperties, getPropertyTenants } from "../api/ownedProperties";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

export function OwnedLeasesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState<number | "">("");
  const [tenants, setTenants] = useState<any[]>([]);
  const [leases, setLeases] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState<any>({
    tenantId: "",
    startDate: "",
    leaseType: "FIXED_TERM",
    fixedTermEndDate: "",
    monthlyRent: "",
    depositAmount: "",
    rentDueDay: 1,
    status: "DRAFT"
  });

  async function loadProperties() {
    const rows = await getProperties();
    setProperties(rows);
    if (!propertyId && rows[0]) setPropertyId(rows[0].id);
  }
  async function loadData(pid: number) {
    const [t, l] = await Promise.all([
      Promise.resolve({ data: await getPropertyTenants(pid) }),
      api.get(`/properties/${pid}/leases`, { headers: authHeader() })
    ]);
    setTenants(t.data);
    setLeases(l.data?.leases ?? l.data);
  }
  useEffect(() => { void loadProperties(); }, []);
  useEffect(() => { if (propertyId) void loadData(Number(propertyId)); }, [propertyId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    setError("");
    if (!form.tenantId) {
      setError("Please select a tenant.");
      return;
    }
    try {
      await api.post(`/properties/${propertyId}/leases`, form, { headers: authHeader() });
      await loadData(Number(propertyId));
      setForm({
        tenantId: "",
        startDate: "",
        leaseType: "FIXED_TERM",
        fixedTermEndDate: "",
        monthlyRent: "",
        depositAmount: "",
        rentDueDay: 1,
        status: "DRAFT"
      });
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Failed to add lease.";
      const blocking = e?.response?.data?.blocking;
      if (blocking?.propertyLeaseId || blocking?.tenantLeaseId) {
        setError(
          `${msg}\nBlocking lease(s): ` +
            `${blocking.propertyLeaseId ? `propertyLeaseId=${blocking.propertyLeaseId} tenantId=${blocking.propertyLeaseTenantId} status=${blocking.propertyLeaseStatus}` : ""}` +
            `${blocking.propertyLeaseId && blocking.tenantLeaseId ? " | " : ""}` +
            `${blocking.tenantLeaseId ? `tenantLeaseId=${blocking.tenantLeaseId} propertyId=${blocking.tenantLeasePropertyId} status=${blocking.tenantLeaseStatus}` : ""}`
        );
      } else setError(msg);
    }
  };

  const cancelLease = async (leaseId: number) => {
    const cancellationDate = window.prompt("Cancellation date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!cancellationDate) return;
    const cancellationReason = window.prompt("Cancellation reason (optional)", "") ?? undefined;
    await cancelLeaseApi(leaseId, { cancellationDate, cancellationReason, cancelledBy: "LANDLORD" });
    if (propertyId) await loadData(Number(propertyId));
  };

  return (
    <Section>
      <Helmet><title>Leases | The Property Guy</title></Helmet>
      <Container>
        <h1 className="pg-h2">Leases</h1>
        {error ? <div className="pg-alert pg-alert-error" style={{ marginBottom: 12 }}>{error}</div> : null}
        <Card>
          <Field label="Property">
            <select className="pg-input" value={propertyId} onChange={(e) => setPropertyId(Number(e.target.value))}>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <form onSubmit={submit}>
            <Field label="Tenant">
              <select className="pg-input" value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: Number(e.target.value) })}>
                <option value="">Select tenant</option>
                {tenants.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
              </select>
            </Field>
            <Field label="Start date"><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></Field>
            <Field label="Lease type">
              <select className="pg-input" value={form.leaseType} onChange={(e) => setForm({ ...form, leaseType: e.target.value })}>
                <option value="FIXED_TERM">Fixed term</option>
                <option value="MONTH_TO_MONTH">Month-to-month</option>
              </select>
            </Field>
            {form.leaseType === "FIXED_TERM" ? (
              <Field label="Fixed term end date">
                <Input type="date" value={form.fixedTermEndDate} onChange={(e) => setForm({ ...form, fixedTermEndDate: e.target.value })} required />
              </Field>
            ) : null}
            <Field label="Monthly rent"><Input type="number" value={form.monthlyRent} onChange={(e) => setForm({ ...form, monthlyRent: Number(e.target.value) })} required /></Field>
            <Field label="Deposit amount"><Input type="number" value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: Number(e.target.value) })} required /></Field>
            <Button type="submit">Add Lease</Button>
          </form>
        </Card>
        <div style={{ height: 12 }} />
        <Card title="Lease records">
          <div style={{ display: "grid", gap: 8 }}>
            {leases.map((l) => (
              <div key={l.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    Tenant: {l.tenant?.firstName} {l.tenant?.lastName} | Rent: {l.monthlyRent} | {l.displayStatus ?? l.status}
                  </div>
                  {["ACTIVE", "MONTH_TO_MONTH"].includes(l.displayStatus ?? l.status) ? (
                    <button className="pg-btn pg-btn-ghost" type="button" onClick={() => void cancelLease(l.id)}>
                      Cancel Lease
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Container>
    </Section>
  );
}
