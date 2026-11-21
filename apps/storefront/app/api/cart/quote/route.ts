import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import {
  MedusaUnavailableError,
  computeAuthoritativeOrderQuote,
  type CartQuoteRequestItem,
} from "@/lib/server/pricing";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const body = (await request.json()) as {
      items?: CartQuoteRequestItem[];
    };

    const quote = await computeAuthoritativeOrderQuote(body.items || [], user, {
      validateStock: false,
    });

    return NextResponse.json(quote);
  } catch (err) {
    const status = err instanceof MedusaUnavailableError ? err.status : 400;
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to compute cart quote.",
      },
      { status }
    );
  }
}

