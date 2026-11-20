import crypto from 'crypto';
import type express from 'express';
import type { AdminSessionInfo } from '../src/types';

export const ADMIN_COOKIE_NAME = 'sathi_admin_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Ephemeral fallback CSPRNG secret if ADMIN_SESSION_SECRET is not set in env.
// Never uses a static hardcoded string.
const EPHEMERAL_SESSION_SECRET = crypto.randomBytes(32).toString('hex');

const revokedTokenIds = new Set<string>();
const failedLoginBuckets = new Map<string, { count: number; resetAt: number }>();

export interface AuthenticatedAdminRequest extends express.Request {
  adminUser?: {
    email: string;
    role: 'admin';
    jti: string;
  };
}

interface AdminSessionPayload {
  sub: string;
  role: 'admin';
  iat: number;
  exp: number;
  jti: string;
}

const DEFAULT_ADMIN_EMAIL = 'azizul764244@gmail.com';
const DEFAULT_ADMIN_PASSWORD_HASH =
  'scrypt:cca9ab64131cd0257dcf0a5f618073c8:893a66945d173f66c4f84a3e66fe6222759704ed8b010153de32d400b3f1877a0e6bc055dd55a04a4a64586be1c9aa50fdc91f257968f4e8787646f5d33773c2';

function getSessionSecret(): string {
  const configured = process.env.ADMIN_SESSION_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : EPHEMERAL_SESSION_SECRET;
}

export function getConfiguredAdminEmail(): string {
  const email = process.env.ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL;
  return email.toLowerCase();
}

export function getAdminConfigStatus(): {
  configured: boolean;
  missingVars: string[];
  adminEmail: string;
} {
  return {
    configured: true,
    missingVars: [],
    adminEmail: getConfiguredAdminEmail(),
  };
}

function constantTimeCompareStrings(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    // Compare against dummy buffer to prevent length timing leak
    crypto.timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyPasswordAgainstEnv(plainPassword: string): boolean {
  const envPlain = process.env.ADMIN_PASSWORD?.trim();
  const configuredHash =
    process.env.ADMIN_PASSWORD_HASH?.trim() || (!envPlain ? DEFAULT_ADMIN_PASSWORD_HASH : '');

  if (configuredHash) {
    // Supported format: scrypt:<saltHex>:<hashHex>
    const parts = configuredHash.split(':');
    if (parts.length === 3 && parts[0] === 'scrypt') {
      const salt = Buffer.from(parts[1], 'hex');
      const expected = Buffer.from(parts[2], 'hex');
      const derived = crypto.scryptSync(plainPassword, salt, expected.length);
      return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
    }
    return false;
  }

  if (!envPlain) {
    return false;
  }

  // Derive scrypt digests with a fixed runtime salt so comparison is constant-time
  const runtimeSalt = crypto.createHash('sha256').update(getSessionSecret()).digest();
  const actualDigest = crypto.scryptSync(plainPassword, runtimeSalt, 32);
  const expectedDigest = crypto.scryptSync(envPlain, runtimeSalt, 32);
  return crypto.timingSafeEqual(actualDigest, expectedDigest);
}

export function verifyAdminCredentials(
  emailInput: string,
  passwordInput: string
): { ok: boolean; reason?: string; email?: string } {
  const config = getAdminConfigStatus();
  const normalizedInputEmail = emailInput.trim().toLowerCase();
  if (!normalizedInputEmail || !passwordInput) {
    return { ok: false, reason: 'ভুল ইমেইল / পাসওয়ার্ড' };
  }

  const emailMatches = constantTimeCompareStrings(normalizedInputEmail, config.adminEmail);
  const passwordMatches = verifyPasswordAgainstEnv(passwordInput);

  if (!emailMatches || !passwordMatches) {
    return { ok: false, reason: 'ভুল ইমেইল / পাসওয়ার্ড' };
  }

  return { ok: true, email: config.adminEmail };
}

function signPayload(payload: AdminSessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token: string): AdminSessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(data)
    .digest('base64url');

  if (!constantTimeCompareStrings(sig, expectedSig)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(data, 'base64url').toString('utf8')
    ) as AdminSessionPayload;

    if (
      payload.role !== 'admin' ||
      typeof payload.sub !== 'string' ||
      typeof payload.exp !== 'number' ||
      typeof payload.jti !== 'string'
    ) {
      return null;
    }

    if (Date.now() > payload.exp) {
      return null;
    }

    if (revokedTokenIds.has(payload.jti)) {
      return null;
    }

    const configuredEmail = getConfiguredAdminEmail();
    if (!configuredEmail || !constantTimeCompareStrings(payload.sub.toLowerCase(), configuredEmail)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

export function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const bucket = failedLoginBuckets.get(ip);
  if (!bucket) return { allowed: true };
  if (now > bucket.resetAt) {
    failedLoginBuckets.delete(ip);
    return { allowed: true };
  }
  if (bucket.count >= MAX_LOGIN_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { allowed: true };
}

export function recordFailedLoginAttempt(ip: string): void {
  const now = Date.now();
  const bucket = failedLoginBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    failedLoginBuckets.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    bucket.count += 1;
  }
}

export function resetLoginRateLimit(ip: string): void {
  failedLoginBuckets.delete(ip);
}

function isHttpsRequest(req: express.Request): boolean {
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  return typeof proto === 'string' && proto.toLowerCase().includes('https');
}

function extractAdminToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[ADMIN_COOKIE_NAME] || null;
}

export function issueAdminSessionCookie(
  req: express.Request,
  res: express.Response,
  email: string
): string {
  const now = Date.now();
  const payload: AdminSessionPayload = {
    sub: email.toLowerCase(),
    role: 'admin',
    iat: now,
    exp: now + SESSION_TTL_MS,
    jti: crypto.randomBytes(16).toString('hex'),
  };
  const token = signPayload(payload);
  const https = isHttpsRequest(req);
  const cookieAttrs = https
    ? 'HttpOnly; SameSite=None; Secure; Partitioned'
    : 'HttpOnly; SameSite=Lax';
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; ${cookieAttrs}; Max-Age=${maxAgeSec}`
  );
  return token;
}

export function clearAdminSessionCookie(req: express.Request, res: express.Response): void {
  const token = extractAdminToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload?.jti) {
      revokedTokenIds.add(payload.jti);
    }
  }
  const https = isHttpsRequest(req);
  const cookieAttrs = https
    ? 'HttpOnly; SameSite=None; Secure; Partitioned'
    : 'HttpOnly; SameSite=Lax';
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_COOKIE_NAME}=; Path=/; ${cookieAttrs}; Max-Age=0`
  );
}

export function getAdminSessionFromRequest(req: express.Request): AdminSessionInfo {
  const config = getAdminConfigStatus();
  const token = extractAdminToken(req);
  if (!token) {
    return {
      authenticated: false,
      role: 'user',
      email: null,
      configured: config.configured,
      missingVars: config.missingVars,
    };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return {
      authenticated: false,
      role: 'user',
      email: null,
      configured: config.configured,
      missingVars: config.missingVars,
    };
  }

  return {
    authenticated: true,
    role: 'admin',
    email: payload.sub,
    configured: config.configured,
    missingVars: config.missingVars,
  };
}

export function requireAdmin(
  req: AuthenticatedAdminRequest,
  res: express.Response,
  next: express.NextFunction
): void {
  const token = extractAdminToken(req);
  if (!token) {
    res.status(401).json({
      error: 'অ্যাডমিন অনুমোদন প্রয়োজন। সাধারণ ব্যবহারকারী এই তথ্য দেখতে পারবেন না।',
      code: 'ADMIN_AUTH_REQUIRED',
    });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({
      error: 'অ্যাডমিন সেশন মেয়াদোত্তীর্ণ বা অবৈধ। অনুগ্রহ করে পুনরায় লগইন করুন।',
      code: 'ADMIN_SESSION_INVALID',
    });
    return;
  }

  if (payload.role !== 'admin') {
    res.status(403).json({
      error: 'প্রবেশাধিকার নিষিদ্ধ (৪০৩)। শুধুমাত্র অনুমোদিত অ্যাডমিন অ্যাকাউন্ট অনুমোদিত।',
      code: 'ADMIN_ROLE_REQUIRED',
    });
    return;
  }

  req.adminUser = {
    email: payload.sub,
    role: 'admin',
    jti: payload.jti,
  };
  next();
}
