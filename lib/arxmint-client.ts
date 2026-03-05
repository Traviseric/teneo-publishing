// ============================================================
// Teneo Publishing — ArxMint Payment Client
// Connects to ArxMint for L402/Cashu payment verification.
// Agents pay ArxMint, ArxMint verifies, we serve content.
// ============================================================

const ARXMINT_URL = process.env.ARXMINT_URL || "https://arxmint.com";
const ARXMINT_SERVICE_KEY = process.env.ARXMINT_SERVICE_KEY; // te_svc_teneo-publishing_xxx

export interface PaymentVerification {
  verified: boolean;
  method: "l402" | "cashu" | "service-key" | "none";
  amountSats?: number;
  error?: string;
}

/**
 * Verify an agent's payment through ArxMint.
 *
 * Two paths:
 * 1. Agent already paid ArxMint (L402/Cashu) — we verify the receipt
 * 2. TE ecosystem agent — uses x-service-key (internal, no payment needed)
 */
export async function verifyPayment(headers: Headers): Promise<PaymentVerification> {
  // Path 1: TE ecosystem service key — trusted internal agent
  const serviceKey = headers.get("x-service-key");
  if (serviceKey && process.env.TENEO_SERVICE_KEYS?.split(",").includes(serviceKey)) {
    return { verified: true, method: "service-key" };
  }

  // Path 2: Agent provides ArxMint payment proof
  const authHeader = headers.get("authorization") || headers.get("x-cashu");
  if (!authHeader) {
    // No payment header — check dev bypass
    if (process.env.SKIP_PAYMENT_VERIFY === "true" && process.env.NODE_ENV !== "production") {
      return { verified: true, method: "none" };
    }
    return { verified: false, method: "none" };
  }

  // Forward the payment proof to ArxMint for verification
  try {
    const res = await fetch(`${ARXMINT_URL}/api/agent?service=verify-payment`, {
      headers: {
        Authorization: authHeader,
        ...(ARXMINT_SERVICE_KEY ? { "x-service-key": ARXMINT_SERVICE_KEY } : {}),
      },
    });

    if (res.ok) {
      const data = await res.json();
      return {
        verified: true,
        method: authHeader.toLowerCase().startsWith("cashu") ? "cashu" : "l402",
        amountSats: data.amount_sats,
      };
    }

    if (res.status === 402) {
      const challenge = await res.json();
      return {
        verified: false,
        method: "none",
        error: `Payment required: ${challenge.price_sats} sats`,
        amountSats: challenge.price_sats,
      };
    }

    return { verified: false, method: "none", error: `ArxMint returned ${res.status}` };
  } catch (err) {
    // ArxMint unreachable — check if we have a local verification fallback
    if (process.env.SKIP_PAYMENT_VERIFY === "true" && process.env.NODE_ENV !== "production") {
      return { verified: true, method: "none" };
    }
    return {
      verified: false,
      method: "none",
      error: `ArxMint unreachable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Get the ArxMint payment challenge URL for agents to pay.
 * Returns the info agents need to acquire payment tokens.
 */
export function getPaymentInfo(priceSats: number) {
  return {
    paymentRequired: true,
    priceSats,
    arxmintUrl: ARXMINT_URL,
    methods: [
      {
        method: "cashu",
        instructions: [
          `1. Get a Cashu token worth ${priceSats}+ sats from any supported mint`,
          "2. Include in request: Authorization: Cashu <cashuB_token>",
        ],
      },
      {
        method: "l402",
        instructions: [
          `1. GET ${ARXMINT_URL}/api/l402 to receive a Lightning invoice`,
          "2. Pay the invoice, get the preimage",
          "3. Include in request: Authorization: L402 <macaroon>:<preimage>",
        ],
      },
      {
        method: "service-key",
        instructions: [
          "For TE ecosystem agents: include x-service-key header",
        ],
      },
    ],
  };
}
