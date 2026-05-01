import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export function ConfirmEmailPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const run = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.get(`/auth/confirm-email/${token}`);
      setMessage({ kind: "ok", text: res.data?.message ?? "Email confirmed" });
    } catch (e: any) {
      setMessage({ kind: "error", text: e?.response?.data?.message ?? "Invalid token" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section>
      <Helmet>
        <title>Confirm Email | The Property Guy</title>
        <meta name="description" content="Confirm your email for The Property Guy." />
      </Helmet>
      <Container>
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <Card>
            <h1 className="pg-h2" style={{ marginTop: 0 }}>
              Confirm your email
            </h1>
            <p className="pg-lead">Confirming your email enables login and report storage.</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button onClick={run} loading={loading}>
                Confirm email
              </Button>
              <Link className="pg-btn pg-btn-ghost" to="/login">
                Back to login
              </Link>
            </div>
            {message ? (
              <div className={`pg-alert ${message.kind === "error" ? "pg-alert-error" : ""}`} style={{ marginTop: 16 }}>
                {message.text}
              </div>
            ) : null}
          </Card>
        </div>
      </Container>
    </Section>
  );
}

