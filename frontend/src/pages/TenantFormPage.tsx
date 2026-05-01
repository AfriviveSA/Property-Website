import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { createTenant, getProperties, getTenant, updateTenant } from "../api/ownedProperties";

export function TenantFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [properties, setProperties] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    idNumber: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    status: "ACTIVE",
    propertyId: ""
  });

  useEffect(() => {
    void (async () => {
      try {
        setProperties(await getProperties());
      } catch {
        setProperties([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    void (async () => {
      try {
        const data = await getTenant(id);
        setForm({
          firstName: data.tenant.firstName ?? "",
          lastName: data.tenant.lastName ?? "",
          email: data.tenant.email ?? "",
          phone: data.tenant.phone ?? "",
          idNumber: data.tenant.idNumber ?? "",
          emergencyContactName: data.tenant.emergencyContactName ?? "",
          emergencyContactPhone: data.tenant.emergencyContactPhone ?? "",
          status: data.tenant.status ?? "ACTIVE",
          propertyId: data.tenant.propertyId ?? ""
        });
      } catch (e: any) {
        setError(e?.response?.data?.message ?? "Failed to load tenant.");
      }
    })();
  }, [id, isEdit]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload: any = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        idNumber: form.idNumber || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContactPhone: form.emergencyContactPhone || undefined,
        status: form.status,
        propertyId: form.propertyId === "" ? null : Number(form.propertyId)
      };
      if (isEdit && id) {
        await updateTenant(id, payload);
        navigate(`/tenants/${id}`);
      } else {
        const created = await createTenant(payload);
        navigate(`/tenants/${created.id}`);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to save tenant.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section>
      <Helmet><title>{isEdit ? "Edit Tenant" : "Add Tenant"} | The Property Guy</title></Helmet>
      <Container>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <h1 className="pg-h2" style={{ margin: 0 }}>{isEdit ? "Edit Tenant" : "Add Tenant"}</h1>
            <Link className="pg-btn pg-btn-ghost" to="/tenants">Back to tenants</Link>
          </div>
          {error ? <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>{error}</div> : null}
          <form onSubmit={submit} style={{ marginTop: 12 }}>
            <Field label="First name"><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></Field>
            <Field label="Last name"><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></Field>
            <Field label="Email (optional)"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone (optional)"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="ID number (optional)"><Input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} /></Field>
            <Field label="Emergency contact name (optional)"><Input value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} /></Field>
            <Field label="Emergency contact phone (optional)"><Input value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} /></Field>
            <Field label="Status">
              <select className="pg-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {["ACTIVE", "APPLICANT", "PAST"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Linked property (only allowed if no current lease)">
              <select className="pg-input" value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value })}>
                <option value="">None</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Button type="submit" loading={saving}>{isEdit ? "Save changes" : "Create tenant"}</Button>
          </form>
        </Card>
      </Container>
    </Section>
  );
}

