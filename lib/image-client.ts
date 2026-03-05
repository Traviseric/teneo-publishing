// ============================================================
// Teneo Publishing — Image Engine Client
// Calls TE ecosystem image-engine for image generation.
// Uses standard x-service-key AI-to-AI protocol.
// ============================================================

const IMAGE_ENGINE_URL = process.env.IMAGE_ENGINE_URL || "https://image-engine.vercel.app";
const SERVICE_KEY = process.env.IMAGE_ENGINE_SERVICE_KEY;

export interface ImageResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  costUsd: number;
  provider: string;
}

/** Generate an image via image-engine */
export async function generateImage(params: {
  prompt: string;
  dimensions?: string;
  style?: string;
  provider?: string;
}): Promise<ImageResult> {
  if (!SERVICE_KEY) {
    return {
      success: false,
      error: "IMAGE_ENGINE_SERVICE_KEY not configured",
      costUsd: 0,
      provider: "none",
    };
  }

  try {
    const res = await fetch(`${IMAGE_ENGINE_URL}/api/ai-invoke/generate-campaign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-key": SERVICE_KEY,
      },
      body: JSON.stringify({
        brief: params.prompt,
        assets: [{
          type: "social_post",
          platform: "website",
          aspectRatio: params.dimensions || "1:1",
          headline: params.prompt.slice(0, 100),
        }],
        style: params.style || "professional",
        provider: params.provider || "nanobanana",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Image engine error: ${err}`, costUsd: 0, provider: "none" };
    }

    const data = await res.json();
    const imageUrl = data.results?.[0]?.imageUrl || data.imageUrl;
    const provider = data.results?.[0]?.provider || params.provider || "nanobanana";

    // Cost based on provider
    const providerCosts: Record<string, number> = {
      ideogram: 0.08,
      nanobanana: 0.039,
      "nanobanana-pro": 0.139,
    };

    return {
      success: true,
      imageUrl,
      costUsd: providerCosts[provider] || 0.04,
      provider,
    };
  } catch (err) {
    return {
      success: false,
      error: `Image engine unreachable: ${err instanceof Error ? err.message : String(err)}`,
      costUsd: 0,
      provider: "none",
    };
  }
}

/** Transform an image via image-engine */
export async function transformImage(params: {
  imageUrl: string;
  operation: string;
  options?: Record<string, unknown>;
}): Promise<ImageResult> {
  // For now, image transforms go through the same campaign endpoint
  // with the source image as context
  return generateImage({
    prompt: `Transform this image: ${params.operation}. Source: ${params.imageUrl}`,
    ...params.options,
  });
}
