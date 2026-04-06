import { ConvexError } from "convex/values";

function extractMessage(err: unknown): string | null {
  if (err instanceof ConvexError) {
    if (typeof err.data === "string" && err.data.trim()) {
      return err.data.trim();
    }
    if (err.message?.trim()) return err.message.trim();
    return null;
  }
  if (err instanceof Error && err.message?.trim()) {
    return err.message.trim();
  }
  return null;
}

/** Strip noise Convex / runtimes sometimes prepend to `throw new Error("…")` messages. */
function sanitizeMessage(message: string): string {
  let m = message
    .replace(/^Uncaught Error:\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();
  if (m === "Server Error") return "";
  if (/^\[CONVEX\b/i.test(m)) return "";
  return m;
}

export function signInFormErrorMessage(err: unknown): string {
  const raw = extractMessage(err);
  if (!raw) {
    return "Could not sign you in. Please try again.";
  }
  const cleaned = sanitizeMessage(raw);
  if (!cleaned) {
    return "Could not sign you in. Please try again.";
  }
  const lower = cleaned.toLowerCase();
  if (lower.includes("invalid email or password")) {
    return "That email and password do not match our records. Try again or create an account.";
  }
  return cleaned;
}

export function signUpFormErrorMessage(err: unknown): string {
  const raw = extractMessage(err);
  if (!raw) {
    return "Could not create your account. Please try again.";
  }
  const cleaned = sanitizeMessage(raw);
  if (!cleaned) {
    return "Could not create your account. Please try again.";
  }
  return cleaned;
}
