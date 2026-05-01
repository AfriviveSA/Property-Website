import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useParams } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Input, Field } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import {
  createLease,
  createProperty,
  createPropertyTenant,
  getProperty,
  getTenants,
  linkTenantToProperty,
  unlinkTenantFromProperty,
  updateProperty
} from "../api/ownedProperties";

export function OwnedPropertyFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tenantMode, setTenantMode] = useState<"NONE" | "EXISTING" | "NEW">("NONE");
  const [tenants, setTenants] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    name: "",
    propertyType: "OTHER",
    investmentType: "LONG_TERM_RENTAL",
    addressLine1: "",
    city: "",
    province: "",
    country: "South Africa",
    purchasePrice: ""
  });
  const [tenantId, setTenantId] = useState<number | "">("");
  const [newTenant, setNewTenant] = useState<any>({ firstName: "", lastName: "", email: "", phone: "", idNumber: "" });
  const [linkedTenants, setLinkedTenants] = useState<any[]>([]);
  const [linkAnotherTenantId, setLinkAnotherTenantId] = useState<number | "">("");
  const [anotherNewTenant, setAnotherNewTenant] = useState<any>({ firstName: "", lastName: "", email: "", phone: "", idNumber: "" });
  const [createLeaseNow, setCreateLeaseNow] = useState(false);
  const [lease, setLease] = useState<any>({
    leaseType: "FIXED_TERM",
    startDate: "",
    fixedTermEndDate: "",
    monthlyRent: "",
    depositAmount: "",
    rentDueDay: 1
  });

  useEffect(() => {
    async function load() {
      if (!isEdit || !id) return;
      const data = await getProperty(id);
      // Prevent duplicate lease creation from the property edit form.
      // Lease management is handled inside View Property.
      setCreateLeaseNow(false);
      if (data?.currentTenant?.id) {
        setTenantMode("EXISTING");
        setTenantId(Number(data.currentTenant.id));
      }
      setForm({
        ...data,
        propertyType: data.propertyType ?? "OTHER",
        investmentType: data.investmentType ?? "LONG_TERM_RENTAL",
        purchasePrice: data.purchasePrice ?? "",
        currentEstimatedValue: data.currentEstimatedValue ?? "",
        outstandingBondBalance: data.outstandingBondBalance ?? "",
        monthlyBondPayment: data.monthlyBondPayment ?? ""
      });
      setLinkedTenants(data?.tenants ?? []);
    }
    void load();
  }, [id, isEdit]);

  useEffect(() => {
    void (async () => {
      try {
        setTenants(await getTenants());
      } catch {
        setTenants([]);
      }
    })();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      // 1) Save the property itself first
      const propertyPayload: any = { ...form, propertyType: form.propertyType ?? "OTHER" };
      const saved = isEdit && id ? await updateProperty(id, propertyPayload) : await createProperty(propertyPayload);
      const propertyId = isEdit && id ? id : saved?.id;

      // 2) Tenant linking / creation (separate endpoints for reliability)
      let resolvedTenantId: number | null = null;
      if (tenantMode === "EXISTING" && tenantId) {
        await linkTenantToProperty(propertyId, tenantId);
        resolvedTenantId = Number(tenantId);
      }
      if (tenantMode === "NEW") {
        const created = await createPropertyTenant(propertyId, {
          firstName: newTenant.firstName,
          lastName: newTenant.lastName,
          email: newTenant.email || undefined,
          phone: newTenant.phone || undefined,
          idNumber: newTenant.idNumber || undefined,
          status: "ACTIVE"
        });
        resolvedTenantId = created?.id ?? null;
      }

      // 3) Optional lease creation
      if (createLeaseNow && resolvedTenantId && lease.startDate) {
        await createLease(propertyId, {
          tenantId: resolvedTenantId,
          leaseType: lease.leaseType,
          startDate: lease.startDate,
          fixedTermEndDate: lease.leaseType === "FIXED_TERM" ? lease.fixedTermEndDate : undefined,
          monthlyRent: lease.monthlyRent,
          depositAmount: lease.depositAmount,
          rentDueDay: lease.rentDueDay
        });
      }

      // After creating a property, push the user into the universal "View Property" flow
      if (!isEdit) navigate(`/owned-properties/${propertyId}?tab=financials`);
      else navigate(`/owned-properties/${propertyId}?tab=overview`);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to save property.");
    } finally {
      setSaving(false);
    }
  };

  const refreshLinkedTenants = async () => {
    if (!isEdit || !id) return;
    const data = await getProperty(id);
    setLinkedTenants(data?.tenants ?? []);
  };

  const linkAnotherTenant = async () => {
    if (!id || !linkAnotherTenantId) return;
    try {
      await linkTenantToProperty(id, linkAnotherTenantId);
      setLinkAnotherTenantId("");
      await refreshLinkedTenants();
    } catch (e: any) {
      window.alert(e?.response?.data?.message ?? "Failed to link tenant.");
    }
  };

  const addAnotherTenant = async () => {
    if (!id) return;
    if (!anotherNewTenant.firstName || !anotherNewTenant.lastName) return;
    try {
      await createPropertyTenant(id, {
        firstName: anotherNewTenant.firstName,
        lastName: anotherNewTenant.lastName,
        email: anotherNewTenant.email || undefined,
        phone: anotherNewTenant.phone || undefined,
        idNumber: anotherNewTenant.idNumber || undefined,
        status: "ACTIVE"
      });
      setAnotherNewTenant({ firstName: "", lastName: "", email: "", phone: "", idNumber: "" });
      await refreshLinkedTenants();
    } catch (e: any) {
      window.alert(e?.response?.data?.message ?? "Failed to add tenant.");
    }
  };

  const unlinkTenant = async (tenantId: number) => {
    if (!id) return;
    if (!window.confirm("Unlink this tenant from the property? (Active leases may block this.)")) return;
    try {
      await unlinkTenantFromProperty(id, tenantId);
      await refreshLinkedTenants();
    } catch (e: any) {
      window.alert(e?.response?.data?.message ?? "Failed to unlink tenant.");
    }
  };

  return (
    <Section>
      <Helmet><title>{isEdit ? "Edit Property" : "Add Property"} | The Property Guy</title></Helmet>
      <Container>
        <Card>
          <h1 className="pg-h2">{isEdit ? "Edit Property" : "Add Property"}</h1>
          {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
          {isEdit && id ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <a className="pg-btn pg-btn-ghost" href={`/owned-properties/${id}?tab=tenants`}>View Property → Tenants</a>
              <a className="pg-btn pg-btn-ghost" href={`/owned-properties/${id}?tab=financials`}>View Property → Financials</a>
              <a className="pg-btn pg-btn-ghost" href={`/financials?propertyId=${id}`}>Open Financials Page</a>
            </div>
          ) : null}
          <form onSubmit={submit}>
            <Field label="Property name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Property type">
              <select className="pg-input" value={form.investmentType} onChange={(e) => setForm({ ...form, investmentType: e.target.value })}>
                <option value="LONG_TERM_RENTAL">Long-Term Rental</option>
                <option value="SHORT_TERM_RENTAL">Airbnb / Short-Term Rental</option>
                <option value="PRIMARY_RESIDENCE">Primary Residence</option>
                <option value="HOUSE_HACK">House Hack</option>
                <option value="BRRRR">BRRRR Property</option>
                <option value="FLIP">Flip / Renovation Project</option>
                <option value="VACANT_LAND">Vacant Land</option>
                <option value="COMMERCIAL">Commercial Property</option>
                <option value="MIXED_USE">Mixed Use</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Address line 1"><Input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} required /></Field>
            <Field label="Address line 2"><Input value={form.addressLine2 ?? ""} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} /></Field>
            <Field label="Suburb"><Input value={form.suburb ?? ""} onChange={(e) => setForm({ ...form, suburb: e.target.value })} /></Field>
            <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required /></Field>
            <Field label="Province"><Input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} required /></Field>
            <Field label="Postal code"><Input value={form.postalCode ?? ""} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></Field>
            <Field label="Country"><Input value={form.country ?? "South Africa"} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
            <Field label="Purchase price"><Input type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} required /></Field>
            <Field label="Purchase date"><Input type="date" value={form.purchaseDate?.slice?.(0, 10) ?? ""} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} /></Field>
            <Field label="Current estimated value"><Input type="number" value={form.currentEstimatedValue} onChange={(e) => setForm({ ...form, currentEstimatedValue: Number(e.target.value) })} /></Field>
            <Field label="Outstanding bond balance"><Input type="number" value={form.outstandingBondBalance} onChange={(e) => setForm({ ...form, outstandingBondBalance: Number(e.target.value) })} /></Field>
            <Field label="Monthly bond payment"><Input type="number" value={form.monthlyBondPayment} onChange={(e) => setForm({ ...form, monthlyBondPayment: Number(e.target.value) })} /></Field>
            <Field label="Notes"><Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>

            <div style={{ height: 10 }} />
            <h3 className="pg-h3" style={{ margin: "8px 0" }}>Investment assumptions</h3>
            <div className="pg-muted" style={{ marginBottom: 8 }}>
              Total cash invested should include deposit plus purchasing costs (Bond, renovation and Transfer costs), furnishings and other out-of-pocket acquisition costs.
            </div>
            <Field label="Total cash invested">
              <Input type="number" value={form.totalCashInvested ?? ""} onChange={(e) => setForm({ ...form, totalCashInvested: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
            <Field label="Bond costs (once-off)">
              <Input type="number" value={form.bondCosts ?? ""} onChange={(e) => setForm({ ...form, bondCosts: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
            <Field label="Transfer costs (once-off)">
              <Input type="number" value={form.transferCosts ?? ""} onChange={(e) => setForm({ ...form, transferCosts: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
            <Field label="Expected annual appreciation %">
              <Input type="number" value={form.expectedAnnualAppreciationPercent ?? ""} onChange={(e) => setForm({ ...form, expectedAnnualAppreciationPercent: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
            <Field label="Holding period (years)">
              <Input type="number" value={form.holdingPeriodYears ?? ""} onChange={(e) => setForm({ ...form, holdingPeriodYears: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
            <Field label="Estimated selling cost %">
              <Input type="number" value={form.estimatedSellingCostPercent ?? ""} onChange={(e) => setForm({ ...form, estimatedSellingCostPercent: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>

            {form.investmentType === "VACANT_LAND" ? (
              <>
                <div style={{ height: 10 }} />
                <h3 className="pg-h3" style={{ margin: "8px 0" }}>Vacant Land</h3>
                <Field label="Land use">
                  <select className="pg-input" value={form.landUse ?? ""} onChange={(e) => setForm({ ...form, landUse: e.target.value || null })}>
                    <option value="">Unknown</option>
                    <option value="RESIDENTIAL">Residential</option>
                    <option value="AGRICULTURAL">Agricultural</option>
                    <option value="COMMERCIAL">Commercial</option>
                    <option value="INDUSTRIAL">Industrial</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="Zoning (optional)"><Input value={form.zoning ?? ""} onChange={(e) => setForm({ ...form, zoning: e.target.value })} /></Field>
                <Field label="Rates & taxes (monthly)"><Input type="number" value={form.ratesAndTaxesMonthly ?? ""} onChange={(e) => setForm({ ...form, ratesAndTaxesMonthly: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Levies (monthly)"><Input type="number" value={form.leviesMonthly ?? ""} onChange={(e) => setForm({ ...form, leviesMonthly: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Security (monthly)"><Input type="number" value={form.securityMonthly ?? ""} onChange={(e) => setForm({ ...form, securityMonthly: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Maintenance (monthly)"><Input type="number" value={form.maintenanceMonthly ?? ""} onChange={(e) => setForm({ ...form, maintenanceMonthly: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Expected annual appreciation % (optional)"><Input type="number" value={form.expectedAnnualAppreciationPercent ?? ""} onChange={(e) => setForm({ ...form, expectedAnnualAppreciationPercent: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
              </>
            ) : null}

            {form.investmentType === "SHORT_TERM_RENTAL" ? (
              <>
                <div style={{ height: 10 }} />
                <h3 className="pg-h3" style={{ margin: "8px 0" }}>Short-Term Rental</h3>
                <Field label="Average daily rate (ADR)"><Input type="number" value={form.averageDailyRate ?? ""} onChange={(e) => setForm({ ...form, averageDailyRate: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Occupancy rate (0 to 1)"><Input type="number" value={form.occupancyRate ?? ""} onChange={(e) => setForm({ ...form, occupancyRate: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Available nights per month"><Input type="number" value={form.availableNightsPerMonth ?? ""} onChange={(e) => setForm({ ...form, availableNightsPerMonth: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Platform fee %"><Input type="number" value={form.platformFeePercent ?? ""} onChange={(e) => setForm({ ...form, platformFeePercent: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Management fee %"><Input type="number" value={form.managementFeePercent ?? ""} onChange={(e) => setForm({ ...form, managementFeePercent: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Cleaning fees (monthly)"><Input type="number" value={form.cleaningFeesMonthly ?? ""} onChange={(e) => setForm({ ...form, cleaningFeesMonthly: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Monthly utilities"><Input type="number" value={form.monthlyUtilities ?? ""} onChange={(e) => setForm({ ...form, monthlyUtilities: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Furnishing value (optional)"><Input type="number" value={form.furnishingValue ?? ""} onChange={(e) => setForm({ ...form, furnishingValue: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
              </>
            ) : null}

            {form.investmentType === "FLIP" ? (
              <>
                <div style={{ height: 10 }} />
                <h3 className="pg-h3" style={{ margin: "8px 0" }}>Flip / Renovation Project</h3>
                <Field label="Project stage">
                  <select className="pg-input" value={form.projectStage ?? ""} onChange={(e) => setForm({ ...form, projectStage: e.target.value || null })}>
                    <option value="">Unknown</option>
                    <option value="ACQUISITION">Acquisition</option>
                    <option value="RENOVATION">Renovation</option>
                    <option value="FOR_SALE">For Sale</option>
                    <option value="SOLD">Sold</option>
                  </select>
                </Field>
                <Field label="Rehab budget"><Input type="number" value={form.rehabBudget ?? ""} onChange={(e) => setForm({ ...form, rehabBudget: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Holding costs (monthly)"><Input type="number" value={form.holdingCostsMonthly ?? ""} onChange={(e) => setForm({ ...form, holdingCostsMonthly: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Expected sale price"><Input type="number" value={form.expectedSalePrice ?? ""} onChange={(e) => setForm({ ...form, expectedSalePrice: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Target sale date"><Input type="date" value={form.targetSaleDate?.slice?.(0, 10) ?? ""} onChange={(e) => setForm({ ...form, targetSaleDate: e.target.value })} /></Field>
              </>
            ) : null}

            {form.investmentType === "BRRRR" ? (
              <>
                <div style={{ height: 10 }} />
                <h3 className="pg-h3" style={{ margin: "8px 0" }}>BRRRR</h3>
                <Field label="Stage">
                  <select className="pg-input" value={form.brrrrStage ?? ""} onChange={(e) => setForm({ ...form, brrrrStage: e.target.value || null })}>
                    <option value="">Unknown</option>
                    <option value="ACQUISITION">Acquisition</option>
                    <option value="RENOVATION">Renovation</option>
                    <option value="RENTED">Rented</option>
                    <option value="REFINANCED">Refinanced</option>
                  </select>
                </Field>
                <Field label="Rehab budget"><Input type="number" value={form.rehabBudget ?? ""} onChange={(e) => setForm({ ...form, rehabBudget: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="After repair value (ARV)"><Input type="number" value={form.afterRepairValue ?? ""} onChange={(e) => setForm({ ...form, afterRepairValue: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Refinance amount"><Input type="number" value={form.refinanceAmount ?? ""} onChange={(e) => setForm({ ...form, refinanceAmount: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
              </>
            ) : null}

            <div style={{ height: 10 }} />
            {["LONG_TERM_RENTAL", "HOUSE_HACK", "COMMERCIAL", "MIXED_USE", "OTHER"].includes(form.investmentType) || (form.investmentType === "BRRRR" && ["RENTED", "REFINANCED"].includes(form.brrrrStage ?? "")) ? (
              <>
            <h3 className="pg-h3" style={{ margin: "8px 0" }}>Tenant</h3>
            {isEdit ? (
              <Card title="Tenants linked to this property">
                {(linkedTenants?.length ?? 0) ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {linkedTenants.map((t: any) => (
                      <div key={t.id} style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div>
                            <div><strong>{t.firstName} {t.lastName}</strong> <span className="pg-muted">({t.status})</span></div>
                            <div className="pg-muted">{t.phone ? `Phone: ${t.phone}` : "Phone: -"} {t.email ? `| Email: ${t.email}` : ""}</div>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <a className="pg-btn pg-btn-ghost" href={`/tenants/${t.id}/edit`}>Edit</a>
                            <button className="pg-btn pg-btn-ghost" type="button" onClick={() => void unlinkTenant(t.id)}>Unlink</button>
                          </div>
                        </div>
                        <div className="pg-muted">{t.phone ? `Phone: ${t.phone}` : "Phone: -"} {t.email ? `| Email: ${t.email}` : ""}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pg-muted">No tenants linked yet.</div>
                )}
                <div style={{ height: 10 }} />
                <div className="pg-muted" style={{ marginBottom: 6 }}>Link existing tenant (unlinked only)</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select className="pg-input" value={linkAnotherTenantId} onChange={(e) => setLinkAnotherTenantId(e.target.value === "" ? "" : Number(e.target.value))}>
                    <option value="">Select tenant</option>
                    {tenants.filter((t: any) => t.propertyId == null).map((t: any) => (
                      <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                    ))}
                  </select>
                  <button className="pg-btn pg-btn-primary" type="button" onClick={() => void linkAnotherTenant()} disabled={!linkAnotherTenantId}>Link tenant</button>
                </div>
                <div style={{ height: 10 }} />
                <div className="pg-muted" style={{ marginBottom: 6 }}>Add new tenant</div>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                  <Input placeholder="First name" value={anotherNewTenant.firstName} onChange={(e) => setAnotherNewTenant({ ...anotherNewTenant, firstName: e.target.value })} />
                  <Input placeholder="Last name" value={anotherNewTenant.lastName} onChange={(e) => setAnotherNewTenant({ ...anotherNewTenant, lastName: e.target.value })} />
                  <Input placeholder="Email (optional)" value={anotherNewTenant.email} onChange={(e) => setAnotherNewTenant({ ...anotherNewTenant, email: e.target.value })} />
                  <Input placeholder="Phone (optional)" value={anotherNewTenant.phone} onChange={(e) => setAnotherNewTenant({ ...anotherNewTenant, phone: e.target.value })} />
                </div>
                <div style={{ marginTop: 8 }}>
                  <button className="pg-btn pg-btn-secondary" type="button" onClick={() => void addAnotherTenant()} disabled={!anotherNewTenant.firstName || !anotherNewTenant.lastName}>
                    Add tenant
                  </button>
                </div>
              </Card>
            ) : null}
            <Field label="Tenant option">
              <select className="pg-input" value={tenantMode} onChange={(e) => setTenantMode(e.target.value as any)}>
                <option value="NONE">No tenant yet</option>
                <option value="EXISTING">Select existing tenant</option>
                <option value="NEW">Add new tenant</option>
              </select>
            </Field>
            {tenantMode === "EXISTING" ? (
              <Field label="Existing tenant">
                <select className="pg-input" value={tenantId} onChange={(e) => setTenantId(Number(e.target.value))}>
                  <option value="">Select tenant</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName} {t.property?.name ? `(${t.property.name})` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {tenantMode === "NEW" ? (
              <>
                <Field label="First name"><Input value={newTenant.firstName} onChange={(e) => setNewTenant({ ...newTenant, firstName: e.target.value })} required /></Field>
                <Field label="Last name"><Input value={newTenant.lastName} onChange={(e) => setNewTenant({ ...newTenant, lastName: e.target.value })} required /></Field>
                <Field label="Email (optional)"><Input value={newTenant.email} onChange={(e) => setNewTenant({ ...newTenant, email: e.target.value })} /></Field>
                <Field label="Phone (optional)"><Input value={newTenant.phone} onChange={(e) => setNewTenant({ ...newTenant, phone: e.target.value })} /></Field>
                <Field label="ID number (optional)"><Input value={newTenant.idNumber} onChange={(e) => setNewTenant({ ...newTenant, idNumber: e.target.value })} /></Field>
              </>
            ) : null}

            {tenantMode !== "NONE" ? (
              <>
                <div style={{ height: 10 }} />
                <h3 className="pg-h3" style={{ margin: "8px 0" }}>Lease details (optional)</h3>
                {isEdit ? (
                  <div className="pg-muted" style={{ marginBottom: 8 }}>
                    Lease creation/editing is managed in <strong>View Property → Lease</strong> to prevent duplicates.
                  </div>
                ) : null}
                <Field label="Create lease now?">
                  <select
                    className="pg-input"
                    value={createLeaseNow ? "YES" : "NO"}
                    onChange={(e) => setCreateLeaseNow(e.target.value === "YES")}
                    disabled={isEdit}
                  >
                    <option value="NO">No</option>
                    <option value="YES">Yes</option>
                  </select>
                </Field>
                {createLeaseNow ? (
                  <>
                <Field label="Lease type">
                  <select className="pg-input" value={lease.leaseType} onChange={(e) => setLease({ ...lease, leaseType: e.target.value })}>
                    <option value="FIXED_TERM">Fixed term</option>
                    <option value="MONTH_TO_MONTH">Month-to-month</option>
                  </select>
                </Field>
                <Field label="Start date"><Input type="date" value={lease.startDate} onChange={(e) => setLease({ ...lease, startDate: e.target.value })} /></Field>
                {lease.leaseType === "FIXED_TERM" ? (
                  <Field label="Fixed term end date">
                    <Input type="date" value={lease.fixedTermEndDate} onChange={(e) => setLease({ ...lease, fixedTermEndDate: e.target.value })} />
                  </Field>
                ) : null}
                <Field label="Monthly rent"><Input type="number" value={lease.monthlyRent} onChange={(e) => setLease({ ...lease, monthlyRent: Number(e.target.value) })} /></Field>
                <Field label="Deposit amount"><Input type="number" value={lease.depositAmount} onChange={(e) => setLease({ ...lease, depositAmount: Number(e.target.value) })} /></Field>
                <Field label="Rent due day"><Input type="number" value={lease.rentDueDay} onChange={(e) => setLease({ ...lease, rentDueDay: Number(e.target.value) })} /></Field>
                  </>
                ) : null}
              </>
            ) : null}
              </>
            ) : (
              <div className="pg-muted" style={{ marginTop: 6 }}>
                Tenant/lease not required for this property type.
              </div>
            )}

            <Button type="submit" loading={saving}>{isEdit ? "Update Property" : "Create Property"}</Button>
          </form>
        </Card>
      </Container>
    </Section>
  );
}
