import { calculate } from "../../src/utils/calculatorEngine";

describe("Calculator engine (Phase 4 contract)", () => {
  test("transfer-bond-costs: VAT transaction sets transfer duty to 0", () => {
    const r: any = calculate("transfer-bond-costs", {
      purchasePrice: 2_000_000,
      bondAmount: 1_500_000,
      propertyIsVatTransaction: true
    });
    expect(r.calculator).toBe("transfer-bond-costs");
    expect(r.breakdown.transferDuty).toBe(0);
    expect(Array.isArray(r.summary)).toBe(true);
    expect(Array.isArray(r.chartData)).toBe(true);
  });

  test("transfer-bond-costs: SARS duty bracket sanity check", () => {
    const r: any = calculate("transfer-bond-costs", {
      purchasePrice: 1_663_800,
      bondAmount: 0,
      propertyIsVatTransaction: false
    });
    // 3% above 1,210,000 on 453,800 = 13,614
    expect(r.breakdown.transferDuty).toBeCloseTo(13614, 2);
  });

  test("monthly-payment: base amortisation returns schedule + totals", () => {
    const r: any = calculate("monthly-payment", {
      bondAmount: 1_000_000,
      annualInterestRate: 12,
      loanTermYears: 20
    });
    expect(r.calculator).toBe("monthly-payment");
    expect(r.breakdown.amortisationScheduleMonthly.length).toBeGreaterThan(10);
    expect(r.breakdown.totalInterest).toBeGreaterThan(0);
  });

  test("cash-flow: 100% vacancy produces negative NOI unless expenses are zero", () => {
    const r: any = calculate("cash-flow", {
      monthlyRent: 10_000,
      otherMonthlyIncome: 0,
      vacancyRatePercent: 100,
      ratesAndTaxes: 1000,
      levies: 0,
      insurance: 0,
      maintenance: 0,
      propertyManagementPercent: 0,
      utilitiesPaidByOwner: 0,
      accountingAdmin: 0,
      otherExpenses: 0,
      monthlyBondPayment: 0
    });
    expect(r.breakdown.effectiveMonthlyIncome).toBeCloseTo(0, 2);
    expect(r.breakdown.monthlyNOI).toBeLessThan(0);
  });

  test("cash-on-cash-return: classification is weak when return < 5%", () => {
    const r: any = calculate("cash-on-cash-return", {
      purchasePrice: 1_000_000,
      depositAmount: 100_000,
      transferAndBondCosts: 50_000,
      initialRepairs: 0,
      furnishingCosts: 0,
      otherAcquisitionCosts: 0,
      annualCashFlow: 5_000
    });
    expect(r.interpretation.classification).toBe("weak");
  });

  test("noi: excludes debt service and returns OER", () => {
    const r: any = calculate("noi", {
      grossMonthlyRent: 10_000,
      otherMonthlyIncome: 0,
      vacancyRatePercent: 10,
      ratesAndTaxes: 1000,
      levies: 500,
      insurance: 200,
      maintenance: 300,
      propertyManagement: 0,
      utilities: 0,
      admin: 0,
      otherOperatingExpenses: 0
    });
    expect(r.breakdown.noiAnnual).toBeDefined();
    expect(r.breakdown.operatingExpenseRatioPercent).toBeGreaterThanOrEqual(0);
  });

  test("cap-rate: cap rate = NOI / value", () => {
    const r: any = calculate("cap-rate", { propertyValue: 1_000_000, annualNOI: 120_000, targetCapRatePercent: 8 });
    expect(r.breakdown.capRatePercent).toBeCloseTo(12, 2);
  });

  test("dscr: classification uses thresholds", () => {
    const r: any = calculate("dscr", { annualNOI: 120_000, annualDebtService: 100_000 });
    expect(r.breakdown.classification).toBe("tight");
  });

  test("irr: returns warning when IRR cannot be computed", () => {
    const r: any = calculate("irr", {
      initialCashInvested: -100_000,
      holdPeriodYears: 3,
      annualCashFlows: [0, 0, 0],
      expectedSalePrice: 0,
      remainingLoanBalanceAtSale: 0
    });
    expect(Array.isArray(r.interpretation.warnings)).toBe(true);
  });

  test("brrrr: cash left in deal computed and deal rating provided", () => {
    const r: any = calculate("brrrr", {
      purchasePrice: 600_000,
      rehabCost: 100_000,
      transferAndBondCosts: 30_000,
      afterRepairValue: 900_000,
      refinanceLTVPercent: 75,
      originalLoanPayoff: 0,
      rentMonthly: 10_000,
      vacancyRatePercent: 5,
      monthlyOperatingExpenses: 2_000,
      newInterestRate: 11,
      loanTermYears: 20
    });
    expect(r.breakdown.totalProjectCost).toBeGreaterThan(0);
    expect(r.breakdown.dealRating).toBeDefined();
  });

  test("short-term-rental: break-even occupancy can exceed 100% and adds warning", () => {
    const r: any = calculate("short-term-rental", {
      averageDailyRate: 500,
      occupancyRatePercent: 30,
      availableNightsPerMonth: 30,
      cleaningFeePerStay: 0,
      averageStayLength: 3,
      platformFeePercent: 3,
      managementFeePercent: 0,
      suppliesMonthly: 20_000,
      utilitiesMonthly: 0,
      insuranceMonthly: 0,
      ratesAndTaxesMonthly: 0,
      maintenanceMonthly: 0,
      furnishingCost: 0,
      monthlyDebtService: 0
    });
    expect(r.breakdown.breakEvenOccupancy).toBeGreaterThan(100);
    expect(r.interpretation.warnings.length).toBeGreaterThan(0);
  });

  test("70-rule: custom max offer can be negative and warns", () => {
    const r: any = calculate("70-rule", {
      afterRepairValue: 500_000,
      estimatedRepairCost: 450_000,
      desiredProfitMargin: 20,
      sellingCosts: 50_000,
      holdingCosts: 20_000
    });
    expect(r.interpretation.warnings.length).toBeGreaterThan(0);
  });

  test("flip-profit: negative profit warns", () => {
    const r: any = calculate("flip-profit", {
      purchasePrice: 900_000,
      rehabCost: 200_000,
      holdingCosts: 50_000,
      sellingPrice: 1_000_000,
      sellingAgentCommissionPercent: 5,
      transferCosts: 0,
      financingCosts: 0,
      contingencyPercent: 10
    });
    expect(r.breakdown.profit).toBeLessThan(0);
    expect(r.interpretation.warnings.length).toBeGreaterThan(0);
  });

  test("wholesale-profit: max contract price computed", () => {
    const r: any = calculate("wholesale-profit", {
      afterRepairValue: 1_000_000,
      repairCost: 200_000,
      desiredInvestorProfit: 100_000,
      assignmentFee: 50_000,
      buyerMaxOfferPercent: 70
    });
    expect(r.breakdown.yourMaxContractPrice).toBeDefined();
  });

  test("rehab-cost: contingency increases total", () => {
    const r: any = calculate("rehab-cost", {
      contingencyPercent: 10,
      items: [{ category: "kitchen", description: "Counters", quantity: 1, unitCost: 20_000 }]
    });
    expect(r.breakdown.totalRehabCost).toBeGreaterThan(r.breakdown.subtotal);
  });

  test("rent-to-cost-ratio: warns screening only", () => {
    const r: any = calculate("rent-to-cost-ratio", { monthlyRent: 10_000, purchasePrice: 1_000_000 });
    expect(r.interpretation.warnings.join(" ")).toMatch(/screening/i);
  });

  test("grm: annual rent computed", () => {
    const r: any = calculate("grm", { purchasePrice: 1_200_000, monthlyGrossRent: 10_000 });
    expect(r.breakdown.annualGrossRent).toBe(120_000);
  });

  test("ltv: ltv percent and equity computed", () => {
    const r: any = calculate("ltv", { propertyValue: 1_000_000, loanAmount: 800_000 });
    expect(r.breakdown.ltvPercent).toBeCloseTo(80, 4);
    expect(r.breakdown.riskClassification).toBe("normal");
  });

  test("dcf: NPV computed and decision included", () => {
    const r: any = calculate("dcf", {
      initialInvestment: 100_000,
      discountRatePercent: 10,
      annualCashFlows: [30_000, 30_000, 30_000],
      salePriceAtEnd: 0,
      sellingCosts: 0,
      holdPeriodYears: 3
    });
    expect(r.breakdown.npv).toBeDefined();
    expect(r.breakdown.investmentDecision).toBeDefined();
  });
});
