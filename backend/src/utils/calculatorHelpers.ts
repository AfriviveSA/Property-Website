import type { Money, Percent } from "./calculatorTypes.js";

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: Money) {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 2 }).format(safe);
}

export function formatPercent(pct: Percent) {
  const safe = Number.isFinite(pct) ? pct : 0;
  return `${round2(safe).toFixed(2)}%`;
}

export function assertNonNegative(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number`);
}

export function assertPositive(name: string, value: number) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function calculateMonthlyBondPayment(params: {
  principal: Money;
  annualInterestRatePercent: Percent;
  termYears: number;
}) {
  const P = params.principal;
  const r = params.annualInterestRatePercent / 100 / 12;
  const n = params.termYears * 12;
  if (n <= 0) throw new Error("Loan term must be at least 1 year");
  if (P <= 0) return { monthlyPayment: 0, monthlyRate: r, numberPayments: n };
  const monthlyPayment =
    r === 0 ? P / n : (P * (r * (1 + r) ** n)) / ((1 + r) ** n - 1);
  return { monthlyPayment, monthlyRate: r, numberPayments: n };
}

export function calculateAnnualDebtService(monthlyBondPayment: Money) {
  assertNonNegative("Monthly bond payment", monthlyBondPayment);
  return monthlyBondPayment * 12;
}

// SARS Transfer Duty brackets (as provided in prompt)
const transferDutyBrackets = [
  { upTo: 1_210_000, base: 0, rate: 0, threshold: 0 },
  { upTo: 1_663_800, base: 0, rate: 0.03, threshold: 1_210_000 },
  { upTo: 2_329_300, base: 13_614, rate: 0.06, threshold: 1_663_800 },
  { upTo: 2_994_800, base: 53_544, rate: 0.08, threshold: 2_329_300 },
  { upTo: 13_310_000, base: 106_784, rate: 0.11, threshold: 2_994_800 },
  { upTo: Infinity, base: 1_241_456, rate: 0.13, threshold: 13_310_000 }
] as const;

export function calculateTransferDutySouthAfrica(purchasePrice: Money) {
  assertNonNegative("Purchase price", purchasePrice);
  const b = transferDutyBrackets.find((x) => purchasePrice <= x.upTo)!;
  const duty = b.base + Math.max(0, (purchasePrice - b.threshold) * b.rate);
  return round2(duty);
}

export function calculateNOI(params: {
  grossMonthlyRent: Money;
  otherMonthlyIncome: Money;
  vacancyRatePercent: Percent;
  monthlyOperatingExpenses: Money;
}) {
  assertNonNegative("Gross monthly rent", params.grossMonthlyRent);
  assertNonNegative("Other monthly income", params.otherMonthlyIncome);
  const vacancyRate = clamp(params.vacancyRatePercent, 0, 100);
  assertNonNegative("Monthly operating expenses", params.monthlyOperatingExpenses);

  const grossPotentialIncomeMonthly = params.grossMonthlyRent + params.otherMonthlyIncome;
  const vacancyLossMonthly = grossPotentialIncomeMonthly * (vacancyRate / 100);
  const effectiveGrossIncomeMonthly = grossPotentialIncomeMonthly - vacancyLossMonthly;
  const noiMonthly = effectiveGrossIncomeMonthly - params.monthlyOperatingExpenses;

  return {
    grossPotentialIncomeMonthly,
    grossPotentialIncomeAnnual: grossPotentialIncomeMonthly * 12,
    vacancyRatePercent: vacancyRate,
    vacancyLossMonthly,
    vacancyLossAnnual: vacancyLossMonthly * 12,
    effectiveGrossIncomeMonthly,
    effectiveGrossIncomeAnnual: effectiveGrossIncomeMonthly * 12,
    operatingExpensesMonthly: params.monthlyOperatingExpenses,
    operatingExpensesAnnual: params.monthlyOperatingExpenses * 12,
    noiMonthly,
    noiAnnual: noiMonthly * 12
  };
}

export function calculateCashFlow(params: {
  grossMonthlyIncome: Money;
  vacancyLossMonthly: Money;
  monthlyOperatingExpenses: Money;
  monthlyDebtService: Money;
}) {
  assertNonNegative("Gross monthly income", params.grossMonthlyIncome);
  assertNonNegative("Vacancy loss monthly", params.vacancyLossMonthly);
  assertNonNegative("Monthly operating expenses", params.monthlyOperatingExpenses);
  assertNonNegative("Monthly debt service", params.monthlyDebtService);

  const effectiveMonthlyIncome = params.grossMonthlyIncome - params.vacancyLossMonthly;
  const monthlyNOI = effectiveMonthlyIncome - params.monthlyOperatingExpenses;
  const monthlyCashFlow = monthlyNOI - params.monthlyDebtService;
  const annualCashFlow = monthlyCashFlow * 12;
  const cashFlowMarginPercent = params.grossMonthlyIncome > 0 ? (monthlyCashFlow / params.grossMonthlyIncome) * 100 : 0;

  return {
    effectiveMonthlyIncome,
    monthlyNOI,
    monthlyCashFlow,
    annualCashFlow,
    cashFlowMarginPercent
  };
}

export function calculateNPV(params: { discountRatePercent: Percent; cashFlows: Money[] }) {
  const r = params.discountRatePercent / 100;
  if (!Number.isFinite(r) || r < -0.99) throw new Error("Discount rate is invalid");
  return params.cashFlows.reduce((sum, cf, i) => sum + cf / (1 + r) ** i, 0);
}

export function calculateIRR(params: { cashFlows: Money[] }) {
  const cashFlows = params.cashFlows;
  if (cashFlows.length < 2) return { irr: null as number | null, iterations: 0, converged: false };
  const hasPos = cashFlows.some((c) => c > 0);
  const hasNeg = cashFlows.some((c) => c < 0);
  if (!hasPos || !hasNeg) return { irr: null as number | null, iterations: 0, converged: false };

  let guess = 0.1;
  for (let iter = 0; iter < 100; iter += 1) {
    let npv = 0;
    let d = 0;
    for (let t = 0; t < cashFlows.length; t += 1) {
      const cf = cashFlows[t];
      npv += cf / (1 + guess) ** t;
      if (t > 0) d -= (t * cf) / (1 + guess) ** (t + 1);
    }
    if (Math.abs(npv) < 1e-7) return { irr: guess, iterations: iter + 1, converged: true };
    if (Math.abs(d) < 1e-12) break;
    const next = guess - npv / d;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    guess = next;
  }
  return { irr: null as number | null, iterations: 100, converged: false };
}

export function calculateAmortisationSchedule(params: {
  principal: Money;
  annualInterestRatePercent: Percent;
  termYears: number;
  extraMonthlyPayment?: Money;
  onceOffExtraPayment?: Money;
}) {
  const P0 = params.principal;
  assertNonNegative("Principal", P0);
  const extraMonthly = params.extraMonthlyPayment ?? 0;
  const onceOff = params.onceOffExtraPayment ?? 0;
  assertNonNegative("Extra monthly payment", extraMonthly);
  assertNonNegative("Once-off extra payment", onceOff);

  const { monthlyPayment, monthlyRate, numberPayments } = calculateMonthlyBondPayment({
    principal: P0,
    annualInterestRatePercent: params.annualInterestRatePercent,
    termYears: params.termYears
  });

  let balance = P0;
  const schedule: Array<{
    month: number;
    payment: Money;
    interest: Money;
    principal: Money;
    balance: Money;
    extra: Money;
  }> = [];

  for (let m = 1; m <= numberPayments && balance > 0; m += 1) {
    const interest = balance * monthlyRate;
    const basePayment = monthlyPayment;
    const extra = (m === 1 ? onceOff : 0) + extraMonthly;
    const payment = Math.min(balance + interest, basePayment + extra);
    const principal = Math.max(0, payment - interest);
    balance = Math.max(0, balance - principal);
    schedule.push({ month: m, payment, interest, principal, balance, extra });
    if (m > 2000) break; // safety
  }

  const totalPaid = schedule.reduce((s, x) => s + x.payment, 0);
  const totalInterest = schedule.reduce((s, x) => s + x.interest, 0);
  const monthsToPayoff = schedule.length;

  // yearly aggregates for charts
  const yearly = new Map<number, { year: number; interest: Money; principal: Money; balanceEnd: Money }>();
  schedule.forEach((row) => {
    const year = Math.ceil(row.month / 12);
    const y = yearly.get(year) ?? { year, interest: 0, principal: 0, balanceEnd: row.balance };
    y.interest += row.interest;
    y.principal += row.principal;
    y.balanceEnd = row.balance;
    yearly.set(year, y);
  });

  return {
    monthlyPayment,
    monthlyRate,
    numberPayments,
    schedule,
    yearly: Array.from(yearly.values()).sort((a, b) => a.year - b.year),
    totalPaid,
    totalInterest,
    monthsToPayoff
  };
}

export function calculateFutureValue(params: { presentValue: Money; annualRatePercent: Percent; years: number }) {
  const r = params.annualRatePercent / 100;
  return params.presentValue * (1 + r) ** params.years;
}

export function calculateEquityGrowth(params: {
  propertyValue: Money;
  annualAppreciationPercent: Percent;
  loanBalance: Money;
  years: number;
}) {
  const futureValue = calculateFutureValue({
    presentValue: params.propertyValue,
    annualRatePercent: params.annualAppreciationPercent,
    years: params.years
  });
  const equity = futureValue - params.loanBalance;
  return { futurePropertyValue: futureValue, futureEquity: equity };
}

