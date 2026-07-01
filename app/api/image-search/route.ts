import { NextRequest, NextResponse } from "next/server";

export interface ImageResult {
  url: string;
  thumbUrl: string;
  title: string;
}

interface OFFProduct {
  product_name?: string;
  brands?: string;
  image_front_url?: string;
  image_url?: string;
  image_front_small_url?: string;
  image_small_url?: string;
}

interface OFFResponse {
  products?: OFFProduct[];
}

/**
 * Searches Open Food Facts for product images matching a query.
 * Free, no API key required. Mirrors the "free JSON search API" pattern
 * used elsewhere — server-side so we sidestep CORS.
 */
export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    const searchUrl =
      "https://world.openfoodfacts.org/cgi/search.pl?" +
      new URLSearchParams({
        search_terms: query.trim(),
        search_simple: "1",
        action: "process",
        json: "1",
        page_size: "24",
        fields:
          "product_name,brands,image_front_url,image_url,image_front_small_url,image_small_url",
      }).toString();

    const response = await fetch(searchUrl, {
      headers: {
        // OFF asks API consumers to identify themselves
        "User-Agent": "RefillSupplementTracker/0.1 (household supplement tracker)",
      },
    });

    if (!response.ok) {
      throw new Error(`Open Food Facts returned ${response.status}`);
    }

    const data = (await response.json()) as OFFResponse;

    const results: ImageResult[] = (data.products || [])
      .map((p) => {
        const url = p.image_front_url || p.image_url || "";
        const thumbUrl =
          p.image_front_small_url || p.image_small_url || url;
        const title = [p.brands, p.product_name]
          .filter(Boolean)
          .join(" · ")
          .trim();
        return { url, thumbUrl, title: title || "Untitled product" };
      })
      .filter((r) => r.url.startsWith("http"));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Image search error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to search images",
      },
      { status: 500 }
    );
  }
}
