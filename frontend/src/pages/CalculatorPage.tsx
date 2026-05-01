import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { Bar, Line } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";
import { calculators } from "../data/calculators";
import { api, authHeader } from "../api/client";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Grid } from "../components/ui/Grid";
import { Card } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip, PointElement, LineElement);

function parseNumberList(text: string) {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

function toPayload(slug: string, values: Record<string, any>) {
  const payload: Record<string, unknown> = { ...values };

  if (slug === "irr" && typeof values.annualCashFlows === "string") {
    payload.annualCashFlows = parseNumberList(values.annualCashFlows);
  }
  if (slug === "dcf" && typeof values.annualCashFlows === "string") {
    payload.annualCashFlows = parseNumberList(values.annualCashFlows);
  }
  if (slug === "rehab-cost" && typeof values.items === "string") {
    try {
      payload.items = JSON.parse(values.items);
    } catch {
      // backend will validate and return a clear error
    }
  }

  return payload;
}

function formatValue(unit: string, formatted: string) {
  return unit === "percent" ? formatted : formatted;
}

export function CalculatorPage() {
  const { slug } = useParams();
  const calc = useMemo(() => calculators.find((c) => c.slug === slug), [slug]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const lastRunRef = useRef<string>("");
  const [savedId, setSavedId] = useState<number | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  if (!calc) {
    return (
      <Section>
        <Container>
          <Card>
            <h1 className="pg-h2" style={{ marginTop: 0 }}>
              Calculator not found
            </h1>
            <p className="pg-lead">Try one of the calculators from the menu.</p>
          </Card>
        </Container>
      </Section>
    );
  }

  const run = async () => {
    setError("");
    setLoading(true);
    setSavedId(null);
    try {
      const res = await api.post(`/calculations/${calc.slug}`, toPayload(calc.slug, values), { headers: authHeader() });
      const calcResult = res.data?.result ?? res.data;
      setResult(calcResult);
      setSavedId(res.data?.id ?? null);
      lastRunRef.current = JSON.stringify(values);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Calculation failed";
      const issues = err?.response?.data?.issues;
      setError(issues?.length ? `${msg}: ${issues.map((i: any) => i.message).join(" · ")}` : msg);
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await run();
  };

  const requiredKeys = useMemo(
    () =>
      calc.groups
        .flatMap((g) => g.fields)
        .filter((f) => f.required)
        .map((f) => f.key),
    [calc.groups]
  );

  const hasAllRequired = useMemo(() => {
    if (!requiredKeys.length) return true;
    return requiredKeys.every((k) => values[k] !== undefined && values[k] !== null && String(values[k]).length > 0);
  }, [requiredKeys, values]);

  useEffect(() => {
    if (!autoUpdate) return;
    if (!hasAllRequired) return;
    if (!result) return;
    const current = JSON.stringify(values);
    if (current === lastRunRef.current) return;
    const t = window.setTimeout(() => void run(), 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoUpdate, hasAllRequired, values]);

  const summary = result?.summary ?? [];
  const chartData = result?.chartData ?? [];

  const firstChart = chartData[0] ?? null;

  const reset = () => {
    setValues({});
    setResult(null);
    setError("");
    setSavedId(null);
  };

  const generateAndDownloadPdf = async () => {
    if (!savedId) return;
    setPdfBusy(true);
    setError("");
    try {
      await api.post(`/reports/${savedId}/generate`, {}, { headers: authHeader() });
      window.open(`${import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"}/reports/${savedId}`, "_blank");
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to generate PDF.");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <Section>
      <Helmet>
        <title>{calc.name} | The Property Guy</title>
        <meta name="description" content={`${calc.name} calculator for South African property investors.`} />
      </Helmet>
      <Container>
        <div style={{ display: "grid", gap: 10 }}>
          <h1 className="pg-h2" style={{ margin: 0 }}>
            {calc.name}
          </h1>
          <p className="pg-lead" style={{ margin: 0 }}>
            {calc.description} Use this to evaluate deals quickly and save the result to your report library.
          </p>
        </div>

        <div style={{ height: 20 }} />

        <Grid cols={2}>
          {/* LEFT: inputs */}
          <Card title="Inputs">
            <form onSubmit={submit}>
              {calc.groups.map((group) => (
                <div key={group.title} style={{ marginBottom: 18 }}>
                  <div className="pg-card-title" style={{ marginBottom: 10 }}>
                    {group.title}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 16 }}>
                    {group.fields.map((f) => (
                      <Field key={f.key} label={f.label} help={f.help ?? "Use realistic, conservative assumptions."}>
                        {f.type === "select" ? (
                          <select
                            className="pg-input"
                            value={values[f.key] ?? ""}
                            required={Boolean(f.required)}
                            onChange={(e) => setValues((v) => ({ ...v, [f.key]: Number(e.target.value) }))}
                          >
                            <option value="" disabled>
                              Select…
                            </option>
                            {(f.options ?? []).map((o) => (
                              <option key={String(o.value)} value={String(o.value)}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : f.type === "checkbox" ? (
                          <label className="pg-pill" style={{ cursor: "pointer", justifyContent: "flex-start" }}>
                            <input
                              type="checkbox"
                              checked={Boolean(values[f.key])}
                              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.checked }))}
                              style={{ margin: 0 }}
                            />
                            {values[f.key] ? "Yes" : "No"}
                          </label>
                        ) : f.type === "text" ? (
                          <Input
                            type="text"
                            placeholder={f.placeholder}
                            value={values[f.key] ?? ""}
                            required={Boolean(f.required)}
                            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                          />
                        ) : (
                          <Input
                            type="number"
                            placeholder={f.placeholder}
                            required={Boolean(f.required)}
                            value={values[f.key] ?? ""}
                            onChange={(e) => setValues((v) => ({ ...v, [f.key]: Number(e.target.value) }))}
                          />
                        )}
                      </Field>
                    ))}
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <Button type="submit" loading={loading}>
                  Calculate
                </Button>
                <Button type="button" variant="secondary" onClick={reset}>
                  Reset
                </Button>
                <label className="pg-pill" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={autoUpdate}
                    onChange={(e) => setAutoUpdate(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  Live update
                </label>
                <Link className="pg-btn pg-btn-ghost" to="/dashboard">
                  My Reports
                </Link>
                {savedId ? (
                  <Button type="button" variant="ghost" onClick={generateAndDownloadPdf} loading={pdfBusy}>
                    PDF
                  </Button>
                ) : null}
              </div>
              <div className="pg-muted" style={{ marginTop: 12, fontSize: 12 }}>
                Estimates only — not financial, legal, or tax advice.
              </div>
            </form>
          </Card>

          {/* RIGHT: results */}
          <Card title="Results">
            {!result && !error ? (
              <div className="pg-muted">Run the calculator to see key metrics and charts.</div>
            ) : null}

            {error ? (
              <div className="pg-alert pg-alert-error">
                {error}{" "}
                {error.includes("Subscribe") ? (
                  <Link className="pg-btn pg-btn-secondary" to="/subscription">
                    View subscription
                  </Link>
                ) : null}
              </div>
            ) : null}

            {result ? (
              <div style={{ display: "grid", gap: 16 }}>
                <Grid cols={4}>
                  {summary.slice(0, 6).map((m: any) => (
                    <Card key={m.key} pad={false} className="pg-card-pad">
                      <div className="pg-kpi">
                        <div className="pg-kpi-value">{formatValue(m.unit, m.formatted)}</div>
                        <div className="pg-kpi-label">{m.label}</div>
                      </div>
                    </Card>
                  ))}
                </Grid>

                {firstChart ? (
                  <Card title={firstChart.title}>
                    {firstChart.chartType === "line" ? (
                      <Line data={firstChart.data} options={firstChart.options as any} />
                    ) : firstChart.chartType === "doughnut" ? (
                      <Bar data={firstChart.data} options={firstChart.options as any} />
                    ) : (
                      <Bar data={firstChart.data} options={firstChart.options as any} />
                    )}
                  </Card>
                ) : null}

                {result?.interpretation?.text ? (
                  <Card title="Interpretation">
                    <div className="pg-muted">{result.interpretation.text}</div>
                    {result.interpretation.warnings?.length ? (
                      <div className="pg-alert pg-alert-error" style={{ marginTop: 12 }}>
                        {result.interpretation.warnings.join(" · ")}
                      </div>
                    ) : null}
                  </Card>
                ) : null}
              </div>
            ) : null}
          </Card>
        </Grid>

        <div style={{ height: 24 }} />

        <Grid cols={2}>
          <Card title="Tips">
            <div style={{ display: "grid", gap: 10 }}>
              <div className="pg-muted">Use multiple metrics to avoid blind spots.</div>
              <div className="pg-muted">Stress-test assumptions (interest rate, vacancy, repairs).</div>
              <div className="pg-muted">Save a report and compare versions as you learn more.</div>
            </div>
          </Card>

          <Card title="Related calculators">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="pg-btn pg-btn-ghost" to="/calculators/noi">
                NOI
              </Link>
              <Link className="pg-btn pg-btn-ghost" to="/calculators/cap-rate">
                Cap Rate
              </Link>
              <Link className="pg-btn pg-btn-ghost" to="/calculators/dscr">
                DSCR
              </Link>
              <Link className="pg-btn pg-btn-ghost" to="/calculators/cash-on-cash-return">
                Cash-on-Cash
              </Link>
            </div>
          </Card>
        </Grid>
      </Container>
    </Section>
  );
}

