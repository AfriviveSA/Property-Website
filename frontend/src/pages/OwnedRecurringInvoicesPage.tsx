import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { api, authHeader } from "../api/client";
import { getProperties } from "../api/ownedProperties";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

export function OwnedRecurringInvoicesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState<number | "">("");
  const [tenants, setTenants] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    tenantId: "",
    enabled: false,
    dayOfMonth: 1,
    nextRunDate: "",
    invoiceDescription: "Monthly Rent",
    rentAmount: "",
    includeUtilities: false,
    emailTenant: false,
    tenantPermissionConfirmed: false
  });

  async function loadProperties() {
    const rows = await getProperties();
    setProperties(rows);
    if (!propertyId && rows[0]) setPropertyId(rows[0].id);
  }
  async function loadData(pid: number) {
    const [t, r] = await Promise.all([
      api.get(`/properties/${pid}/tenants`, { headers: authHeader() }),
      api.get(`/properties/${pid}/recurring-invoices`, { headers: authHeader() })
    ]);
    setTenants(t.data);
    setRules(r.data);
  }
  useEffect(() => { void loadProperties(); }, []);
  useEffect(() => { if (propertyId) void loadData(Number(propertyId)); }, [propertyId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    await api.post(`/properties/${propertyId}/recurring-invoices`, form, { headers: authHeader() });
    await loadData(Number(propertyId));
  };
  const runDue = async () => {
    await api.post("/recurring-invoices/run-due", {}, { headers: authHeader() });
    if (propertyId) await loadData(Number(propertyId));
  };

  return (
    <Section>
      <Helmet><title>Recurring Invoices | The Property Guy</title></Helmet>
      <Container>
        <h1 className="pg-h2">Recurring Invoices</h1>
        <div className="pg-alert" style={{ marginBottom: 12 }}>
          Recurring invoices will only be emailed if you confirm permission and configure email sending.
        </div>
        <Card>
          <Field label="Property"><select className="pg-input" value={propertyId} onChange={(e) => setPropertyId(Number(e.target.value))}>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <form onSubmit={submit}>
            <Field label="Tenant"><select className="pg-input" value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: Number(e.target.value) })}>{tenants.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}</select></Field>
            <Field label="Rent amount"><Input type="number" value={form.rentAmount} onChange={(e) => setForm({ ...form, rentAmount: Number(e.target.value) })} required /></Field>
            <Field label="Invoice day of month"><Input type="number" min={1} max={31} value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: Number(e.target.value) })} /></Field>
            <Field label="Next run date"><Input type="date" value={form.nextRunDate} onChange={(e) => setForm({ ...form, nextRunDate: e.target.value })} required /></Field>
            <Field label="Email tenant"><label className="pg-pill"><input type="checkbox" checked={form.emailTenant} onChange={(e) => setForm({ ...form, emailTenant: e.target.checked })} /> Email tenant</label></Field>
            <Field label="Tenant permission"><label className="pg-pill"><input type="checkbox" checked={form.tenantPermissionConfirmed} onChange={(e) => setForm({ ...form, tenantPermissionConfirmed: e.target.checked })} /> Permission confirmed</label></Field>
            <Field label="Enable rule"><label className="pg-pill"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled</label></Field>
            <Button type="submit">Create Rule</Button>
            <Button type="button" variant="secondary" onClick={runDue} style={{ marginLeft: 8 }}>Run Due Rules</Button>
          </form>
        </Card>
        <div style={{ height: 12 }} />
        <Card title="Rules">
          <div style={{ display: "grid", gap: 8 }}>
            {rules.map((r) => <div key={r.id}>Rule #{r.id}: day {r.dayOfMonth}, amount {r.rentAmount}, enabled {String(r.enabled)}</div>)}
          </div>
        </Card>
      </Container>
    </Section>
  );
}
