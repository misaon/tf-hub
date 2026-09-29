import { FetchError, ofetch } from "ofetch";

import { getValidIdToken } from "../auth/tokens.ts";
import { apiBaseUrl, apiRequestTimeoutMs, appLocale, idTokenHeaderName, webApplicationOrigin } from "../config.ts";
import { recordTruncatedPage } from "./paging.ts";

// The union type is the single source of allowed methods — no runtime constants needed.
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

type QueryValue = string | number | boolean | readonly (string | number)[] | undefined;

export interface CallApiOptions {
  method?: HttpMethod;
  query?: Record<string, QueryValue>;
  body?: Record<string, unknown>;
}

const apiClient = ofetch.create({
  baseURL: apiBaseUrl,
  timeout: apiRequestTimeoutMs,
  headers: {
    accept: "application/json",
    "accept-language": appLocale,
    origin: webApplicationOrigin,
    referer: `${webApplicationOrigin}/`,
  },
});

function asSentence(text: string): string {
  const trimmed = text.trim();

  if (trimmed === "") {
    return "";
  }

  return trimmed.endsWith(".") ? ` ${trimmed}` : ` ${trimmed}.`;
}

function describeServerError(error: FetchError): string {
  const payload: unknown = error.data;

  if (payload === null || typeof payload !== "object" || !("message" in payload)) {
    return "";
  }

  const { message } = payload;

  if (typeof message === "string") {
    return asSentence(message);
  }

  if (Array.isArray(message)) {
    return asSentence(message.filter((item) => typeof item === "string").join("; "));
  }

  return "";
}

function adviceFor(status: number | undefined): string {
  if (status === 401) {
    return " Your session has expired — run `tf-hub login`.";
  }

  if (status === 403) {
    return " Your account is missing the TF Hub permission this operation requires — ask a TF Hub administrator.";
  }

  return "";
}

export class ApiRequestError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status: number | undefined, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

function requestFailure(path: string, error: unknown): unknown {
  if (!(error instanceof FetchError)) {
    return error;
  }

  const reason = error.status === undefined ? "network error or timeout" : `HTTP ${error.status}`;

  return new ApiRequestError(
    `Request to ${path} failed (${reason}).${describeServerError(error)}${adviceFor(error.status)}`,
    error.status,
    { cause: error },
  );
}

// Returns the whole response body; most callers want `callApi`, which unwraps the `data` envelope.
export async function callApiEnvelope(path: string, options: CallApiOptions = {}): Promise<unknown> {
  const idToken = await getValidIdToken();
  const response = await apiClient<unknown>(path, {
    method: options.method ?? "GET",
    headers: { [idTokenHeaderName]: idToken },
    ...(options.query ? { query: options.query } : {}),
    ...(options.body ? { body: options.body } : {}),
  }).catch((error: unknown) => {
    throw requestFailure(path, error);
  });

  recordTruncatedPage(path, response);

  return response;
}

export async function callApi(path: string, options: CallApiOptions = {}): Promise<unknown> {
  const response = await callApiEnvelope(path, options);

  if (response !== null && typeof response === "object" && "data" in response) {
    return response.data;
  }

  // A few endpoints (e.g. substitute group deletion) reply with an empty body.
  return response;
}
