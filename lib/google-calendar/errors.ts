export class GoogleApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Ağ hatası, 429 ve 5xx tekrar denenebilir; 4xx (yetki vb.) genellikle denenmez */
    public readonly retryable: boolean,
    public readonly authFailure = false,
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

export function classifyStatus(status: number): { retryable: boolean; authFailure: boolean } {
  if (status === 401) return { retryable: true, authFailure: true };
  if (status === 403) return { retryable: false, authFailure: true };
  if (status === 429 || status >= 500) return { retryable: true, authFailure: false };
  return { retryable: false, authFailure: false };
}
