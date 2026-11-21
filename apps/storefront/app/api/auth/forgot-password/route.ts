import { NextResponse } from "next/server";
import { requestPasswordResetInMedusaStrict } from "@/lib/server/medusa";

const GENERIC_SUCCESS_MESSAGE =
  "If an account exists with this email address, password reset instructions have been generated.";

// In-memory sliding window rate-limiter for single-node instances.
// Note: Distributed rate limiting across multi-container deployments is tracked under SF-11 (Redis rate limiter).
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const ipRateLimits = new Map<string, RateLimitEntry>();
const MAX_REQUESTS_PER_WINDOW = 5;
const WINDOW_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = ipRateLimits.get(key);

  if (!entry || now > entry.resetAt) {
    ipRateLimits.set(key, { count: 1, resetAt: now + WINDOW_DURATION_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfter) };
  }

  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`pwd_reset_ip:${clientIp}`);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many password reset requests from this address. Please wait before trying again.",
          retryAfter: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const body = (await request.json()) as {
      email?: string;
      website_hp?: string;
    };

    // Bot trap: reject automated submission bots that fill hidden honeypot fields
    if (body.website_hp) {
      return NextResponse.json({ ok: true, message: GENERIC_SUCCESS_MESSAGE });
    }

    const email = (body.email || "").trim().toLowerCase();

    // Basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    // Specific rate limit per target email as well
    const emailRateLimit = checkRateLimit(`pwd_reset_email:${email}`);
    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many requests for this account. Please wait before attempting another reset.",
          retryAfter: emailRateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(emailRateLimit.retryAfterSeconds),
          },
        }
      );
    }

    // Server-authoritative password reset trigger via Medusa auth
    const medusaRes = await requestPasswordResetInMedusaStrict(email);

    if (!medusaRes.ok) {
      if (medusaRes.status >= 500) {
        return NextResponse.json(
          { error: "Service temporarily unavailable. Please try again later." },
          { status: 503 }
        );
      }
    }

    // Always return generic non-enumerating message regardless of identity existence
    return NextResponse.json({
      ok: true,
      message: GENERIC_SUCCESS_MESSAGE,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to process password reset request.",
      },
      { status: 500 }
    );
  }
}
