import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../layouts/AppShell";
import { HomePage } from "../pages/HomePage";
import { CalculatorPage } from "../pages/CalculatorPage";
import { LoginPage } from "../pages/LoginPage";
import { ConfirmEmailPage } from "../pages/ConfirmEmailPage";
import { DashboardPage } from "../pages/DashboardPage";
import { SimplePage } from "../pages/SimplePage";
import { SubscriptionPage } from "../pages/SubscriptionPage";
import { SubscriptionResultPage } from "../pages/SubscriptionResultPage";
import { RequireAuth } from "../components/auth/RequireAuth";
import { OwnedPropertiesDashboardPage } from "../pages/OwnedPropertiesDashboardPage";
import { OwnedPropertyFormPage } from "../pages/OwnedPropertyFormPage";
import { OwnedPropertyDetailPage } from "../pages/OwnedPropertyDetailPage";
import { OwnedTenantsPage } from "../pages/OwnedTenantsPage";
import { OwnedLeasesPage } from "../pages/OwnedLeasesPage";
import { OwnedFinancialsPage } from "../pages/OwnedFinancialsPage";
import { OwnedInvoicesPage } from "../pages/OwnedInvoicesPage";
import { OwnedRecurringInvoicesPage } from "../pages/OwnedRecurringInvoicesPage";
import { OwnedDocumentsPage } from "../pages/OwnedDocumentsPage";
import { OwnedEquityMetricsPage } from "../pages/OwnedEquityMetricsPage";
import { OwnedLeaseMetricsPage } from "../pages/OwnedLeaseMetricsPage";
import { OwnedRentDueMetricsPage } from "../pages/OwnedRentDueMetricsPage";
import { OwnedDepositsMetricsPage } from "../pages/OwnedDepositsMetricsPage";
import { OwnedCashFlowMetricsPage } from "../pages/OwnedCashFlowMetricsPage";
import { OwnedPropertiesMyPropertiesPage } from "../pages/OwnedPropertiesMyPropertiesPage";
import { OwnedPropertiesPortfolioDashboardPage } from "../pages/OwnedPropertiesPortfolioDashboardPage";
import { OwnedPropertiesReportsPage } from "../pages/OwnedPropertiesReportsPage";
import { TenantsListPage } from "../pages/TenantsListPage";
import { TenantFormPage } from "../pages/TenantFormPage";
import { TenantDetailPage } from "../pages/TenantDetailPage";
import { OwnedValuationsMetricsPage } from "../pages/OwnedValuationsMetricsPage";
import { OwnedBondsMetricsPage } from "../pages/OwnedBondsMetricsPage";
import { OwnedReturnsMetricsPage } from "../pages/OwnedReturnsMetricsPage";
import { OwnedExpensesMetricsPage } from "../pages/OwnedExpensesMetricsPage";

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/calculators/:slug" element={<CalculatorPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/confirm-email/:token" element={<ConfirmEmailPage />} />
        <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route path="/learn" element={<SimplePage title="Learn / Blog" description="Educational content hub for property investing strategies, tax notes, and finance guides." />} />
        <Route path="/contact" element={<SimplePage title="Contact" description="Contact form page for investor enquiries and partnerships." />} />
        <Route path="/about" element={<SimplePage title="About" description="About The Property Guy and our mission." />} />
        <Route path="/admin" element={<SimplePage title="Admin Panel" description="Admin tools for content, users, and subscription analytics." />} />
        <Route path="/owned-properties" element={<RequireAuth><Navigate to="/owned-properties/dashboard" replace /></RequireAuth>} />
        <Route path="/owned-properties/my-properties" element={<RequireAuth><OwnedPropertiesMyPropertiesPage /></RequireAuth>} />
        <Route path="/owned-properties/dashboard" element={<RequireAuth><OwnedPropertiesPortfolioDashboardPage /></RequireAuth>} />
        <Route path="/owned-properties/metrics/equity" element={<RequireAuth><OwnedEquityMetricsPage /></RequireAuth>} />
        <Route path="/owned-properties/metrics/valuations" element={<RequireAuth><OwnedValuationsMetricsPage /></RequireAuth>} />
        <Route path="/owned-properties/metrics/bonds" element={<RequireAuth><OwnedBondsMetricsPage /></RequireAuth>} />
        <Route path="/owned-properties/metrics/returns" element={<RequireAuth><OwnedReturnsMetricsPage /></RequireAuth>} />
        <Route path="/owned-properties/metrics/expenses" element={<RequireAuth><OwnedExpensesMetricsPage /></RequireAuth>} />
        <Route path="/owned-properties/metrics/leases" element={<RequireAuth><OwnedLeaseMetricsPage /></RequireAuth>} />
        <Route path="/owned-properties/metrics/rent-due" element={<RequireAuth><OwnedRentDueMetricsPage /></RequireAuth>} />
        <Route path="/owned-properties/metrics/deposits" element={<RequireAuth><OwnedDepositsMetricsPage /></RequireAuth>} />
        <Route path="/owned-properties/metrics/cash-flow" element={<RequireAuth><OwnedCashFlowMetricsPage /></RequireAuth>} />
        <Route path="/owned-properties/new" element={<RequireAuth><OwnedPropertyFormPage /></RequireAuth>} />
        <Route path="/owned-properties/:id/edit" element={<RequireAuth><OwnedPropertyFormPage /></RequireAuth>} />
        <Route path="/owned-properties/:id" element={<RequireAuth><OwnedPropertyDetailPage /></RequireAuth>} />
        {/* Legacy owned-properties subpages: keep as redirects for backward compatibility */}
        <Route path="/owned-properties/tenants" element={<RequireAuth><Navigate to="/tenants" replace /></RequireAuth>} />
        <Route path="/owned-properties/leases" element={<RequireAuth><Navigate to="/leases" replace /></RequireAuth>} />
        <Route path="/owned-properties/financials" element={<RequireAuth><Navigate to="/financials" replace /></RequireAuth>} />
        <Route path="/owned-properties/invoices" element={<RequireAuth><Navigate to="/invoices" replace /></RequireAuth>} />
        <Route path="/owned-properties/documents" element={<RequireAuth><Navigate to="/documents" replace /></RequireAuth>} />
        <Route path="/owned-properties/recurring-invoices" element={<RequireAuth><OwnedRecurringInvoicesPage /></RequireAuth>} />
        <Route path="/owned-properties/reports" element={<RequireAuth><OwnedPropertiesReportsPage /></RequireAuth>} />

        {/* Canonical routes */}
        <Route path="/leases" element={<RequireAuth><OwnedLeasesPage /></RequireAuth>} />
        <Route path="/financials" element={<RequireAuth><OwnedFinancialsPage /></RequireAuth>} />
        <Route path="/invoices" element={<RequireAuth><OwnedInvoicesPage /></RequireAuth>} />
        <Route path="/documents" element={<RequireAuth><OwnedDocumentsPage /></RequireAuth>} />
        <Route path="/tenants" element={<RequireAuth><TenantsListPage /></RequireAuth>} />
        <Route path="/tenants/new" element={<RequireAuth><TenantFormPage /></RequireAuth>} />
        <Route path="/tenants/:id" element={<RequireAuth><TenantDetailPage /></RequireAuth>} />
        <Route path="/tenants/:id/edit" element={<RequireAuth><TenantFormPage /></RequireAuth>} />
        <Route path="/account" element={<RequireAuth><SimplePage title="Account" description="Manage your account profile and preferences." /></RequireAuth>} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="/subscription/success" element={<SubscriptionResultPage mode="success" />} />
        <Route path="/subscription/cancel" element={<SubscriptionResultPage mode="cancel" />} />
      </Routes>
    </AppShell>
  );
}
