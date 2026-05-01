import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { api, authHeader } from "../api/client";
import { getProperties } from "../api/ownedProperties";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

export function OwnedInvoicesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState<number | "">("");
  const [tenants, setTenants] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    tenantId: "",
    invoiceDate: "",
    dueDate: "",
    notes: "",
    lineItems: [{ description: "Monthly Rent", quantity: 1, unitPrice: 0, total: 0 }]
  });

  async function loadProperties() {
    const rows = await getProperties();
    setProperties(rows);
    if (!propertyId && rows[0]) setPropertyId(rows[0].id);
  }
  async function loadData(pid: number) {
    const [t, i] = await Promise.all([
      api.get(`/properties/${pid}/tenants`, { headers: authHeader() }),
      api.get(`/properties/${pid}/invoices`, { headers: authHeader() })
    ]);
    setTenants(t.data);
    setInvoices(i.data);
  }
  useEffect(() => { void loadProperties(); }, []);
  useEffect(() => { if (propertyId) void loadData(Number(propertyId)); }, [propertyId]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    await api.post(`/properties/${propertyId}/invoices`, form, { headers: authHeader() });
    await loadData(Number(propertyId));
  };
  const generatePdf = async (id: number) => {
    await api.post(`/invoices/${id}/generate-pdf`, {}, { headers: authHeader() });
    await loadData(Number(propertyId));
  };
  const markPaid = async (id: number) => {
    await api.post(`/invoices/${id}/mark-paid`, {}, { headers: authHeader() });
    await loadData(Number(propertyId));
  };
  const sendEmail = async (id: number) => {
    await api.post(`/invoices/${id}/send-email`, {}, { headers: authHeader() });
    await loadData(Number(propertyId));
  };

  return (
    <Section>
      <Helmet><title>Invoices | The Property Guy</title></Helmet>
      <Container>
        <h1 className="pg-h2">Invoices</h1>
        <Card>
          <Field label="Property"><select className="pg-input" value={propertyId} onChange={(e) => setPropertyId(Number(e.target.value))}>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <form onSubmit={create}>
            <Field label="Tenant"><select className="pg-input" value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: Number(e.target.value) })}>{tenants.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}</select></Field>
            <Field label="Invoice date"><Input type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} required /></Field>
            <Field label="Due date"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required /></Field>
            <Field label="Description"><Input value={form.lineItems[0].description} onChange={(e) => setForm({ ...form, lineItems: [{ ...form.lineItems[0], description: e.target.value }] })} /></Field>
            <Field label="Amount"><Input type="number" value={form.lineItems[0].unitPrice} onChange={(e) => setForm({ ...form, lineItems: [{ ...form.lineItems[0], unitPrice: Number(e.target.value), total: Number(e.target.value) }] })} required /></Field>
            <Button type="submit">Create Invoice</Button>
          </form>
        </Card>
        <div style={{ height: 12 }} />
        <Card title="Invoice list">
          <div style={{ display: "grid", gap: 10 }}>
            {invoices.map((inv) => (
              <div key={inv.id} style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 10 }}>
                <div>{inv.invoiceNumber} - {inv.status} - Total: {inv.total}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <Button variant="ghost" onClick={() => generatePdf(inv.id)}>Generate PDF</Button>
                  <a className="pg-btn pg-btn-ghost" href={`${import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"}/invoices/${inv.id}/download`}>Download PDF</a>
                  <Button variant="ghost" onClick={() => markPaid(inv.id)}>Mark Paid</Button>
                  <Button variant="ghost" onClick={() => sendEmail(inv.id)}>Send Email</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Container>
    </Section>
  );
}
