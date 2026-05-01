import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { api } from "../api/client";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Input";
import { Link, useLocation, useNavigate } from "react-router-dom";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<null | "login" | "register">(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const submit = async (mode: "login" | "register") => {
    setLoading(mode);
    setMessage(null);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const res = await api.post(endpoint, { email, password });
      if (mode === "login") {
        localStorage.setItem("token", res.data.token);
        setMessage({ kind: "ok", text: "Signed in successfully. Redirecting to your portfolio dashboard..." });
        const from = (location.state as any)?.from as string | undefined;
        if (from && from.startsWith("/calculators/")) {
          window.setTimeout(() => navigate(from, { replace: true }), 450);
          return;
        }
        try {
          const propsRes = await api.get("/properties", { headers: { Authorization: `Bearer ${res.data.token}` } });
          const hasProperties = Array.isArray(propsRes.data) && propsRes.data.length > 0;
          window.setTimeout(() => navigate(hasProperties ? "/owned-properties" : "/owned-properties?empty=true", { replace: true }), 450);
        } catch {
          window.setTimeout(() => navigate("/owned-properties?empty=true", { replace: true }), 450);
        }
      } else {
        setMessage({ kind: "ok", text: "Registered. Check the backend console for your email confirmation link." });
      }
    } catch (e: any) {
      setMessage({ kind: "error", text: e?.response?.data?.message ?? "Request failed" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Section>
      <Helmet>
        <title>Sign In | The Property Guy</title>
        <meta name="description" content="Sign in or create an account to save calculations and generate reports." />
      </Helmet>
      <Container>
        <div className="pg-auth-layout">
          <div className="pg-auth-marketing">
            <h2 className="pg-h2" style={{ marginTop: 0 }}>Track deals. Save reports. Manage your portfolio.</h2>
            <p className="pg-lead">
              Your first 3 calculator reports are free. Then upgrade for unlimited analysis and a full property command centre.
            </p>
          </div>
          <Card>
            <div style={{ display: "grid", gap: 10 }}>
              <h1 className="pg-h2" style={{ margin: 0 }}>
                Sign in to save reports
              </h1>
              <p className="pg-lead" style={{ margin: 0 }}>
                Create an account to track your calculations and generate downloadable PDFs.
              </p>
            </div>

            <div style={{ height: 18 }} />

            <Field label="Email" help="Use the same email you’ll confirm." >
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </Field>
            <Field label="Password" help="Minimum 8 characters recommended.">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button onClick={() => submit("login")} loading={loading === "login"}>
                Sign In
              </Button>
              <Button variant="secondary" onClick={() => submit("register")} loading={loading === "register"}>
                Create Account
              </Button>
              <Link className="pg-btn pg-btn-ghost" to="/subscription">
                Pricing
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

