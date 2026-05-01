import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { api, authHeader } from "../api/client";
import { getProperties } from "../api/ownedProperties";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

export function OwnedDocumentsPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState<number | "">("");
  const [documents, setDocuments] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("LEASE_AGREEMENT");
  const [error, setError] = useState("");

  async function loadProperties() {
    const rows = await getProperties();
    setProperties(rows);
    if (!propertyId && rows[0]) setPropertyId(rows[0].id);
  }
  async function loadDocs(pid: number) {
    const res = await api.get(`/properties/${pid}/documents`, { headers: authHeader() });
    setDocuments(res.data);
  }
  useEffect(() => { void loadProperties(); }, []);
  useEffect(() => { if (propertyId) void loadDocs(Number(propertyId)); }, [propertyId]);

  const upload = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!propertyId || !file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("documentType", documentType);
    try {
      await api.post(`/properties/${propertyId}/documents/upload`, form, { headers: { ...authHeader(), "Content-Type": "multipart/form-data" } });
      setFile(null);
      await loadDocs(Number(propertyId));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Upload failed");
    }
  };

  const remove = async (id: number) => {
    await api.delete(`/documents/${id}`, { headers: authHeader() });
    if (propertyId) await loadDocs(Number(propertyId));
  };

  return (
    <Section>
      <Helmet><title>Documents | The Property Guy</title></Helmet>
      <Container>
        <h1 className="pg-h2">Documents</h1>
        {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
        <Card>
          <Field label="Property"><select className="pg-input" value={propertyId} onChange={(e) => setPropertyId(Number(e.target.value))}>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <form onSubmit={upload}>
            <Field label="Document type"><select className="pg-input" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>{["LEASE_AGREEMENT", "ID_DOCUMENT", "PROOF_OF_PAYMENT", "MUNICIPAL_ACCOUNT", "INSURANCE", "INSPECTION", "OTHER"].map((d) => <option key={d}>{d}</option>)}</select></Field>
            <Field label="Upload file (PDF, DOC/DOCX, JPG/PNG, max 10MB)">
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Field>
            <Button type="submit">Upload</Button>
          </form>
        </Card>
        <div style={{ height: 12 }} />
        <Card title="Documents">
          <div style={{ display: "grid", gap: 8 }}>
            {documents.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <span>{d.fileName} ({d.documentType})</span>
                <span style={{ display: "flex", gap: 8 }}>
                  <a className="pg-btn pg-btn-ghost" href={`${import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"}/documents/${d.id}/download`}>Download</a>
                  <Button variant="ghost" onClick={() => remove(d.id)}>Delete</Button>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </Container>
    </Section>
  );
}
