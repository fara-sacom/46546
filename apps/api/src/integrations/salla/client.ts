import axios, { AxiosInstance } from "axios";
import { env } from "../../env.js";

export class SallaNotConfiguredError extends Error {
  constructor() {
    super(
      "تكامل سلة غير مُفعّل: يلزم ضبط SALLA_ACCESS_TOKEN في متغيرات البيئة قبل استخدام أي أداة تخص المتجر."
    );
    this.name = "SallaNotConfiguredError";
  }
}

let client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (!env.salla.accessToken) throw new SallaNotConfiguredError();
  if (client) return client;
  client = axios.create({
    baseURL: env.salla.baseUrl,
    timeout: 20_000,
    headers: {
      Authorization: `Bearer ${env.salla.accessToken}`,
      Accept: "application/json",
    },
  });
  return client;
}

export function isSallaConfigured(): boolean {
  return !!env.salla.accessToken;
}

async function request<T>(method: "get" | "post" | "put" | "delete", path: string, opts?: {
  params?: Record<string, unknown>;
  data?: unknown;
}): Promise<T> {
  const http = getClient();
  try {
    const res = await http.request<T>({ method, url: path, params: opts?.params, data: opts?.data });
    return res.data;
  } catch (err: any) {
    const status = err?.response?.status;
    const body = err?.response?.data;
    const message = body?.error?.message || body?.message || err.message || "Salla API request failed";
    const e = new Error(`Salla API error (${status ?? "network"}): ${message}`);
    (e as any).cause = body;
    throw e;
  }
}

export const salla = {
  get: <T>(path: string, params?: Record<string, unknown>) => request<T>("get", path, { params }),
  post: <T>(path: string, data?: unknown) => request<T>("post", path, { data }),
  put: <T>(path: string, data?: unknown) => request<T>("put", path, { data }),
  del: <T>(path: string) => request<T>("delete", path),
};
