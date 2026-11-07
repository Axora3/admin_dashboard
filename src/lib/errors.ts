export function messageOf(error: unknown): string {
  if (error && typeof error === "object" && "userMessage" in error) {
    const userMessage = (error as { userMessage?: unknown }).userMessage;
    if (typeof userMessage === "string" && userMessage.trim()) return userMessage;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Алдаа гарлаа. Дахин оролдоно уу.";
}
