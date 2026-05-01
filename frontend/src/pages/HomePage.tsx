import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { calculators } from "../data/calculators";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { ButtonLink } from "../components/ui/Button";
import { Grid } from "../components/ui/Grid";
import { DashboardCard, MetricCard, StatusPill } from "../components/ui/DashboardKit";

export function HomePage() {
  const preview = calculators.filter((c) =>
    ["transfer-bond-costs", "monthly-payment", "cash-on-cash-return", "irr", "cap-rate", "dscr", "short-term-rental", "brrrr"].includes(c.slug)
  );

  return (
    <>
      <Helmet>
        <title>The Property Guy | South Africa Property Calculators</title>
        <meta
          name="description"
          content="A modern set of South African property investment calculators for investors: cash flow, NOI, cap rate, DSCR, IRR and more."
        />
      </Helmet>

      <div className="pg-hero">
        <Container>
          <div className="pg-hero-inner">
            <div className="pg-pill">South African property costs</div>
            <h1 className="pg-h1">Build wealth on your own terms</h1>
            <p className="pg-lead">
              Analyse property deals, track your portfolio and generate investor-ready reports from one dashboard.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ButtonLink href="/calculators/cash-on-cash-return">Start Calculating</ButtonLink>
              <ButtonLink href="/owned-properties" variant="secondary">
                Manage My Portfolio
              </ButtonLink>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
              <div className="pg-pill">South African property costs</div>
              <div className="pg-pill">PDF investment reports</div>
              <div className="pg-pill">Portfolio tracking</div>
            </div>
          </div>
        </Container>
      </div>

      <Section>
        <Container>
          <h2 className="pg-h2">What You Can Do</h2>
          <p className="pg-lead">A focused platform for modern investors and property owners.</p>

          <Grid cols={4}>
            {[
              { icon: "A", title: "Analyse investment deals", desc: "Run returns, affordability and risk metrics with clean calculators." },
              { icon: "C", title: "Calculate transfer and bond costs", desc: "Use local South African assumptions and practical outputs." },
              { icon: "R", title: "Save PDF reports", desc: "Generate professional investment summaries for records or partners." },
              { icon: "P", title: "Manage owned properties", desc: "Track tenants, leases, income, expenses and invoices in one place." }
            ].map((f) => (
              <DashboardCard key={f.title} title={f.title}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div className="pg-icon" aria-hidden="true">{f.icon}</div>
                  <div className="pg-muted">{f.desc}</div>
                </div>
              </DashboardCard>
            ))}
          </Grid>
        </Container>
      </Section>

      <Section>
        <Container>
          <h2 className="pg-h2">What you unlock with your account</h2>
          <Grid cols={3}>
            {[
              ["Save every report", "Keep a record of your investment calculations and revisit them later."],
              ["Manage your portfolio", "Track owned properties, tenants, leases, rent due dates and expenses."],
              ["Generate investor-ready PDFs", "Export clean PDF reports for your own review, partners or lenders."],
              ["Track performance over time", "Monitor cash flow, occupancy, lease expiry and portfolio equity."],
              ["Unlimited calculators", "Move beyond the free-use limit and analyse as many deals as needed."],
              ["Better decisions", "Compare income, expenses, loan payments, yields and risk before committing."]
            ].map(([title, desc]) => (
              <MetricCard key={title} title={title} value="" subtitle={desc} />
            ))}
          </Grid>
        </Container>
      </Section>

      <Section>
        <Container>
          <h2 className="pg-h2">How It Works</h2>
          <Grid cols={3}>
            {[
              { step: "1", title: "Choose a calculator or add a property", desc: "Start from a deal analysis or portfolio workflow." },
              { step: "2", title: "Enter the real numbers", desc: "Use accurate rents, costs, values and financing details." },
              { step: "3", title: "Get reports, warnings and insights", desc: "Act on dashboards, alerts and downloadable reports." }
            ].map((s) => (
              <DashboardCard key={s.step} title={`Step ${s.step}`}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>{s.title}</div>
                <div className="pg-muted">{s.desc}</div>
              </DashboardCard>
            ))}
          </Grid>
        </Container>
      </Section>

      <Section>
        <Container>
          <h2 className="pg-h2">Calculator Preview</h2>
          <p className="pg-lead">Core tools available in a fast bento-style layout.</p>

          <Grid cols={4}>
            {preview.map((c) => (
              <DashboardCard key={c.slug} title={c.name}>
                <div style={{ display: "grid", gap: 10 }}>
                  <div className="pg-muted">{c.description}</div>
                  <Link className="pg-btn pg-btn-ghost" to={`/calculators/${c.slug}`}>
                    Open Calculator
                  </Link>
                </div>
              </DashboardCard>
            ))}
          </Grid>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="pg-dashboard-card">
            <h2 className="pg-h2">Portfolio Preview</h2>
            <Grid cols={3}>
              <MetricCard title="Portfolio Equity" value="R 2,350,000" subtitle="Total property value less outstanding bonds" />
              <MetricCard title="Rent Due" value="3 items" subtitle="Due within the next 7 days" />
              <MetricCard title="Lease Expiring" value="2 leases" subtitle="Needs renewal attention soon" />
              <MetricCard title="Net Cash Flow" value="R 36,500" subtitle="Monthly portfolio cash flow" />
              <MetricCard title="Occupancy" value="86%" subtitle="Occupied vs vacant properties" />
            </Grid>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="pg-dashboard-card">
            <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div>
                <h2 className="pg-h2" style={{ marginBottom: 8 }}>
                  Ready to run your numbers properly?
                </h2>
                <p className="pg-lead" style={{ margin: 0 }}>
                  Your account becomes your property command centre.
                </p>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <ButtonLink href="/login">Create Free Account</ButtonLink>
                <ButtonLink href="/login" variant="secondary">Sign In</ButtonLink>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}

