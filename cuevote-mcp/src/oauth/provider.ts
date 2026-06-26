// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Julian Zienert
//
// OAuth 2.1 Authorization Server for the remote DJ MCP. CueVote is the AS;
// identity comes from the web consent page (Google login) in prod, or from a
// configured dev user when testing. PKCE is validated by the SDK token handler
// via challengeForAuthorizationCode. Tokens are opaque + revocable.
//
// NOTE: stores are in-memory — a restart invalidates tokens/clients (users
// re-authorize). Phase 3 hardening: move to SQLite.
import { randomUUID, randomBytes } from "node:crypto";
import type { Response } from "express";
import type { OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type {
  OAuthClientInformationFull,
  OAuthTokens,
  OAuthTokenRevocationRequest,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { InvalidGrantError, InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { config } from "../config.js";

const ACCESS_TTL = 3600; // 1h
const REFRESH_TTL = 30 * 86400; // 30d
const CODE_TTL = 300; // 5m
const PENDING_TTL = 600; // 10m
const now = (): number => Math.floor(Date.now() / 1000);
const newToken = (): string => randomBytes(32).toString("hex");

interface AuthCode {
  clientId: string;
  userId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  expiresAt: number;
}
interface TokenRec {
  clientId: string;
  userId: string;
  scopes: string[];
  expiresAt: number;
}
interface Pending {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  scopes: string[];
  expiresAt: number;
}

const clients = new Map<string, OAuthClientInformationFull>();
const codes = new Map<string, AuthCode>();
const accessTokens = new Map<string, TokenRec>();
const refreshTokens = new Map<string, TokenRec>();
const pending = new Map<string, Pending>();

function sweep(): void {
  const t = now();
  for (const [k, v] of codes) if (v.expiresAt < t) codes.delete(k);
  for (const [k, v] of accessTokens) if (v.expiresAt < t) accessTokens.delete(k);
  for (const [k, v] of refreshTokens) if (v.expiresAt < t) refreshTokens.delete(k);
  for (const [k, v] of pending) if (v.expiresAt < t) pending.delete(k);
}

// Reclaim expired entries even with no authorize/finalize traffic (the on-demand
// sweep calls above only fire during those flows).
const _sweepTimer = setInterval(() => sweep(), 5 * 60_000);
_sweepTimer.unref();

const clientsStore: OAuthRegisteredClientsStore = {
  getClient(clientId) {
    return clients.get(clientId);
  },
  registerClient(client) {
    const full = {
      ...client,
      client_id: randomUUID(),
      client_id_issued_at: now(),
    } as OAuthClientInformationFull;
    clients.set(full.client_id, full);
    return full;
  },
};

function issueTokens(clientId: string, userId: string, scopes: string[]): OAuthTokens {
  const access = newToken();
  const refresh = newToken();
  accessTokens.set(access, { clientId, userId, scopes, expiresAt: now() + ACCESS_TTL });
  refreshTokens.set(refresh, { clientId, userId, scopes, expiresAt: now() + REFRESH_TTL });
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TTL,
    refresh_token: refresh,
    scope: scopes.join(" "),
  };
}

function createCode(p: Omit<AuthCode, "expiresAt">): string {
  const code = newToken();
  codes.set(code, { ...p, expiresAt: now() + CODE_TTL });
  return code;
}

export const provider: OAuthServerProvider = {
  get clientsStore() {
    return clientsStore;
  },

  async authorize(client, params, res: Response) {
    sweep();
    const scopes = params.scopes ?? [];

    // DEV ONLY: auto-approve a configured user, no Google. For testing.
    // Hard-disabled under NODE_ENV=production so a misconfigured env var can
    // never become a login bypass on the live service.
    const devUser =
      config.oauth.devUser && process.env.NODE_ENV !== "production" ? config.oauth.devUser : "";
    if (devUser) {
      const code = createCode({
        clientId: client.client_id,
        userId: devUser,
        codeChallenge: params.codeChallenge,
        redirectUri: params.redirectUri,
        scopes,
      });
      const u = new URL(params.redirectUri);
      u.searchParams.set("code", code);
      if (params.state) u.searchParams.set("state", params.state);
      res.redirect(u.toString());
      return;
    }

    // PROD: stash the request and send the user to the web consent page, which
    // logs them in via Google and calls finalizeAuthorization().
    if (!config.oauth.consentUrl) {
      res.status(500).end("OAuth not configured (set CUEVOTE_OAUTH_CONSENT_URL or CUEVOTE_OAUTH_DEV_USER).");
      return;
    }
    const handle = newToken();
    pending.set(handle, {
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      state: params.state,
      scopes,
      expiresAt: now() + PENDING_TTL,
    });
    const c = new URL(config.oauth.consentUrl);
    c.searchParams.set("auth", handle);
    // Display hints so the consent screen can name what is being authorized
    // (defends against consent phishing / confused-deputy). The redirect host is
    // the meaningful trust signal — the user should refuse an unfamiliar host.
    if (client.client_name) c.searchParams.set("client", client.client_name);
    try {
      c.searchParams.set("redirect", new URL(params.redirectUri).host);
    } catch {
      /* non-URL redirect (e.g. custom scheme) — omit host hint */
    }
    res.redirect(c.toString());
  },

  async challengeForAuthorizationCode(client, authorizationCode) {
    const rec = codes.get(authorizationCode);
    if (!rec || rec.clientId !== client.client_id || rec.expiresAt < now()) {
      throw new InvalidGrantError("Invalid or expired authorization grant.");
    }
    return rec.codeChallenge;
  },

  async exchangeAuthorizationCode(client, authorizationCode, _codeVerifier, redirectUri) {
    const rec = codes.get(authorizationCode);
    if (!rec || rec.clientId !== client.client_id || rec.expiresAt < now()) throw new InvalidGrantError("Invalid or expired authorization grant.");
    if (redirectUri && redirectUri !== rec.redirectUri) throw new InvalidGrantError("Invalid or expired authorization grant.");
    codes.delete(authorizationCode); // single use
    return issueTokens(client.client_id, rec.userId, rec.scopes);
  },

  async exchangeRefreshToken(client, refreshToken, scopes) {
    const rec = refreshTokens.get(refreshToken);
    if (!rec || rec.clientId !== client.client_id || rec.expiresAt < now()) throw new InvalidGrantError("Invalid or expired authorization grant.");
    refreshTokens.delete(refreshToken); // rotate: the old refresh token is single-use
    const grantScopes = scopes && scopes.length ? scopes.filter((s) => rec.scopes.includes(s)) : rec.scopes;
    return issueTokens(client.client_id, rec.userId, grantScopes);
  },

  async verifyAccessToken(token): Promise<AuthInfo> {
    const rec = accessTokens.get(token);
    if (!rec || rec.expiresAt < now()) throw new InvalidTokenError("Invalid or expired access token.");
    return {
      token,
      clientId: rec.clientId,
      scopes: rec.scopes,
      expiresAt: rec.expiresAt,
      extra: { userId: rec.userId },
    };
  },

  async revokeToken(_client, request: OAuthTokenRevocationRequest) {
    accessTokens.delete(request.token);
    refreshTokens.delete(request.token);
  },
};

/**
 * Finalize a pending authorization after the web app has logged the user in
 * with Google. Returns the redirect URL (with code + state) for the browser.
 */
export function finalizeAuthorization(handle: string, userId: string): string {
  sweep();
  const p = pending.get(handle);
  if (!p) throw new Error("invalid_or_expired_handle");
  pending.delete(handle);
  const code = createCode({
    clientId: p.clientId,
    userId,
    codeChallenge: p.codeChallenge,
    redirectUri: p.redirectUri,
    scopes: p.scopes,
  });
  const u = new URL(p.redirectUri);
  u.searchParams.set("code", code);
  if (p.state) u.searchParams.set("state", p.state);
  return u.toString();
}
