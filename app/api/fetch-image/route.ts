import { NextRequest, NextResponse } from "next/server";

/**
 * Downloads an image by URL server-side and returns it as a base64 data URL.
 * This sidesteps browser CORS restrictions (the renderer can't read bytes
 * from arbitrary cross-origin image hosts) — the same trick LAAB Converter
 * uses via Electron's main process.
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return NextResponse.json(
        { error: "A valid image URL is required" },
        { status: 400 }
      );
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "RefillSupplementTracker/0.1",
      },
    });

    if (!response.ok) {
      throw new Error(`Image host returned ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      throw new Error("URL did not return an image");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;

    return NextResponse.json({ dataUrl });
  } catch (error) {
    console.error("Fetch image error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch image",
      },
      { status: 500 }
    );
  }
}
