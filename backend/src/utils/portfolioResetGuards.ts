export function assertPortfolioResetAllowed(input: { nodeEnv: string | undefined; confirm: string }) {
  if (input.nodeEnv === "production") {
    throw new Error("Refusing to run: NODE_ENV=production");
  }
  if (input.confirm !== "RESET") {
    throw new Error('Refusing to run without "--confirm RESET"');
  }
}

