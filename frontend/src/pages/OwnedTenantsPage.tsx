import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { createPropertyTenant, getProperties, getPropertyTenants } from "../api/ownedProperties";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

export function OwnedTenantsPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState<number | "">("");
  const [tenants, setTenants] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ firstName: "", lastName: "", email: "", phone: "", status: "APPLICANT" });

  async function loadProperties() {
    const data = await getProperties();
    setProperties(data);
    if (!propertyId && data[0]) setPropertyId(data[0].id);
  }

  async function loadTenants(pid: number) {
    setTenants(await getPropertyTenants(pid));
  }

  useEffect(() => {
    void loadProperties();
  }, []);
  useEffect(() => {
    if (propertyId) void loadTenants(Number(propertyId));
  }, [propertyId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    await createPropertyTenant(propertyId, form);
    setForm({ firstName: "", lastName: "", email: "", phone: "", status: "ACTIVE" });
    await loadTenants(Number(propertyId));
  };

  return (
    <Section>
      <Helmet><title>Tenants | The Property Guy</title></Helmet>
      <Container>
        <h1 className="pg-h2">Tenants</h1>
        <Card>
          <Field label="Property">
            <select className="pg-input" value={propertyId} onChange={(e) => setPropertyId(Number(e.target.value))}>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <form onSubmit={submit}>
            <Field label="First name"><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></Field>
            <Field label="Last name"><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></Field>
            <Field label="Email (optional)"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone (optional)"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Button type="submit">Add Tenant</Button>
          </form>
        </Card>
        <div style={{ height: 12 }} />
        <Card title="Tenant records">
          <div style={{ display: "grid", gap: 8 }}>
            {tenants.map((t) => (
              <div key={t.id}>
                {t.firstName} {t.lastName} {t.currentLease?.displayStatus ? `| ${t.currentLease.displayStatus}` : ""} {t.email ? `| ${t.email}` : ""} {t.status ? `| ${t.status}` : ""}
              </div>
            ))}
          </div>
        </Card>
      </Container>
    </Section>
  );
}
