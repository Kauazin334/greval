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

const STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/greval-files`;
const PUBLIC_STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/greval-files`;

async function getPlayerRow(id: string): Promise<any> {
  const res = await fetch(`${PLAYERS_URL}?id=eq.${encodeURIComponent(id)}&select=*`, { headers: headers() });
  if (!res.ok) return parseError(res);
  const rows = await res.json();
  if (!rows[0]) throw new ApiError(404, { message: "Jogador não encontrado." });
  return rows[0];
}

async function updatePlayerData(id: string, data: any) {
  const res = await fetch(`${PLAYERS_URL}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...headers(true), Prefer: "return=minimal" },
    body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) return parseError(res);
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const photoMatch = path.match(/^\/players\/([^/]+)\/photo$/);
  const documentMatch = path.match(/^\/players\/([^/]+)\/documents$/);
  const playerId = photoMatch?.[1] ?? documentMatch?.[1];
  const file = formData.get("file");

  if (!playerId || !(file instanceof File)) {
    throw new ApiError(400, { message: "Arquivo inválido." });
  }

  const isPhoto = Boolean(photoMatch);
  const documentType = String(formData.get("document_type") ?? "");
  const extension = file.name.split(".").pop()?.toLowerCase() || (isPhoto ? "jpg" : "pdf");
  const objectPath = isPhoto
    ? `players/${playerId}/photo.${extension}`
    : `players/${playerId}/documents/${documentType}.${extension}`;

  const upload = await fetch(`${STORAGE_URL}/${objectPath}`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
    body: file,
  });
  if (!upload.ok) return parseError(upload);

  const publicUrl = `${PUBLIC_STORAGE_URL}/${objectPath}`;
  const row = await getPlayerRow(playerId);
  const data = { ...(row.data ?? {}) };

  if (isPhoto) {
    data.photo_url = publicUrl;
    await updatePlayerData(playerId, data);
    return { photo_url: publicUrl, filename: file.name, size_bytes: file.size } as T;
  }

  const labels: Record<string, string> = { rg: "RG", cpf: "CPF", birth_certificate: "Certidão de nascimento" };
  const document = {
    document_type: documentType,
    label: labels[documentType] ?? documentType,
    filename: file.name,
    size_bytes: file.size,
    uploaded_at: new Date().toISOString(),
    url: publicUrl,
  };
  const existing = Array.isArray(data.documents) ? data.documents : [];
  data.documents = [...existing.filter((item: any) => item.document_type !== documentType), document];
  await updatePlayerData(playerId, data);
  return document as T;
}
