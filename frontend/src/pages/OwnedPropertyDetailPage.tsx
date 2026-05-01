import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { api, authHeader } from "../api/client";
import {
  cancelLease,
  createPropertyTenant,
  deleteLease,
  deletePropertyExpense,
  deletePropertyIncome,
  getProperty,
  getTenants,
  linkTenantToProperty,
  updatePropertyIncome,
  updateLease,
  unlinkTenantFromProperty
} from "../api/ownedProperties";

export function OwnedPropertyDetailPage() {
  const { id } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [allTenants, setAllTenants] = useState<any[]>([]);
  const [linkTenantId, setLinkTenantId] = useState<number | "">("");
  const [newTenant, setNewTenant] = useState<any>({ firstName: "", lastName: "", email: "", phone: "", idNumber: "" });
  const tab = useMemo(() => new URLSearchParams(search).get("tab") ?? "overview", [search]);
  const monthBounds = useMemo(() => {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1)
    };
  }, []);

  const reload = async () => {
    if (!id) return;
    try {
      setData(await getProperty(id));
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to load property.");
    }
  };

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        setData(await getProperty(id));
        setAllTenants(await getTenants());
      } catch (e: any) {
        setError(e?.response?.data?.message ?? "Failed to load property.");
      }
    }
    void load();
  }, [id]);

  const onCancelLease = async () => {
    if (!data?.currentLease?.id) return;
    const cancellationDate = window.prompt("Cancellation date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!cancellationDate) return;
    const cancellationReason = window.prompt("Cancellation reason (optional)", "") ?? undefined;
    await cancelLease(data.currentLease.id, { cancellationDate, cancellationReason, cancelledBy: "LANDLORD" });
    await reload();
  };

  const onDeleteExpense = async (expenseId: number) => {
    if (!window.confirm("Delete this expense entry?")) return;
    await deletePropertyExpense(expenseId);
    await reload();
  };

  const onDeleteIncome = async (incomeId: number) => {
    if (!window.confirm("Delete this income entry?")) return;
    await deletePropertyIncome(incomeId);
    await reload();
  };

  const onEditIncome = async (inc: any) => {
    const amount = window.prompt("Amount (number)", String(inc.amount ?? 0));
    if (amount == null) return;
    const incomeDate = window.prompt("Income date (YYYY-MM-DD)", inc.incomeDate ? String(inc.incomeDate).slice(0, 10) : new Date().toISOString().slice(0, 10));
    if (!incomeDate) return;
    const description = window.prompt("Description", inc.description ?? "") ?? inc.description;
    try {
      await updatePropertyIncome(inc.id, { amount: Number(amount), incomeDate, description });
      await reload();
    } catch (e: any) {
      window.alert(e?.response?.data?.message ?? "Failed to update income.");
    }
  };

  const onUnlinkTenant = async (tenantId: number) => {
    if (!id) return;
    if (!window.confirm("Unlink this tenant from the property? (Active leases may block this.)")) return;
    try {
      await unlinkTenantFromProperty(id, tenantId);
      await reload();
    } catch (e: any) {
      window.alert(e?.response?.data?.message ?? "Failed to unlink tenant.");
    }
  };

  const onLinkExistingTenant = async () => {
    if (!id || !linkTenantId) return;
    await linkTenantToProperty(id, linkTenantId);
    setLinkTenantId("");
    await reload();
  };

  const onAddNewTenant = async () => {
    if (!id) return;
    if (!newTenant.firstName || !newTenant.lastName) return;
    await createPropertyTenant(id, {
      firstName: newTenant.firstName,
      lastName: newTenant.lastName,
      email: newTenant.email || undefined,
      phone: newTenant.phone || undefined,
      idNumber: newTenant.idNumber || undefined,
      status: "ACTIVE"
    });
    setNewTenant({ firstName: "", lastName: "", email: "", phone: "", idNumber: "" });
    await reload();
  };

  const onArchiveLease = async (leaseId: number) => {
    if (!window.confirm("Archive this lease? (Historical record is kept.)")) return;
    await deleteLease(leaseId);
    await reload();
  };

  const onEditLease = async (lease: any) => {
    if (!lease?.id) return;
    const leaseType = window.prompt("Lease type (FIXED_TERM or MONTH_TO_MONTH)", lease.leaseType ?? "FIXED_TERM");
    if (!leaseType) return;
    const startDate = window.prompt("Start date (YYYY-MM-DD)", lease.startDate ? String(lease.startDate).slice(0, 10) : new Date().toISOString().slice(0, 10));
    if (!startDate) return;
    const fixedTermEndDate =
      leaseType === "FIXED_TERM"
        ? window.prompt(
            "Fixed term end date (YYYY-MM-DD)",
            lease.fixedTermEndDate ? String(lease.fixedTermEndDate).slice(0, 10) : ""
          )
        : "";

    const monthlyRent = window.prompt("Monthly rent (number)", String(lease.monthlyRent ?? 0));
    if (monthlyRent == null) return;
    const depositAmount = window.prompt("Deposit amount (number)", String(lease.depositAmount ?? 0));
    if (depositAmount == null) return;
    const rentDueDay = window.prompt("Rent due day (1-31)", String(lease.rentDueDay ?? 1));
    if (rentDueDay == null) return;
    const notes = window.prompt("Notes (optional)", lease.notes ?? "") ?? undefined;

    try {
      await updateLease(lease.id, {
        leaseType,
        startDate,
        fixedTermEndDate: leaseType === "FIXED_TERM" ? fixedTermEndDate || null : null,
        monthlyRent: Number(monthlyRent),
        depositAmount: Number(depositAmount),
        rentDueDay: Number(rentDueDay),
        notes
      });
      await reload();
    } catch (e: any) {
      window.alert(e?.response?.data?.message ?? "Failed to update lease.");
    }
  };

  const onAddReceivedIncomeForTenant = async (tenantId: number) => {
    if (!id) return;
    const amount = window.prompt("Amount received (number)", "");
    if (!amount) return;
    const incomeDate = window.prompt("Income date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!incomeDate) return;
    try {
      await api.post(
        `/properties/${id}/income`,
        { tenantId, category: "RENT", description: "Rent received", amount: Number(amount), incomeDate, source: "MANUAL_FINANCIAL_ENTRY", status: "RECEIVED" },
        { headers: authHeader() }
      );
      await reload();
    } catch (e: any) {
      window.alert(e?.response?.data?.message ?? "Failed to add income.");
    }
  };

  return (
    <Section>
      <Helmet><title>Property Detail | The Property Guy</title></Helmet>
      <Container>
        {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
        {data ? (
          <>
            <h1 className="pg-h2" style={{ marginTop: 0 }}>{data.name}</h1>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {["overview", "tenants", "lease", "financials", "invoices", "documents"].map((k) => (
                <Link key={k} to={`/owned-properties/${id}?tab=${k}`} className={`pg-btn ${tab === k ? "pg-btn-primary" : "pg-btn-ghost"}`}>{k[0].toUpperCase() + k.slice(1)}</Link>
              ))}
            </div>
            <Card>
              {tab === "overview" ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div>Address: {data.addressLine1}, {data.city}</div>
                    <div>Purchase price: {Number(data.purchasePrice ?? 0).toLocaleString()}</div>
                    <div>Current value: {data.currentEstimatedValue == null ? <span className="pg-muted">Missing</span> : Number(data.currentEstimatedValue).toLocaleString()}</div>
                  </div>

                  <Card title="Tenant & Lease">
                    {data.currentTenant ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        {(data.tenants?.length ?? 0) > 1 ? (
                          <div className="pg-muted">
                            <strong>All linked tenants</strong>:{" "}
                            {data.tenants.map((t: any) => (
                              <span key={t.id}>
                                <Link to={`/tenants/${t.id}`} className="pg-link">{t.firstName} {t.lastName}</Link>{" "}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div>
                          <strong>Tenant</strong>:{" "}
                          <Link to={`/tenants/${data.currentTenant.id}`} className="pg-link">
                            {data.currentTenant.firstName} {data.currentTenant.lastName}
                          </Link>
                        </div>
                        <div className="pg-muted">
                          {data.currentTenant.phone ? `Phone: ${data.currentTenant.phone}` : "Phone: -"}{" "}
                          {data.currentTenant.email ? `| Email: ${data.currentTenant.email}` : ""}
                        </div>
                        {data.currentLease ? (
                          <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                            <div><strong>Lease status</strong>: {data.currentLease.displayStatus ?? data.currentLease.status}</div>
                            <div><strong>Lease type</strong>: {data.currentLease.leaseType}</div>
                            <div><strong>Start date</strong>: {new Date(data.currentLease.startDate).toLocaleDateString()}</div>
                            <div><strong>Fixed term end</strong>: {data.currentLease.fixedTermEndDate ? new Date(data.currentLease.fixedTermEndDate).toLocaleDateString() : <span className="pg-muted">Month-to-month</span>}</div>
                            <div><strong>Monthly rent</strong>: R {Number(data.currentLease.monthlyRent ?? 0).toLocaleString()}</div>
                            <div><strong>Deposit held</strong>: R {Number(data.currentLease.depositAmount ?? 0).toLocaleString()}</div>
                            <div><strong>Rent due day</strong>: {data.currentLease.rentDueDay}</div>
                          </div>
                        ) : (
                          <div className="pg-muted" style={{ marginTop: 6 }}>No current lease linked.</div>
                        )}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                          <button className="pg-btn pg-btn-ghost" type="button" onClick={() => navigate(`/tenants/${data.currentTenant.id}/edit`)}>Edit Tenant</button>
                          <Link className="pg-btn pg-btn-ghost" to={`/owned-properties/${id}/edit`}>Edit Property</Link>
                          <Link className="pg-btn pg-btn-ghost" to={`/leases`}>Create Lease</Link>
                          {data.currentLease ? (
                            <button className="pg-btn pg-btn-secondary" type="button" onClick={() => void onCancelLease()}>
                              Cancel Lease
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div className="pg-muted">No tenant linked to this property.</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Link className="pg-btn pg-btn-ghost" to={`/owned-properties/${id}/edit`}>Link Existing Tenant</Link>
                          <Link className="pg-btn pg-btn-primary" to={`/owned-properties/${id}/edit`}>Add New Tenant</Link>
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              ) : null}
              {tab === "tenants" ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link className="pg-btn pg-btn-ghost" to="/tenants">Open Tenant Directory</Link>
                  </div>

                  <Card title="Add tenant to this property">
                    <div style={{ display: "grid", gap: 10 }}>
                      <div>
                        <div className="pg-muted" style={{ marginBottom: 6 }}>Link existing tenant</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <select className="pg-input" value={linkTenantId} onChange={(e) => setLinkTenantId(e.target.value === "" ? "" : Number(e.target.value))}>
                            <option value="">Select tenant</option>
                            {allTenants
                              .filter((t: any) => t.propertyId == null)
                              .map((t: any) => (
                                <option key={t.id} value={t.id}>
                                  {t.firstName} {t.lastName}
                                </option>
                              ))}
                          </select>
                          <button className="pg-btn pg-btn-primary" type="button" onClick={() => void onLinkExistingTenant()} disabled={!linkTenantId}>
                            Link tenant
                          </button>
                        </div>
                      </div>
                      <div>
                        <div className="pg-muted" style={{ marginBottom: 6 }}>Create new tenant</div>
                        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                          <Input placeholder="First name" value={newTenant.firstName} onChange={(e) => setNewTenant({ ...newTenant, firstName: e.target.value })} />
                          <Input placeholder="Last name" value={newTenant.lastName} onChange={(e) => setNewTenant({ ...newTenant, lastName: e.target.value })} />
                          <Input placeholder="Email (optional)" value={newTenant.email} onChange={(e) => setNewTenant({ ...newTenant, email: e.target.value })} />
                          <Input placeholder="Phone (optional)" value={newTenant.phone} onChange={(e) => setNewTenant({ ...newTenant, phone: e.target.value })} />
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <button className="pg-btn pg-btn-secondary" type="button" onClick={() => void onAddNewTenant()} disabled={!newTenant.firstName || !newTenant.lastName}>
                            Add tenant
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {(data.tenants?.length ?? 0) ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      {data.tenants.map((t: any) => (
                        <div key={t.id} style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div>
                              <div>
                                <Link to={`/tenants/${t.id}`} className="pg-link"><strong>{t.firstName} {t.lastName}</strong></Link>
                                <span className="pg-muted">{" "}({t.status})</span>
                              </div>
                              <div className="pg-muted">{t.phone ? `Phone: ${t.phone}` : "Phone: -"} {t.email ? `| Email: ${t.email}` : ""}</div>
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button className="pg-btn pg-btn-ghost" type="button" onClick={() => void onAddReceivedIncomeForTenant(t.id)}>Add received income</button>
                              <button className="pg-btn pg-btn-ghost" type="button" onClick={() => void onUnlinkTenant(t.id)}>Unlink</button>
                              <Link className="pg-btn pg-btn-ghost" to={`/tenants/${t.id}/edit`}>Edit</Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="pg-muted">No tenants linked to this property yet.</div>
                  )}
                </div>
              ) : null}

              {tab === "lease" ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link className="pg-btn pg-btn-ghost" to="/leases">Create Lease</Link>
                    {data.currentLease ? (
                      <button className="pg-btn pg-btn-secondary" type="button" onClick={() => void onCancelLease()}>Cancel Current Lease</button>
                    ) : null}
                    {data.currentLease ? (
                      <button className="pg-btn pg-btn-ghost" type="button" onClick={() => void onEditLease(data.currentLease)}>
                        Edit Current Lease
                      </button>
                    ) : null}
                  </div>
                  {data.currentLease ? (
                    <Card title="Current lease">
                      <div className="pg-muted" style={{ marginBottom: 6 }}>
                        Tenant:{" "}
                        {data.currentTenant?.id ? (
                          <Link className="pg-link" to={`/tenants/${data.currentTenant.id}`}>
                            {data.currentTenant.firstName} {data.currentTenant.lastName}
                          </Link>
                        ) : (
                          <span className="pg-muted">Unknown</span>
                        )}
                      </div>
                      <div><strong>{data.currentLease.leaseType}</strong> <span className="pg-muted">({data.currentLease.displayStatus ?? data.currentLease.status})</span></div>
                      <div className="pg-muted" style={{ marginTop: 4 }}>
                        Start: {data.currentLease.startDate ? new Date(data.currentLease.startDate).toLocaleDateString() : "-"}{" "}
                        | End: {data.currentLease.fixedTermEndDate ? new Date(data.currentLease.fixedTermEndDate).toLocaleDateString() : "Month-to-month"}
                      </div>
                      <div style={{ marginTop: 4 }}>Rent: R {Number(data.currentLease.monthlyRent ?? 0).toLocaleString()} | Deposit: R {Number(data.currentLease.depositAmount ?? 0).toLocaleString()}</div>
                    </Card>
                  ) : (
                    <div className="pg-muted">No current lease.</div>
                  )}

                  <details>
                    <summary className="pg-muted" style={{ cursor: "pointer" }}>History / archived leases</summary>
                    <div style={{ height: 10 }} />
                    {(data.leases?.filter?.((l: any) => l.id !== data.currentLease?.id)?.length ?? 0) ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        {data.leases
                          .filter((l: any) => l.id !== data.currentLease?.id)
                          .map((l: any) => (
                            <div key={l.id} style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 10 }}>
                              <div className="pg-muted" style={{ marginBottom: 6 }}>
                                Tenant:{" "}
                                {l.tenant?.id ? (
                                  <Link className="pg-link" to={`/tenants/${l.tenant.id}`}>
                                    {l.tenant.firstName} {l.tenant.lastName}
                                  </Link>
                                ) : (
                                  <span className="pg-muted">Unknown</span>
                                )}
                              </div>
                              <div><strong>{l.leaseType}</strong> <span className="pg-muted">({l.status})</span></div>
                              <div className="pg-muted" style={{ marginTop: 4 }}>
                                Start: {l.startDate ? new Date(l.startDate).toLocaleDateString() : "-"}{" "}
                                | End: {l.fixedTermEndDate ? new Date(l.fixedTermEndDate).toLocaleDateString() : "Month-to-month"}
                              </div>
                              <div style={{ marginTop: 4 }}>Rent: R {Number(l.monthlyRent ?? 0).toLocaleString()} | Deposit: R {Number(l.depositAmount ?? 0).toLocaleString()}</div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                                {!["CANCELLED", "TERMINATED", "ARCHIVED"].includes(l.status) ? (
                                  <button className="pg-btn pg-btn-ghost" type="button" onClick={() => void onEditLease(l)}>
                                    Edit
                                  </button>
                                ) : null}
                                {["ACTIVE", "MONTH_TO_MONTH"].includes(l.status) ? null : (
                                  <button className="pg-btn pg-btn-ghost" type="button" onClick={() => void onArchiveLease(l.id)}>
                                    Archive lease
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="pg-muted">No historical leases.</div>
                    )}
                  </details>
                </div>
              ) : null}

              {tab === "financials" ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link className="pg-btn pg-btn-primary" to={`/financials?propertyId=${id}&expenseType=recurring`}>Add recurring expense</Link>
                    <Link className="pg-btn pg-btn-secondary" to={`/financials?propertyId=${id}&expenseType=once`}>Add once-off expense</Link>
                    <Link className="pg-btn pg-btn-ghost" to={`/financials?propertyId=${id}`}>Add income</Link>
                  </div>

                  <Card title="This month (received income + active expenses)">
                    {(() => {
                      const inc = (data.incomeEntries ?? []).filter((r: any) => r.status === "RECEIVED" && new Date(r.incomeDate) >= monthBounds.start && new Date(r.incomeDate) < monthBounds.end).reduce((a: number, r: any) => a + Number(r.amount ?? 0), 0);
                      const exp = (data.expenses ?? []).filter((r: any) => r.status === "ACTIVE" && new Date(r.expenseDate) >= monthBounds.start && new Date(r.expenseDate) < monthBounds.end).reduce((a: number, r: any) => a + Number(r.amount ?? 0), 0);
                      return (
                        <div style={{ display: "grid", gap: 6 }}>
                          <div>Income received: <strong>R {inc.toLocaleString()}</strong></div>
                          <div>Expenses (active): <strong>R {exp.toLocaleString()}</strong></div>
                          <div>Net cash flow: <strong style={{ color: inc - exp >= 0 ? "#20C997" : "#FF4D4F" }}>R {(inc - exp).toLocaleString()}</strong></div>
                          <div className="pg-muted">Note: Lease “expected” rent is shown on the Financials page.</div>
                        </div>
                      );
                    })()}
                  </Card>

                  <Card title="Income entries">
                    {(data.incomeEntries?.length ?? 0) ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        {data.incomeEntries.map((inc: any) => (
                          <div key={inc.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 10 }}>
                            <div>
                              <div><strong>{inc.category}</strong> — {inc.description}</div>
                              <div className="pg-muted">{inc.incomeDate ? new Date(inc.incomeDate).toLocaleDateString() : "-"}</div>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <div><strong>R {Number(inc.amount ?? 0).toLocaleString()}</strong></div>
                              <button className="pg-btn pg-btn-ghost" type="button" onClick={() => void onEditIncome(inc)}>Edit</button>
                              <button className="pg-btn pg-btn-ghost" type="button" onClick={() => void onDeleteIncome(inc.id)}>🗑</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="pg-muted">No income entries yet.</div>
                    )}
                  </Card>

                  <Card title="Expense entries">
                    {(data.expenses?.length ?? 0) ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        {data.expenses.map((ex: any) => (
                          <div key={ex.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 10 }}>
                            <div>
                              <div>
                                <strong>{ex.category}</strong> — {ex.description}{" "}
                                {ex.isRecurring ? <span className="pg-pill" style={{ marginLeft: 8 }}>recurring</span> : null}
                              </div>
                              <div className="pg-muted">{ex.expenseDate ? new Date(ex.expenseDate).toLocaleDateString() : "-"}</div>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <div><strong>R {Number(ex.amount ?? 0).toLocaleString()}</strong></div>
                              <button className="pg-btn pg-btn-ghost" type="button" onClick={() => void onDeleteExpense(ex.id)}>🗑</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="pg-muted">No expense entries yet.</div>
                    )}
                  </Card>
                </div>
              ) : null}

              {tab === "invoices" ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div className="pg-muted">{data.invoices?.length ?? 0} invoices.</div>
                  <Link className="pg-btn pg-btn-ghost" to={`/invoices`}>Open invoices</Link>
                </div>
              ) : null}

              {tab === "documents" ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div className="pg-muted">{data.documents?.length ?? 0} documents.</div>
                  <Link className="pg-btn pg-btn-ghost" to={`/documents`}>Open documents</Link>
                </div>
              ) : null}
            </Card>
          </>
        ) : null}
      </Container>
    </Section>
  );
}
