import { Helmet } from "react-helmet-async";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Link } from "react-router-dom";

export function OwnedPropertiesReportsPage() {
  return (
    <Section>
      <Helmet><title>Owned Properties Reports | The Property Guy</title></Helmet>
      <Container>
        <h1 className="pg-h2" style={{ marginTop: 0 }}>Reports</h1>
        <Card>
          <div className="pg-muted">
            Portfolio reporting lives in Invoices/Reports for now.
          </div>
          <div style={{ height: 10 }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="pg-btn pg-btn-ghost" to="/invoices">Generate Portfolio Report</Link>
            <Link className="pg-btn pg-btn-ghost" to="/dashboard">My Reports</Link>
          </div>
        </Card>
      </Container>
    </Section>
  );
}

