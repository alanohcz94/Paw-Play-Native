import * as SecureStore from "expo-secure-store";

const AUTH_TOKEN_KEY = "auth_session_token";

let sessionExpiredHandler: (() => void | Promise<void>) | null = null;
let sessionExpiredInFlight: Promise<void> | null = null;

export function setSessionExpiredHandler(
  fn: (() => void | Promise<void>) | null,
) {
  sessionExpiredHandler = fn;
  sessionExpiredInFlight = null;
}

export function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return "";
}

export async function authedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  const apiBase = getApiBaseUrl();
  const url = /^https?:\/\//i.test(path) ? path : `${apiBase}${path}`;

  const headers = new Headers(init.headers as HeadersInit | undefined);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...init, headers });

  if (res.status === 401 && sessionExpiredHandler) {
    if (!sessionExpiredInFlight) {
      const handler = sessionExpiredHandler;
      sessionExpiredInFlight = (async () => {
        try {
          await handler();
        } catch {
        }
      })().finally(() => {
        sessionExpiredInFlight = null;
      });
    }
    try {
      await sessionExpiredInFlight;
    } catch {
    }
  }

  return res;
}
