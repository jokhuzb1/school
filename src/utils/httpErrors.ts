function extractErrorMessage(err: any): string {
  if (typeof err === "string") return err;
  if (typeof err?.message === "string" && err.message.trim()) return err.message.trim();
  if (typeof err?.error === "string" && err.error.trim()) return err.error.trim();
  return "error";
}

function parseJsonError(message: string): string {
  const trimmed = message.trim();
  if (!trimmed.startsWith("{")) return message;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed?.error === "string" && parsed.error.trim()) return parsed.error.trim();
    if (typeof parsed?.message === "string" && parsed.message.trim()) return parsed.message.trim();
  } catch {
    // keep original text
  }
  return message;
}

function mapFriendlyError(rawMessage: string, status: number): string {
  const message = parseJsonError(rawMessage);
  const lower = message.toLowerCase();

  if (lower.includes("unknown argument `firstname`") || lower.includes("unknown argument `lastname`")) {
    return "Server sxemasi yangilanmagan (firstName/lastName). Iltimos backendni yangilang.";
  }

  if (lower.includes("studentprovisioning") && lower.includes("does not exist")) {
    return "Server migratsiyasi toliq emas (StudentProvisioning jadvali topilmadi).";
  }

  if (status >= 500) {
    return "Ichki server xatoligi. Iltimos keyinroq qayta urinib koring.";
  }

  return message;
}

export function sendHttpError(reply: any, err: any) {
  const status = Number(err?.statusCode) || 500;
  const rawMessage = extractErrorMessage(err);
  const error = mapFriendlyError(rawMessage, status);

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  return reply.status(status).send({ error });
}
