import { api, authHeader } from "./client";

export async function getProperties() {
  const res = await api.get("/properties", { headers: authHeader() });
  return res.data?.properties ?? res.data;
}

export async function createProperty(payload: Record<string, unknown>) {
  const res = await api.post("/properties", payload, { headers: authHeader() });
  return res.data;
}

export async function getProperty(id: string | number) {
  const res = await api.get(`/properties/${id}`, { headers: authHeader() });
  return res.data;
}

export async function updateProperty(id: string | number, payload: Record<string, unknown>) {
  const res = await api.put(`/properties/${id}`, payload, { headers: authHeader() });
  return res.data;
}

export async function getTenants() {
  const res = await api.get("/tenants", { headers: authHeader() });
  return res.data?.tenants ?? [];
}

export async function createTenant(payload: Record<string, unknown>) {
  const res = await api.post("/tenants", payload, { headers: authHeader() });
  return res.data?.tenant ?? res.data;
}

export async function getTenant(id: string | number) {
  const res = await api.get(`/tenants/${id}`, { headers: authHeader() });
  return res.data;
}

export async function updateTenant(id: string | number, payload: Record<string, unknown>) {
  const res = await api.put(`/tenants/${id}`, payload, { headers: authHeader() });
  return res.data?.tenant ?? res.data;
}

export async function deleteTenant(id: string | number) {
  const res = await api.delete(`/tenants/${id}`, { headers: authHeader() });
  return res.data;
}

export async function getPropertyTenants(propertyId: string | number) {
  const res = await api.get(`/properties/${propertyId}/tenants`, { headers: authHeader() });
  return res.data?.tenants ?? res.data;
}

export async function createPropertyTenant(propertyId: string | number, payload: Record<string, unknown>) {
  const res = await api.post(`/properties/${propertyId}/tenants`, payload, { headers: authHeader() });
  return res.data;
}

export async function linkTenantToProperty(propertyId: string | number, tenantId: string | number) {
  const res = await api.patch(`/properties/${propertyId}/tenants/${tenantId}/link`, {}, { headers: authHeader() });
  return res.data;
}

export async function unlinkTenantFromProperty(propertyId: string | number, tenantId: string | number) {
  const res = await api.patch(`/properties/${propertyId}/tenants/${tenantId}/unlink`, {}, { headers: authHeader() });
  return res.data;
}

export async function createLease(propertyId: string | number, payload: Record<string, unknown>) {
  const res = await api.post(`/properties/${propertyId}/leases`, payload, { headers: authHeader() });
  return res.data;
}

export async function updateLease(leaseId: string | number, payload: Record<string, unknown>) {
  const res = await api.put(`/leases/${leaseId}`, payload, { headers: authHeader() });
  return res.data;
}

export async function deleteLease(leaseId: string | number) {
  const res = await api.delete(`/leases/${leaseId}`, { headers: authHeader() });
  return res.data;
}

export async function cancelLease(leaseId: string | number, payload: Record<string, unknown>) {
  const res = await api.post(`/leases/${leaseId}/cancel`, payload, { headers: authHeader() });
  return res.data;
}

export async function getEquityMetrics() {
  const res = await api.get("/properties/metrics/equity", { headers: authHeader() });
  return res.data?.properties ?? [];
}

export async function updateEquityMetrics(updates: Array<{ propertyId: number; currentEstimatedValue: number | null; outstandingBondBalance: number | null }>) {
  const res = await api.patch("/properties/metrics/equity", { updates }, { headers: authHeader() });
  return res.data;
}

export async function deletePropertyExpense(expenseId: string | number) {
  const res = await api.delete(`/expenses/${expenseId}`, { headers: authHeader() });
  return res.data;
}

export async function deletePropertyIncome(incomeId: string | number) {
  const res = await api.delete(`/income/${incomeId}`, { headers: authHeader() });
  return res.data;
}

export async function updatePropertyIncome(incomeId: string | number, payload: Record<string, unknown>) {
  const res = await api.put(`/income/${incomeId}`, payload, { headers: authHeader() });
  return res.data;
}
