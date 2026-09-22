// Typed fetch layer over the FastAPI backend. Base is the relative "/api" prefix so the
// same code works in dev (Vite proxies /api → :8001) and behind a single origin in prod.
const BASE = "/api";

// Fields are declared, not constructor parameter properties: tsconfig sets
// erasableSyntaxOnly, which rejects `constructor(readonly status: number)`.
export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`request failed with ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function fieldName(location: unknown): string {
  if (!Array.isArray(location)) return 'Campo';
  const field = location.at(-1);
  const labels: Record<string, string> = {
    cpf: 'CPF do atleta', father_cpf: 'CPF do pai', mother_cpf: 'CPF da mãe', guardian_cpf: 'CPF do responsável',
    father_phone: 'Telefone do pai', mother_phone: 'Telefone da mãe', guardian_phone: 'Telefone do responsável',
  };
  return typeof field === 'string' ? labels[field] ?? field.replaceAll('_', ' ') : 'Campo';
}

export function friendlyApiError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Não foi possível comunicar com o servidor. Seus dados continuam no formulário; tente novamente.';
  if (error.status === 401) return 'Sua sessão expirou. Entre novamente antes de salvar.';
  if (error.status === 403) return 'A sessão de segurança expirou. Atualize a página e entre novamente.';
  if (error.status === 413) return 'O arquivo selecionado ultrapassa o tamanho permitido.';
  if (error.status === 422 && typeof error.body === 'object' && error.body !== null) {
    const detail = (error.body as { detail?: unknown }).detail;
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === 'object') {
      const item = detail[0] as { loc?: unknown; msg?: unknown };
      return `${fieldName(item.loc)}: ${typeof item.msg === 'string' ? item.msg : 'valor inválido'}.`;
    }
    if (typeof detail === 'string') return detail;
  }
  if (error.status >= 500) return 'O servidor não concluiu o salvamento. Aguarde alguns segundos e tente novamente.';
  return 'Não foi possível salvar. Revise os dados e tente novamente.';
}

type JsonBody = unknown;

function csrfToken(): string | undefined {
  return document.cookie.split('; ').find((entry) => entry.startsWith('greval_csrf='))?.split('=')[1];
}

function requestHeaders(body: JsonBody | undefined): HeadersInit | undefined {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const csrf = csrfToken();
  if (csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf);
  return Object.keys(headers).length ? headers : undefined;
}

async function request<T>(method: string, path: string, body?: JsonBody): Promise<T> {
  // Auth rides the httpOnly session cookie automatically — never add auth headers here.
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: requestHeaders(body),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // FastAPI reports request-validation failures as 422 with a {detail: [...]} body.
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new ApiError(res.status, errBody);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// The response type is yours to declare: nothing infers across the Python boundary, so a
// TS interface here mirrors the endpoint's Pydantic model by hand — keep the two in sync.
export const apiGet = <T>(path: string) => request<T>("GET", path);
export const apiPost = <T>(path: string, body?: JsonBody) => request<T>("POST", path, body ?? null);
export const apiPut = <T>(path: string, body?: JsonBody) => request<T>("PUT", path, body ?? null);
export const apiPatch = <T>(path: string, body?: JsonBody) =>
  request<T>("PATCH", path, body ?? null);
export const apiDelete = <T>(path: string) => request<T>("DELETE", path);

export const apiUpload = async <T>(path: string, formData: FormData): Promise<T> => {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: requestHeaders(undefined), body: formData });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new ApiError(res.status, errBody);
  }
  return (await res.json()) as T;
};
