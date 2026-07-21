export function normalizeRealtimeClientError(cause: unknown) {
  if (cause instanceof DOMException && cause.name === "NotAllowedError") {
    return "Microphone permission was denied.";
  }
  if (cause instanceof Error) return cause.message;
  return "GPT Live could not be started.";
}
