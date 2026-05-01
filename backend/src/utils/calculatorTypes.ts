export type Money = number; // ZAR numeric
export type Percent = number; // percent 0-100

export type MetricUnit = "currency" | "percent" | "number";

export type SummaryMetric = {
  key: string;
  label: string;
  unit: MetricUnit;
  value: number;
  formatted: string;
};

export type ChartType = "line" | "bar" | "doughnut";

export type ChartData = {
  chartType: ChartType;
  title: string;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      borderWidth?: number;
      fill?: boolean;
      stack?: string;
    }>;
  };
  options?: Record<string, unknown>;
};

export type CalculatorInterpretation = {
  text: string;
  classification?: "weak" | "tight" | "acceptable" | "strong" | "very-strong";
  warnings: string[];
};

export type CalculatorResult = {
  calculator: string;
  scenarioName?: string;
  summary: SummaryMetric[];
  breakdown: Record<string, unknown>;
  interpretation: CalculatorInterpretation;
  chartData: ChartData[];
  assumptionsUsed: Record<string, unknown>;
};

