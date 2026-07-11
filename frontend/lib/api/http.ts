const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(`Network error reaching ${path}`, null);
  }

  if (!response.ok) {
    throw new ApiError(`${options.method ?? "GET"} ${path} failed with ${response.status}`, response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(`${path} returned an unexpected (non-JSON) response`, response.status);
  }
}
