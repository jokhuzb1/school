import api from "./client";

type CachedToken = {
  token: string;
  expiresAt: number;
};

let cache: CachedToken | null = null;

export async function getSseToken(): Promise<string> {
  const now = Date.now();
  if (cache && cache.expiresAt > now + 10_000) {
    return cache.token;
  }

  const response = await api.get<{ token: string; expiresIn: number }>("/auth/sse-token");
  const { token, expiresIn } = response.data;
  cache = {
    token,
    expiresAt: now + expiresIn * 1000,
  };
  return token;
}
