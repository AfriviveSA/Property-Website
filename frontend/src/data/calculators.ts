export type FieldType = "money" | "percent" | "number" | "select" | "checkbox" | "text";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  help?: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string | number | boolean }>;
};

export type FieldGroup = {
  title: string;
  fields: FieldDef[];
};

export type CalculatorDef = {
  slug: string;
  name: string;
  description: string;
  groups: FieldGroup[];
};

const scenarioGroup: FieldGroup = {
  title: "Scenario",
  fields: [
    { key: "scenarioName", label: "Scenario name", type: "text", placeholder: "e.g. 2-bed townhouse in Cape Town", required: false }
  ]
};

export const calculators: CalculatorDef[] = [
  {
    slug: "transfer-bond-costs",
    name: "Transfer & Bond Costs (South Africa)",
    description: "Estimate upfront purchase costs: transfer duty, attorney fees, deeds office fees and municipal provision.",
    groups: [
      scenarioGroup,
      {
        title: "Purchase details",
        fields: [
          { key: "purchasePrice", label: "Purchase price (R)", type: "money", required: true },
          { key: "depositAmount", label: "Deposit (optional, R)", type: "money", required: false },
          { key: "bondAmount", label: "Bond amount (R)", type: "money", required: true }
        ]
      },
      {
        title: "Transaction flags",
        fields: [
          { key: "propertyIsVatTransaction", label: "VAT transaction (transfer duty = R0)", type: "checkbox" },
          { key: "includeBondRegistration", label: "Include bond registration fees", type: "checkbox" }
        ]
      }
    ]
  },
  {
    slug: "monthly-payment",
    name: "Monthly Bond Payment",
    description: "Calculate monthly repayment, total interest, and full amortisation schedule (with extra payments).",
    groups: [
      scenarioGroup,
      {
        title: "Loan details",
        fields: [
          { key: "purchasePrice", label: "Purchase price (optional, R)", type: "money" },
          { key: "depositAmount", label: "Deposit (R)", type: "money" },
          { key: "bondAmount", label: "Bond amount (leave blank to auto-calc)", type: "money" },
          { key: "annualInterestRate", label: "Annual interest rate (%)", type: "percent", required: true },
          {
            key: "loanTermYears",
            label: "Loan term (years)",
            type: "select",
            required: true,
            options: [
              { label: "10", value: 10 },
              { label: "15", value: 15 },
              { label: "20", value: 20 },
              { label: "25", value: 25 },
              { label: "30", value: 30 }
            ]
          }
        ]
      },
      {
        title: "Extra payments (optional)",
        fields: [
          { key: "extraMonthlyPayment", label: "Extra monthly payment (R)", type: "money" },
          { key: "onceOffExtraPayment", label: "Once-off extra payment (R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "cash-flow",
    name: "Cash Flow",
    description: "See whether the property produces monthly positive or negative cash flow after vacancy, expenses and debt service.",
    groups: [
      scenarioGroup,
      {
        title: "Income",
        fields: [
          { key: "monthlyRent", label: "Monthly rent (R)", type: "money", required: true },
          { key: "otherMonthlyIncome", label: "Other monthly income (R)", type: "money" },
          { key: "annualRentGrowthPercent", label: "Annual rent growth (optional, %)", type: "percent" }
        ]
      },
      { title: "Vacancy", fields: [{ key: "vacancyRatePercent", label: "Vacancy rate (%)", type: "percent" }] },
      {
        title: "Operating expenses (monthly)",
        fields: [
          { key: "ratesAndTaxes", label: "Rates & taxes (R)", type: "money" },
          { key: "levies", label: "Levies (R)", type: "money" },
          { key: "insurance", label: "Insurance (R)", type: "money" },
          { key: "maintenance", label: "Maintenance (R)", type: "money" },
          { key: "propertyManagementPercent", label: "Property management (% of income)", type: "percent" },
          { key: "utilitiesPaidByOwner", label: "Utilities paid by owner (R)", type: "money" },
          { key: "accountingAdmin", label: "Accounting/admin (R)", type: "money" },
          { key: "otherExpenses", label: "Other expenses (R)", type: "money" }
        ]
      },
      { title: "Debt service", fields: [{ key: "monthlyBondPayment", label: "Monthly bond payment (R)", type: "money" }] }
    ]
  },
  {
    slug: "cash-on-cash-return",
    name: "Cash-on-Cash ROI",
    description: "Annual pre-tax cash flow divided by total cash invested (deposit + costs + repairs + etc.).",
    groups: [
      scenarioGroup,
      {
        title: "Cash invested",
        fields: [
          { key: "purchasePrice", label: "Purchase price (R)", type: "money" },
          { key: "depositAmount", label: "Deposit (R)", type: "money" },
          { key: "transferAndBondCosts", label: "Transfer & bond costs (R)", type: "money" },
          { key: "initialRepairs", label: "Initial repairs (R)", type: "money" },
          { key: "furnishingCosts", label: "Furnishing (R)", type: "money" },
          { key: "otherAcquisitionCosts", label: "Other acquisition costs (R)", type: "money" }
        ]
      },
      {
        title: "Cash flow",
        fields: [
          { key: "annualCashFlow", label: "Annual cash flow (R) (optional)", type: "money", help: "If you don’t know it, leave blank and fill in the cash-flow inputs below." },
          { key: "monthlyRent", label: "Monthly rent (R)", type: "money" },
          { key: "otherMonthlyIncome", label: "Other monthly income (R)", type: "money" },
          { key: "vacancyRatePercent", label: "Vacancy rate (%)", type: "percent" },
          { key: "monthlyOperatingExpenses", label: "Monthly operating expenses (R)", type: "money" },
          { key: "monthlyDebtService", label: "Monthly debt service (R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "noi",
    name: "Net Operating Income (NOI)",
    description: "Income before financing and tax. Excludes bond repayment, tax, depreciation and capital improvements.",
    groups: [
      scenarioGroup,
      {
        title: "Income",
        fields: [
          { key: "grossMonthlyRent", label: "Gross monthly rent (R)", type: "money", required: true },
          { key: "otherMonthlyIncome", label: "Other monthly income (R)", type: "money" },
          { key: "vacancyRatePercent", label: "Vacancy rate (%)", type: "percent" }
        ]
      },
      {
        title: "Operating expenses (monthly)",
        fields: [
          { key: "ratesAndTaxes", label: "Rates & taxes (R)", type: "money" },
          { key: "levies", label: "Levies (R)", type: "money" },
          { key: "insurance", label: "Insurance (R)", type: "money" },
          { key: "maintenance", label: "Maintenance (R)", type: "money" },
          { key: "propertyManagement", label: "Property management (R)", type: "money" },
          { key: "utilities", label: "Utilities (R)", type: "money" },
          { key: "admin", label: "Admin (R)", type: "money" },
          { key: "otherOperatingExpenses", label: "Other operating expenses (R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "cap-rate",
    name: "Cap Rate",
    description: "Compare property yield independent of financing: annual NOI / property value.",
    groups: [
      scenarioGroup,
      {
        title: "Inputs",
        fields: [
          { key: "propertyValue", label: "Property value (R)", type: "money" },
          { key: "annualNOI", label: "Annual NOI (R)", type: "money" },
          { key: "targetCapRatePercent", label: "Target cap rate (%)", type: "percent" }
        ]
      }
    ]
  },
  {
    slug: "dscr",
    name: "DSCR",
    description: "Debt Service Coverage Ratio: annual NOI / annual debt service.",
    groups: [
      scenarioGroup,
      {
        title: "Inputs",
        fields: [
          { key: "annualNOI", label: "Annual NOI (R)", type: "money" },
          { key: "monthlyBondPayment", label: "Monthly bond payment (R) (optional)", type: "money" },
          { key: "annualDebtService", label: "Annual debt service (R) (optional)", type: "money", help: "If blank, we’ll calculate it from monthly bond payment." }
        ]
      }
    ]
  },
  {
    slug: "irr",
    name: "IRR",
    description: "Annualised return considering timing of cash flows and sale proceeds.",
    groups: [
      scenarioGroup,
      {
        title: "Hold period & cash flows",
        fields: [
          { key: "initialCashInvested", label: "Initial cash invested (negative, R)", type: "money", required: true },
          { key: "holdPeriodYears", label: "Hold period (years)", type: "number", required: true },
          { key: "annualCashFlows", label: "Annual cash flows (comma-separated, R)", type: "text", help: "Example: 12000, 14000, 16000" }
        ]
      },
      {
        title: "Exit assumptions",
        fields: [
          { key: "expectedSalePrice", label: "Expected sale price (R)", type: "money" },
          { key: "sellingCostsPercent", label: "Selling costs (%)", type: "percent" },
          { key: "remainingLoanBalanceAtSale", label: "Remaining loan balance at sale (R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "brrrr",
    name: "BRRRR",
    description: "Buy, Renovate, Rent, Refinance, Repeat analysis.",
    groups: [
      scenarioGroup,
      {
        title: "Project costs",
        fields: [
          { key: "purchasePrice", label: "Purchase price (R)", type: "money" },
          { key: "rehabCost", label: "Rehab cost (R)", type: "money" },
          { key: "transferAndBondCosts", label: "Transfer & bond costs (R)", type: "money" }
        ]
      },
      {
        title: "Refinance",
        fields: [
          { key: "afterRepairValue", label: "After repair value (ARV) (R)", type: "money" },
          { key: "refinanceLTVPercent", label: "Refinance LTV (%)", type: "percent" },
          { key: "originalLoanPayoff", label: "Original loan payoff (R)", type: "money" },
          { key: "newInterestRate", label: "New interest rate (%)", type: "percent" },
          {
            key: "loanTermYears",
            label: "New loan term (years)",
            type: "select",
            options: [
              { label: "10", value: 10 },
              { label: "15", value: 15 },
              { label: "20", value: 20 },
              { label: "25", value: 25 },
              { label: "30", value: 30 }
            ]
          }
        ]
      },
      {
        title: "Rental (post-refi)",
        fields: [
          { key: "rentMonthly", label: "Monthly rent (R)", type: "money" },
          { key: "vacancyRatePercent", label: "Vacancy rate (%)", type: "percent" },
          { key: "monthlyOperatingExpenses", label: "Monthly operating expenses (R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "short-term-rental",
    name: "Airbnb / Short-term rental",
    description: "Analyse short-term rental income, fees, and net cash flow.",
    groups: [
      scenarioGroup,
      {
        title: "Revenue",
        fields: [
          { key: "averageDailyRate", label: "Average daily rate (R)", type: "money" },
          { key: "occupancyRatePercent", label: "Occupancy rate (%)", type: "percent" },
          { key: "availableNightsPerMonth", label: "Available nights per month", type: "number" },
          { key: "cleaningFeePerStay", label: "Cleaning fee per stay (R)", type: "money" },
          { key: "averageStayLength", label: "Average stay length (nights)", type: "number" }
        ]
      },
      {
        title: "Fees & expenses",
        fields: [
          { key: "platformFeePercent", label: "Platform fee (%)", type: "percent" },
          { key: "managementFeePercent", label: "Management fee (%)", type: "percent" },
          { key: "suppliesMonthly", label: "Supplies (monthly, R)", type: "money" },
          { key: "utilitiesMonthly", label: "Utilities (monthly, R)", type: "money" },
          { key: "insuranceMonthly", label: "Insurance (monthly, R)", type: "money" },
          { key: "ratesAndTaxesMonthly", label: "Rates & taxes (monthly, R)", type: "money" },
          { key: "maintenanceMonthly", label: "Maintenance (monthly, R)", type: "money" },
          { key: "monthlyDebtService", label: "Debt service (monthly, R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "70-rule",
    name: "70% Rule",
    description: "Estimate maximum offer for a flip using the 70% rule and a custom cost/profit model.",
    groups: [
      scenarioGroup,
      {
        title: "Inputs",
        fields: [
          { key: "afterRepairValue", label: "After repair value (ARV) (R)", type: "money" },
          { key: "estimatedRepairCost", label: "Estimated repair cost (R)", type: "money" },
          { key: "desiredProfitMargin", label: "Desired profit margin (%)", type: "percent" },
          { key: "sellingCosts", label: "Selling costs (R)", type: "money" },
          { key: "holdingCosts", label: "Holding costs (R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "flip-profit",
    name: "Flip Profit",
    description: "Calculate expected profit, ROI and break-even sale price for a flip.",
    groups: [
      scenarioGroup,
      {
        title: "Costs",
        fields: [
          { key: "purchasePrice", label: "Purchase price (R)", type: "money" },
          { key: "rehabCost", label: "Rehab cost (R)", type: "money" },
          { key: "holdingCosts", label: "Holding costs (R)", type: "money" },
          { key: "transferCosts", label: "Transfer costs (R)", type: "money" },
          { key: "financingCosts", label: "Financing costs (R)", type: "money" },
          { key: "contingencyPercent", label: "Contingency (%)", type: "percent" }
        ]
      },
      {
        title: "Sale",
        fields: [
          { key: "sellingPrice", label: "Selling price (R)", type: "money" },
          { key: "sellingAgentCommissionPercent", label: "Agent commission (%)", type: "percent" }
        ]
      }
    ]
  },
  {
    slug: "wholesale-profit",
    name: "Wholesale Profit",
    description: "Estimate buyer max offer and your max contract price after assignment fee.",
    groups: [
      scenarioGroup,
      {
        title: "Inputs",
        fields: [
          { key: "afterRepairValue", label: "After repair value (ARV) (R)", type: "money" },
          { key: "repairCost", label: "Repair cost (R)", type: "money" },
          { key: "desiredInvestorProfit", label: "Desired investor profit (R)", type: "money" },
          { key: "assignmentFee", label: "Assignment fee (R)", type: "money" },
          { key: "buyerMaxOfferPercent", label: "Buyer max offer % of ARV", type: "percent" }
        ]
      }
    ]
  },
  {
    slug: "rehab-cost",
    name: "Rehab Estimator",
    description: "Estimate renovation budget from line items and contingency.",
    groups: [
      scenarioGroup,
      {
        title: "Rehab",
        fields: [
          { key: "contingencyPercent", label: "Contingency (%)", type: "percent" },
          { key: "items", label: "Line items (JSON)", type: "text", help: "For now, enter JSON array: [{\"category\":\"kitchen\",\"description\":\"Counters\",\"quantity\":1,\"unitCost\":20000}]" }
        ]
      }
    ]
  },
  {
    slug: "rent-to-cost-ratio",
    name: "Rent-to-Cost Ratio",
    description: "Quick screening metric comparing rent to price (1% and 2% rules).",
    groups: [
      scenarioGroup,
      {
        title: "Inputs",
        fields: [
          { key: "monthlyRent", label: "Monthly rent (R)", type: "money" },
          { key: "purchasePrice", label: "Purchase price (R)", type: "money" },
          { key: "initialRepairCost", label: "Initial repair cost (optional, R)", type: "money" },
          { key: "totalAcquisitionCost", label: "Total acquisition cost (optional, R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "grm",
    name: "Gross Rent Multiplier (GRM)",
    description: "Quick valuation metric based on gross rent (ignores expenses and financing).",
    groups: [
      scenarioGroup,
      {
        title: "Inputs",
        fields: [
          { key: "purchasePrice", label: "Purchase price (R)", type: "money" },
          { key: "monthlyGrossRent", label: "Monthly gross rent (R)", type: "money" },
          { key: "targetGRM", label: "Target GRM", type: "number" }
        ]
      }
    ]
  },
  {
    slug: "ltv",
    name: "Loan-to-Value (LTV)",
    description: "Measure leverage and equity: loan amount / property value.",
    groups: [
      scenarioGroup,
      {
        title: "Inputs",
        fields: [
          { key: "propertyValue", label: "Property value (R)", type: "money" },
          { key: "loanAmount", label: "Loan amount (R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "dcf",
    name: "Discounted Cash Flow (DCF)",
    description: "Estimate today’s value of future cash flows and compute NPV at a chosen discount rate.",
    groups: [
      scenarioGroup,
      {
        title: "Inputs",
        fields: [
          { key: "initialInvestment", label: "Initial investment (R)", type: "money" },
          { key: "discountRatePercent", label: "Discount rate (%)", type: "percent" },
          { key: "annualCashFlows", label: "Annual cash flows (comma-separated, R)", type: "text" },
          { key: "salePriceAtEnd", label: "Sale price at end (R)", type: "money" },
          { key: "sellingCosts", label: "Selling costs (R)", type: "money" },
          { key: "holdPeriodYears", label: "Hold period (years)", type: "number" }
        ]
      }
    ]
  },
  {
    slug: "operating-expense-ratio",
    name: "Operating Expense Ratio",
    description: "Total operating expenses divided by gross income.",
    groups: [
      scenarioGroup,
      {
        title: "Inputs",
        fields: [
          { key: "annualOperatingExpenses", label: "Annual operating expenses (R)", type: "money" },
          { key: "annualGrossIncome", label: "Annual gross income (R)", type: "money" }
        ]
      }
    ]
  },
  {
    slug: "square-footage",
    name: "Square Footage / Area",
    description: "Compute area in square metres and feet (plus definitions).",
    groups: [
      scenarioGroup,
      { title: "Inputs", fields: [{ key: "length", label: "Length (m)", type: "number" }, { key: "width", label: "Width (m)", type: "number" }] }
    ]
  }
];
