import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { router } from "expo-router";
import { authedFetch, setSessionExpiredHandler } from "./authedFetch";

WebBrowser.maybeCompleteAuthSession();

const AUTH_TOKEN_KEY = "auth_session_token";
const ISSUER_URL = process.env.EXPO_PUBLIC_ISSUER_URL ?? "https://replit.com/oidc";
const MOBILE_RETURN_SCHEME = "pawplay://auth-callback";

// Use the new server-bridged flow only in standalone native builds
// (TestFlight / App Store / Google Play). In Expo Go and web preview, fall
// back to the original on-device PKCE flow that works in those environments.
function shouldUseServerBridgedFlow(): boolean {
  if (Platform.OS === "web") return false;
  const env = Constants.executionEnvironment;
  return env === "standalone" || env === "bare";
}

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginError: string | null;
  clearLoginError: () => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  handleSessionExpired: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  loginError: null,
  clearLoginError: () => {},
  login: async () => {},
  logout: async () => {},
  handleSessionExpired: async () => {},
});

const SIGN_IN_CANCELLED = "Sign-in cancelled";
const SIGN_IN_FAILED = "Sign-in failed. Please try again.";
const SESSION_EXPIRED = "Your session expired — please sign in again.";

function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return "";
}

function getClientId(): string {
  return process.env.EXPO_PUBLIC_REPL_ID || "";
}

function parseTokenFromReturnUrl(url: string): string | null {
  try {
    const queryIndex = url.indexOf("?");
    if (queryIndex === -1) return null;
    const params = new URLSearchParams(url.slice(queryIndex + 1));
    return params.get("token");
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  const clearLoginError = useCallback(() => setLoginError(null), []);

  const useServerBridge = shouldUseServerBridgedFlow();

  // Legacy on-device PKCE flow (used in web/Expo Go for backwards compatibility)
  const discovery = AuthSession.useAutoDiscovery(ISSUER_URL);
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "pawplay",
    path: "auth",
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: getClientId(),
      scopes: ["openid", "email", "profile", "offline_access"],
      redirectUri,
      prompt: AuthSession.Prompt.Login,
    },
    discovery,
  );

  const handleSessionExpired = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    } catch {
    }
    setUser(null);
    setLoginError(SESSION_EXPIRED);
    try {
      router.replace("/home");
    } catch {
    }
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const res = await authedFetch(`/api/auth/user`);

      if (res.status === 401) {
        // authedFetch already invoked the session-expired handler.
        return;
      }

      const data = await res.json();

      if (data.user) {
        setUser(data.user);
      } else {
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(handleSessionExpired);
    return () => setSessionExpiredHandler(null);
  }, [handleSessionExpired]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Legacy flow: handle the OIDC response from expo-auth-session and
  // exchange the authorization code via the server.
  useEffect(() => {
    if (useServerBridge) return;
    if (!response) return;

    if (response.type !== "success") {
      if (response.type === "cancel" || response.type === "dismiss") {
        setLoginError(SIGN_IN_CANCELLED);
      } else if (response.type === "error") {
        console.error("Auth response error:", response.error);
        setLoginError(SIGN_IN_FAILED);
      }
      return;
    }
    if (!request?.codeVerifier) return;

    const { code, state } = response.params;

    (async () => {
      try {
        const apiBase = getApiBaseUrl();
        if (!apiBase) {
          console.error("API base URL is not configured.");
          setLoginError(SIGN_IN_FAILED);
          return;
        }

        const exchangeRes = await fetch(`${apiBase}/api/mobile-auth/token-exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            code_verifier: request.codeVerifier,
            redirect_uri: redirectUri,
            state,
            nonce: request.nonce,
          }),
        });

        if (!exchangeRes.ok) {
          console.error("Token exchange failed:", exchangeRes.status);
          setLoginError(SIGN_IN_FAILED);
          setIsLoading(false);
          return;
        }

        const data = await exchangeRes.json();
        if (data.token) {
          await SecureStore.setItemAsync(AUTH_TOKEN_KEY, data.token);
          setIsLoading(true);
          await fetchUser();
        } else {
          console.error("Token exchange returned no token");
          setLoginError(SIGN_IN_FAILED);
        }
      } catch (err) {
        console.error("Token exchange error:", err);
        setLoginError(SIGN_IN_FAILED);
        setIsLoading(false);
      }
    })();
  }, [useServerBridge, response, request, redirectUri, fetchUser]);

  const login = useCallback(async () => {
    setLoginError(null);

    if (!useServerBridge) {
      // Legacy flow for web / Expo Go. The actual cancel/error handling
      // happens in the response useEffect above.
      try {
        await promptAsync();
      } catch (err) {
        console.error("Login error:", err);
        setLoginError(SIGN_IN_FAILED);
      }
      return;
    }

    // Server-bridged flow for standalone native builds (TestFlight, App Store,
    // Google Play). Avoids sending custom-scheme redirect_uri to Replit OIDC,
    // which only allowlists HTTPS URIs tied to the repl's domains.
    try {
      const apiBase = getApiBaseUrl();
      if (!apiBase) {
        console.error("API base URL is not configured.");
        setLoginError(SIGN_IN_FAILED);
        return;
      }

      const startUrl = `${apiBase}/api/mobile-auth/start?return_scheme=${encodeURIComponent(MOBILE_RETURN_SCHEME)}`;

      const result = await WebBrowser.openAuthSessionAsync(
        startUrl,
        MOBILE_RETURN_SCHEME,
      );

      if (result.type !== "success" || !result.url) {
        setLoginError(SIGN_IN_CANCELLED);
        return;
      }

      const token = parseTokenFromReturnUrl(result.url);
      if (!token) {
        console.error("No token in auth callback URL");
        setLoginError(SIGN_IN_FAILED);
        return;
      }

      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
      setIsLoading(true);
      await fetchUser();
    } catch (err) {
      console.error("Login error:", err);
      setLoginError(SIGN_IN_FAILED);
    }
  }, [useServerBridge, promptAsync, fetchUser]);

  const logout = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      if (token) {
        const apiBase = getApiBaseUrl();
        await fetch(`${apiBase}/api/mobile-auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
    } finally {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        loginError,
        clearLoginError,
        login,
        logout,
        handleSessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
