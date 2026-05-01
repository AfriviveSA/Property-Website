type SendInvoiceEmailInput = {
  to: string;
  subject: string;
  text: string;
};

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
  );
}

export async function sendInvoiceEmail(input: SendInvoiceEmailInput) {
  const configured = smtpConfigured();
  console.log("[invoice-email] send attempt", { to: input.to, configured });

  if (!configured) {
    return {
      ok: false as const,
      message: "Email provider not configured."
    };
  }

  // Placeholder only: provider-specific integration will be wired later.
  return {
    ok: true as const,
    message: "Email provider configured. Email send is scaffolded for provider integration."
  };
}
