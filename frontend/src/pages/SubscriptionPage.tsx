import { Helmet } from "react-helmet-async";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useState } from "react";
import { api, authHeader } from "../api/client";
import { Link } from "react-router-dom";

export function SubscriptionPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  const checkout = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await api.post("/subscription/checkout", {}, { headers: authHeader() });
      if (response.data.checkoutUrl) window.location.href = response.data.checkoutUrl;
      setMessage("Checkout session created.");
    } catch (e: any) {
      setMessage(e?.response?.data?.message ?? "Checkout failed. Make sure you’re logged in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section>
      <Helmet>
        <title>Subscription | The Property Guy</title>
        <meta name="description" content="Subscribe for unlimited calculator usage at R99/month." />
      </Helmet>
      <Container>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <Card>
            <h1 className="pg-h2" style={{ marginTop: 0 }}>
              Subscription
            </h1>
            <p className="pg-lead">
              Unlimited calculator usage and full report history for <strong>R99/month</strong>.
            </p>

            <GridRow />

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button onClick={checkout} loading={loading}>
                Start subscription
              </Button>
              <Link className="pg-btn pg-btn-ghost" to="/login">
                Sign in first
              </Link>
            </div>

            {message ? <div className="pg-alert" style={{ marginTop: 16 }}>{message}</div> : null}
          </Card>
        </div>
      </Container>
    </Section>
  );
}

function GridRow() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 16, margin: "16px 0 20px" }}>
      {[
        { label: "Unlimited usage", desc: "No free-use limits once subscribed." },
        { label: "Reports library", desc: "Generate and store downloadable PDFs." },
        { label: "Fast workflows", desc: "Designed for desktop scenario testing." }
      ].map((x) => (
        <div key={x.label} className="pg-card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 900 }}>{x.label}</div>
          <div className="pg-muted">{x.desc}</div>
        </div>
      ))}
    </div>
  );
}

