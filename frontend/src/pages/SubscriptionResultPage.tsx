import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";

export function SubscriptionResultPage({ mode }: { mode: "success" | "cancel" }) {
  return (
    <Section>
      <Helmet>
        <title>{mode === "success" ? "Subscription Success" : "Subscription Cancelled"} | The Property Guy</title>
        <meta name="description" content="Subscription status." />
      </Helmet>
      <Container>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <Card>
            <h1 className="pg-h2" style={{ marginTop: 0 }}>
              {mode === "success" ? "Subscription successful" : "Subscription cancelled"}
            </h1>
            <p className="pg-lead">
              {mode === "success"
                ? "Thanks! Your subscription unlocks unlimited calculator usage."
                : "No worries — you can subscribe any time when you're ready."}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link className="pg-btn pg-btn-primary" to="/">
                Back to home
              </Link>
              <Link className="pg-btn pg-btn-ghost" to="/dashboard">
                My Reports
              </Link>
            </div>
          </Card>
        </div>
      </Container>
    </Section>
  );
}

