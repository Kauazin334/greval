const SUPABASE_URL = "https://sztypqtjiuilfhhkbqvx.supabase.co";
const SUPABASE_KEY = "sb_publishable_Nv4W9ccieilfkot26A5jMg_Q9KashmQ";
const PLAYERS_URL = `${SUPABASE_URL}/rest/v1/players`;

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

const headers = (json = false): HeadersInit => ({
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  ...(json ? { "Content-Type": "application/json" } : {}),
});

async function parseError(res: Response): Promise<never> {
  const body = await res.json().catch(() => null);
  throw new ApiError(res.status, body);
}

function normalize(row: any) {
  return { ...(row.data ?? {}), id: row.id, created_at: row.created_at, updated_at: row.updated_at };
}

export function friendlyApiError(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as any;
    return body?.message || body?.details || `Erro ao salvar (HTTP ${error.status}).`;
  }
  return "Não foi possível comunicar com o banco. Verifique sua internet e tente novamente.";
}

export async function apiGet<T>(path: string): Promise<T> {
  if (path.startsWith("/players")) {
    const res = await fetch(`${PLAYERS_URL}?select=*&order=full_name.asc`, { headers: headers() });
    if (!res.ok) return parseError(res);
    const rows = await res.json();
    return { items: rows.map(normalize), total: rows.length, limit: 100, offset: 0 } as T;
  }
  throw new ApiError(404, { message: "Rota não suportada" });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  if (path === "/players") {
    const res = await fetch(PLAYERS_URL, {
      method: "POST",
      headers: { ...headers(true), Prefer: "return=representation" },
      body: JSON.stringify({ data: body ?? {} }),
    });
    if (!res.ok) return parseError(res);
    return normalize((await res.json())[0]) as T;
  }
  throw new ApiError(404, { message: "Rota não suportada" });
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const match = path.match(/^\/players\/([^/]+)$/);
  if (match) {
    const res = await fetch(`${PLAYERS_URL}?id=eq.${encodeURIComponent(match[1])}`, {
      method: "PATCH",
      headers: { ...headers(true), Prefer: "return=representation" },
      body: JSON.stringify({ data: body ?? {}, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) return parseError(res);
    return normalize((await res.json())[0]) as T;
  }
  throw new ApiError(404, { message: "Rota não suportada" });
}

export async function apiDelete<T>(path: string): Promise<T> {
  const match = path.match(/^\/players\/([^/]+)$/);
  if (match) {
    const res = await fetch(`${PLAYERS_URL}?id=eq.${encodeURIComponent(match[1])}`, { method: "DELETE", headers: headers() });
    if (!res.ok) return parseError(res);
    return undefined as T;
  }
  throw new ApiError(404, { message: "Rota não suportada" });
}

export const apiPatch = apiPut;

// Arquivos serão migrados para Supabase Storage numa etapa separada.
// O cadastro principal nunca deve falhar por causa de um anexo.
export async function apiUpload<T>(_path: string, _formData: FormData): Promise<T> {
  throw new ApiError(501, { message: "Upload temporariamente indisponível durante a migração." });
}
