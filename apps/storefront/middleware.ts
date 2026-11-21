import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Known vulnerability scanners and abusive bots signature
const SUSPICIOUS_BOT_REGEX =
  /(?:sqlmap|nikto|acunetix|masscan|nmap|wpscan|dirbuster|gobuster|fuzzdb|havij|zaproxy)/i;

interface RouteRateRule {
  pattern: RegExp;
  limit: number;
  windowMs: number;
  label: string;
}

const RATE_RULES: RouteRateRule[] = [
  {
    // Strict limit on Login and Registration to prevent brute force & credential stuffing
    pattern: /^\/api\/auth\/(login|register)/,
    limit: 5,
    windowMs: 60_000,
    label: "Authentication",
  },
  {
    // Protect Public Enquiries & BOQ Quote requests against spam flooding
    pattern: /^\/api\/(enquiries|cart\/quote)/,
    limit: 5,
    windowMs: 60_000,
    label: "Inquiry Submission",
  },
  {
    // Protect Order creation and Razorpay payment checkout
    pattern: /^\/api\/(orders|payments\/razorpay)/,
    limit: 10,
    windowMs: 60_000,
    label: "Order & Payment",
  },
  {
    // General API rate ceiling
    pattern: /^\/api\//,
    limit: 60,
    windowMs: 60_000,
    label: "General API",
  },
];

// Sliding-window memory store for Edge middleware
const ipRequestLogs = new Map<string, number[]>();
const CLEANUP_THRESHOLD_MS = 3 * 60 * 1000;
let lastPruned = Date.now();

function pruneOldRecords(windowMs: number) {
  const now = Date.now();
  if (now - lastPruned < CLEANUP_THRESHOLD_MS) return;
  lastPruned = now;

  for (const [key, timestamps] of ipRequestLogs.entries()) {
    const valid = timestamps.filter((t) => now - t < windowMs);
    if (valid.length === 0) {
      ipRequestLogs.delete(key);
    } else {
      ipRequestLogs.set(key, valid);
    }
  }
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first && first !== "unknown") {
      return first;
    }
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Bot Protection on all API routes
  if (pathname.startsWith("/api/")) {
    const userAgent = req.headers.get("user-agent") || "";

    if (!userAgent || SUSPICIOUS_BOT_REGEX.test(userAgent)) {
      return NextResponse.json(
        { error: "Access denied. Automated security scan detected." },
        { status: 403 }
      );
    }
  }

  // 2. Sliding Window Rate Limiting on API endpoints
  // Security Hardening: Never allow user-controlled headers (like arbitrary x-e2e-test) to bypass rate limiting.
  // In production, bypass is strictly impossible (hard disabled).
  // In dev/test environments, bypass is only permissible if the trusted test secret matches
  // or process.env.PLAYWRIGHT_TEST is active on the server.
  const isProduction = process.env.NODE_ENV === "production";
  const testSecret = process.env.PLAYWRIGHT_TEST_SECRET || "dev-playwright-e2e-internal-secret";
  const isAuthorizedTestBypass =
    !isProduction &&
    Boolean(
      process.env.PLAYWRIGHT_TEST === "true" ||
        req.headers.get("x-e2e-test-secret") === testSecret
    );

  if (!isAuthorizedTestBypass) {
    for (const rule of RATE_RULES) {
      if (rule.pattern.test(pathname)) {
        const clientIp = getClientIp(req);
        const now = Date.now();
        pruneOldRecords(rule.windowMs);

        const storeKey = `${clientIp}:${rule.label}`;
        let timestamps = ipRequestLogs.get(storeKey) || [];

        // Filter timestamps within sliding window
        timestamps = timestamps.filter((t) => now - t < rule.windowMs);

        if (timestamps.length >= rule.limit) {
          const oldest = timestamps[0];
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((oldest + rule.windowMs - now) / 1000)
          );

          return NextResponse.json(
            {
              error: `Too many ${rule.label.toLowerCase()} requests. Rate limit exceeded.`,
              retryAfterSeconds,
            },
            {
              status: 429,
              headers: {
                "Retry-After": String(retryAfterSeconds),
                "X-RateLimit-Limit": String(rule.limit),
                "X-RateLimit-Remaining": "0",
              },
            }
          );
        }

        timestamps.push(now);
        ipRequestLogs.set(storeKey, timestamps);

        const res = NextResponse.next();
        res.headers.set("X-RateLimit-Limit", String(rule.limit));
        res.headers.set(
          "X-RateLimit-Remaining",
          String(rule.limit - timestamps.length)
        );
        return res;
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
