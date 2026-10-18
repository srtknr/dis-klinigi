export type ActionSuccess<T> = { ok: true; data: T; message?: string };

export type ActionFailure = {
  ok: false;
  error: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
  details?: Record<string, unknown>;
};

export type ActionResult<T = null> = ActionSuccess<T> | ActionFailure;
