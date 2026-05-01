import { Router } from "express";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import PdfPrinter from "pdfmake";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { authRequired, AuthRequest } from "../middleware/auth.js";
import { db } from "../config/db.js";
import type { CalculatorResult, ChartData } from "../utils/calculatorTypes.js";

export const reportRoutes = Router();
const chartCanvas = new ChartJSNodeCanvas({ width: 800, height: 400, backgroundColour: "white" });
const fonts = {
  Roboto: {
    normal: path.join(process.cwd(), "node_modules/pdfmake/examples/fonts/Roboto-Regular.ttf"),
    bold: path.join(process.cwd(), "node_modules/pdfmake/examples/fonts/Roboto-Medium.ttf"),
    italics: path.join(process.cwd(), "node_modules/pdfmake/examples/fonts/Roboto-Italic.ttf"),
    bolditalics: path.join(process.cwd(), "node_modules/pdfmake/examples/fonts/Roboto-MediumItalic.ttf")
  }
};
const printer = new PdfPrinter(fonts as any);

const m = (l: number, t: number, r: number, b: number) => [l, t, r, b] as [number, number, number, number];

async function generateReportPdfForCalculation(opts: {
  calculationId: number;
  userId: number;
}) {
  const calc = await db.calculation.findFirst({
    where: { id: opts.calculationId, user_id: opts.userId }
  });
  if (!calc) return { ok: false as const, status: 404 as const, message: "Not found" };

  const dir = path.join(process.cwd(), "reports");
  await fs.mkdir(dir, { recursive: true });

  const input = JSON.parse(calc.input_json) as Record<string, unknown>;
  const result = JSON.parse(calc.result_json) as CalculatorResult | Record<string, unknown>;

  const asCalc = (result as any)?.calculator ? (result as CalculatorResult) : null;
  const scenarioName = asCalc?.scenarioName ?? (input as any)?.scenarioName ?? null;
  const interpretationText = asCalc?.interpretation?.text ?? "No interpretation available.";
  const warnings = asCalc?.interpretation?.warnings ?? [];
  const assumptionsUsed = asCalc?.assumptionsUsed ?? {};
  const breakdown = asCalc?.breakdown ?? result;

  const firstChart: ChartData | null = asCalc?.chartData?.[0] ?? null;
  const chartImage = firstChart
    ? await chartCanvas.renderToDataURL({
        type: firstChart.chartType,
        data: firstChart.data as any,
        options: firstChart.options as any
      })
    : await chartCanvas.renderToDataURL({
        type: "bar",
        data: {
          labels: ["No chart data"],
          datasets: [{ label: "N/A", data: [1], backgroundColor: "#007acc" }]
        }
      });

  const user = await db.user.findUnique({ where: { id: opts.userId } });
  const fileName = `report-${calc.id}-${Date.now()}.pdf`;
  const target = path.join(dir, fileName);
  const doc = printer.createPdfKitDocument({
    info: { title: `The Property Guy Report - ${calc.type}` },
    content: [
      { text: "The Property Guy", style: "header" },
      { text: "South African Property Investment Report", style: "tagline" },
      { text: `Report ID: ${calc.id}`, margin: m(0, 8, 0, 0) },
      { text: `Generated: ${new Date().toISOString()}` },
      { text: `User: ${user?.name ?? user?.email ?? "Member"}` },
      { text: `Calculator: ${calc.type}`, margin: m(0, 8, 0, 0) },
      { text: `Scenario: ${scenarioName ?? "Untitled scenario"}`, margin: m(0, 4, 0, 8) },
      { text: "Inputs", style: "subheader" },
      { text: JSON.stringify(input, null, 2), style: "code" },
      { text: "Outputs", style: "subheader", margin: m(0, 10, 0, 0) },
      { text: JSON.stringify(asCalc?.summary ?? result, null, 2), style: "code" },
      { text: "Detailed breakdown (intermediate calculations)", style: "subheader", margin: m(0, 10, 0, 0) },
      { text: JSON.stringify(breakdown, null, 2), style: "code" },
      { text: "Interpretation", style: "subheader", margin: m(0, 10, 0, 0) },
      { text: interpretationText },
      ...(warnings.length
        ? [{ text: "Warnings", style: "subheader", margin: m(0, 10, 0, 0) }, { text: warnings.map((w: string) => `- ${w}`).join("\n") }]
        : []),
      { text: "Assumptions", style: "subheader", margin: m(0, 10, 0, 0) },
      { text: JSON.stringify(assumptionsUsed, null, 2), style: "code" },
      { text: "Chart Summary", style: "subheader", margin: m(0, 10, 0, 4) },
      { image: chartImage, width: 480 },
      {
        text: "Disclaimer: This report is an estimate for educational purposes and is not financial, tax or legal advice.",
        margin: m(0, 16, 0, 0)
      }
    ],
    styles: {
      header: { fontSize: 22, bold: true, color: "#007acc" },
      tagline: { fontSize: 12, color: "#333333" },
      subheader: { fontSize: 14, bold: true, margin: [0, 12, 0, 6] },
      code: { fontSize: 9 }
    },
    defaultStyle: { font: "Roboto" }
  });

  await new Promise<void>((resolve, reject) => {
    const stream = fsSync.createWriteStream(target);
    doc.pipe(stream);
    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", (err) => reject(err));
  });

  await db.calculation.update({ where: { id: calc.id }, data: { pdf_path: target } });
  return { ok: true as const, target };
}

reportRoutes.post("/:id/generate", authRequired, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const generated = await generateReportPdfForCalculation({ calculationId: id, userId: req.userId! });
    if (!generated.ok) return res.status(generated.status).json({ message: generated.message });
    return res.json({ message: "Report generated", downloadUrl: `/api/reports/${id}` });
  } catch (err: any) {
    console.error("[reports] POST /:id/generate failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to generate report." });
  }
});

reportRoutes.get("/:id", authRequired, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const report = await db.calculation.findFirst({ where: { id, user_id: req.userId! } });
    if (!report) return res.status(404).json({ message: "Not found" });
    if (!report.pdf_path) {
      const generated = await generateReportPdfForCalculation({ calculationId: id, userId: req.userId! });
      if (!generated.ok) return res.status(generated.status).json({ message: generated.message });
      return res.download(generated.target);
    }
    return res.download(report.pdf_path);
  } catch (err: any) {
    console.error("[reports] GET /:id failed", err?.stack ?? err);
    return res.status(500).json({ message: "Failed to download report." });
  }
});
