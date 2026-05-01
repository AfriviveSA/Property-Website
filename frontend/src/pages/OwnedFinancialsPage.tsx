import { FormEvent, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { api, authHeader } from "../api/client";
import { deletePropertyExpense, deletePropertyIncome, getProperties, getPropertyTenants, updatePropertyIncome } from "../api/ownedProperties";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { useLocation } from "react-router-dom";

export function OwnedFinancialsPage() {
  const { search } = useLocation();
  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState<number | "">("");
  const [summary, setSummary] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<any[]>([]);
  const [recurringIncomeRules, setRecurringIncomeRules] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [income, setIncome] = useState<any>({ category: "RENT", description: "Rent", amount: "", incomeDate: "" });
  const [expense, setExpense] = useState<any>({ category: "RATES_TAXES", description: "Rates", amount: "", expenseDate: "", isRecurring: false });

  async function loadProperties() {
    const rows = await getProperties();
    setProperties(rows);
    const params = new URLSearchParams(search);
    const pid = params.get("propertyId");
    const presetPid = pid != null && !Number.isNaN(Number(pid)) ? Number(pid) : null;
    if (!propertyId && presetPid != null) setPropertyId(presetPid);
    else if (!propertyId && rows[0]) setPropertyId(rows[0].id);

    const expenseType = params.get("expenseType");
    if (expenseType === "recurring") setExpense((prev: any) => ({ ...prev, isRecurring: true }));
    if (expenseType === "once") setExpense((prev: any) => ({ ...prev, isRecurring: false }));
  }
  async function loadSummary(pid: number) {
    const res = await api.get(`/properties/${pid}/financials`, { headers: authHeader() });
    setSummary(res.data?.summary ?? null);
    setExpenses(res.data?.expenses ?? []);
    setIncomeEntries(res.data?.income ?? []);
    setRecurringIncomeRules(res.data?.recurringIncomeRules ?? []);
    try {
      setTenants(await getPropertyTenants(pid));
    } catch {
      setTenants([]);
    }
  }
  useEffect(() => { void loadProperties(); }, []);
  useEffect(() => { if (propertyId) void loadSummary(Number(propertyId)); }, [propertyId]);

  const addIncome = async (e: FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    await api.post(`/properties/${propertyId}/income`, { ...income, source: "MANUAL_FINANCIAL_ENTRY", status: "RECEIVED" }, { headers: authHeader() });
    await loadSummary(Number(propertyId));
  };
  const addExpense = async (e: FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    await api.post(
      `/properties/${propertyId}/expenses`,
      { ...expense, source: "MANUAL_FINANCIAL_ENTRY", status: "ACTIVE", recurringFrequency: expense.isRecurring ? "MONTHLY" : null },
      { headers: authHeader() }
    );
    await loadSummary(Number(propertyId));
  };

  const archiveExpense = async (id: number) => {
    if (!window.confirm("Archive this expense entry?")) return;
    await deletePropertyExpense(id);
    await loadSummary(Number(propertyId));
  };

  const archiveIncome = async (id: number) => {
    if (!window.confirm("Archive this income entry?")) return;
    await deletePropertyIncome(id);
    await loadSummary(Number(propertyId));
  };

  const runExpectedIncome = async () => {
    await api.post(`/recurring-income/run-due`, {}, { headers: authHeader() });
    await loadSummary(Number(propertyId));
  };

  const activateRecurring = async (id: number) => {
    await api.post(`/recurring-income/${id}/activate`, {}, { headers: authHeader() });
    await loadSummary(Number(propertyId));
  };

  const markReceived = async (id: number) => {
    const paymentDate = window.prompt("Payment received date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (!paymentDate) return;
    await api.post(`/income/${id}/mark-received`, { paymentDate }, { headers: authHeader() });
    await loadSummary(Number(propertyId));
  };

  const editIncome = async (inc: any) => {
    const amount = window.prompt("Amount (number)", String(inc.amount ?? 0));
    if (amount == null) return;
    const incomeDate = window.prompt("Income date (YYYY-MM-DD)", new Date(inc.incomeDate).toISOString().slice(0, 10));
    if (!incomeDate) return;
    const tenantId = window.prompt("Tenant ID (optional)", inc.tenantId != null ? String(inc.tenantId) : "");
    const description = window.prompt("Description", inc.description ?? "") ?? inc.description;
    await updatePropertyIncome(inc.id, {
      amount: Number(amount),
      incomeDate,
      tenantId: tenantId === "" ? null : Number(tenantId),
      description
    });
    await loadSummary(Number(propertyId));
  };

  return (
    <Section>
      <Helmet><title>Financials | The Property Guy</title></Helmet>
      <Container>
        <h1 className="pg-h2">Financials</h1>
        <Card>
          <Field label="Property">
            <select className="pg-input" value={propertyId} onChange={(e) => setPropertyId(Number(e.target.value))}>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          {summary ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div>Monthly income: {summary.monthly.totalIncome?.toLocaleString?.() ?? 0}</div>
              <div>Expected income (draft): {summary.monthly.expectedIncome?.toLocaleString?.() ?? 0}</div>
              <div>Monthly expenses: {summary.monthly.totalExpenses?.toLocaleString?.() ?? 0}</div>
              <div>Net cash flow: {summary.monthly.netMonthlyCashFlow?.toLocaleString?.() ?? 0}</div>
              <div>Gross yield: {(Number(summary.investorMetrics.grossYield ?? 0) * 100).toFixed(2)}%</div>
              <div>Net yield: {(Number(summary.investorMetrics.netYield ?? 0) * 100).toFixed(2)}%</div>
              <div>Occupancy: {summary.investorMetrics.occupancyStatus}</div>
            </div>
          ) : null}
        </Card>
        <div style={{ height: 12 }} />
        <Card title="Expected rent income (from leases)">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="ghost" onClick={runExpectedIncome}>Run expected income (due)</Button>
            <div className="pg-muted">Rules are created when a lease is created, and stay paused until activated.</div>
          </div>
          <div style={{ height: 10 }} />
          {(recurringIncomeRules?.length ?? 0) ? (
            <div style={{ display: "grid", gap: 8 }}>
              {recurringIncomeRules.map((r: any) => (
                <div key={r.id} style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 10, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div><strong>{r.category}</strong> — R {Number(r.amount ?? 0).toLocaleString()} / {r.frequency}</div>
                    <div className="pg-muted">Day {r.dayOfMonth} | Status: {r.status}</div>
                  </div>
                  {r.status === "PAUSED" ? <Button variant="ghost" onClick={() => activateRecurring(r.id)}>Activate</Button> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="pg-muted">No expected rent rules yet. Create a lease to generate one.</div>
          )}
        </Card>

        <div style={{ height: 12 }} />
        <Card title="Income entries">
          {(incomeEntries?.length ?? 0) ? (
            <div style={{ display: "grid", gap: 8 }}>
              {incomeEntries.map((inc: any) => (
                <div key={inc.id} style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 10, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div><strong>{inc.category}</strong> — {inc.description}</div>
                    <div className="pg-muted">{new Date(inc.incomeDate).toLocaleDateString()} | {inc.source} | {inc.status}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div><strong>R {Number(inc.amount ?? 0).toLocaleString()}</strong></div>
                    {inc.status === "EXPECTED" ? <Button variant="ghost" onClick={() => markReceived(inc.id)}>Mark received</Button> : null}
                    <Button variant="ghost" onClick={() => void editIncome(inc)}>Edit</Button>
                    <Button variant="ghost" onClick={() => archiveIncome(inc.id)}>Archive</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="pg-muted">No income entries yet.</div>
          )}
        </Card>

        <div style={{ height: 12 }} />
        <Card title="Expense entries">
          {(expenses?.length ?? 0) ? (
            <div style={{ display: "grid", gap: 8 }}>
              {expenses.map((ex: any) => (
                <div key={ex.id} style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: 10, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div><strong>{ex.category}</strong> — {ex.description}</div>
                    <div className="pg-muted">{new Date(ex.expenseDate).toLocaleDateString()} | {ex.source} | {ex.status} {ex.isRecurring ? "| recurring" : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div><strong>R {Number(ex.amount ?? 0).toLocaleString()}</strong></div>
                    <Button variant="ghost" onClick={() => archiveExpense(ex.id)}>Archive</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="pg-muted">No expense entries yet.</div>
          )}
        </Card>
        <div style={{ height: 12 }} />
        <Card title="Add income">
          <form onSubmit={addIncome}>
            <Field label="Tenant (optional)">
              <select
                className="pg-input"
                value={income.tenantId ?? ""}
                onChange={(e) => setIncome({ ...income, tenantId: e.target.value === "" ? null : Number(e.target.value) })}
              >
                <option value="">No tenant</option>
                {tenants.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category"><select className="pg-input" value={income.category} onChange={(e) => setIncome({ ...income, category: e.target.value })}>{["RENT", "DEPOSIT", "LATE_FEE", "UTILITIES_RECOVERY", "OTHER"].map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Description"><Input value={income.description} onChange={(e) => setIncome({ ...income, description: e.target.value })} required /></Field>
            <Field label="Amount"><Input type="number" value={income.amount} onChange={(e) => setIncome({ ...income, amount: Number(e.target.value) })} required /></Field>
            <Field label="Income date"><Input type="date" value={income.incomeDate} onChange={(e) => setIncome({ ...income, incomeDate: e.target.value })} required /></Field>
            <Button type="submit">Add Income</Button>
          </form>
        </Card>
        <div style={{ height: 12 }} />
        <Card title="Add expense">
          <form onSubmit={addExpense}>
            <Field label="Category"><select className="pg-input" value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value })}>{["RATES_TAXES", "WATER", "ELECTRICITY", "LEVIES", "INSURANCE", "MAINTENANCE", "REPAIRS", "BOND_PAYMENT", "OTHER"].map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Description"><Input value={expense.description} onChange={(e) => setExpense({ ...expense, description: e.target.value })} required /></Field>
            <Field label="Amount"><Input type="number" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: Number(e.target.value) })} required /></Field>
            <Field label="Expense date"><Input type="date" value={expense.expenseDate} onChange={(e) => setExpense({ ...expense, expenseDate: e.target.value })} required /></Field>
            <Field label="Recurring expense">
              <label className="pg-pill"><input type="checkbox" checked={Boolean(expense.isRecurring)} onChange={(e) => setExpense({ ...expense, isRecurring: e.target.checked })} /> recurring</label>
            </Field>
            <Button type="submit">Add Expense</Button>
          </form>
        </Card>
      </Container>
    </Section>
  );
}
