const API = import.meta.env.VITE_API_URL as string;

export class UnauthorizedError extends Error {}

export interface DocSummary {
  overview?: string;
  keyDates?: { date: string; label: string }[];
  obligations?: string[];
  costs?: { label: string; amount: string }[];
}

export interface DocItem {
  docId: string;
  filename: string;
  status: string;
  createdAt: number;
  summary?: DocSummary;
  error?: string;
}

export interface Source {
  docId: string;
  filename: string;
  chunkIndex?: number;
  text: string;
  score: number;
}

export interface AskResult {
  answer: string;
  sources: Source[];
}

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401) throw new UnauthorizedError("Session expired");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.message || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function getDocuments(token: string): Promise<DocItem[]> {
  const data = await call<{ documents: DocItem[] }>(token, "/documents");
  return data.documents;
}

const ALLOWED = ["image/png", "image/jpeg", "application/pdf"];

export async function uploadDocument(token: string, file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error("Only PNG, JPEG, or single-page PDF files are supported.");
  }
  const { docId, uploadUrl } = await call<{ docId: string; uploadUrl: string }>(
    token,
    "/upload-url",
    {
      method: "POST",
      body: JSON.stringify({ filename: file.name, contentType: file.type }),
    },
  );
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return docId;
}

export async function askQuestion(token: string, question: string): Promise<AskResult> {
  return call<AskResult>(token, "/ask", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}