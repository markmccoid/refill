import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";

interface ProductData {
  name: string;
  price: number;
  imageUrl?: string;
  description?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Only allow Amazon URLs for MVP
    if (!url.includes("amazon.com") && !url.includes("amazon.")) {
      return NextResponse.json(
        { error: "Currently only Amazon URLs are supported" },
        { status: 400 }
      );
    }

    const product = await scrapeAmazonProduct(url);
    return NextResponse.json(product);
  } catch (error) {
    console.error("Scraping error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to scrape product",
      },
      { status: 500 }
    );
  }
}

async function scrapeAmazonProduct(url: string): Promise<ProductData> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    );

    // Set a timeout
    page.setDefaultNavigationTimeout(15000);
    page.setDefaultTimeout(15000);

    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Give the main image a moment to attach (best-effort, don't fail if missing)
    await page
      .waitForSelector("#landingImage, #imgTagWrapperId img, meta[property='og:image']", {
        timeout: 5000,
      })
      .catch(() => {});

    // Extract product data
    const productData = await page.evaluate(() => {
      // Product name - use the correct Amazon selector
      const titleElement = document.querySelector("span#productTitle");
      const name =
        titleElement?.textContent?.trim() || "Unknown Product";

      // Price - look for the list price or main price
      let price = 0;
      const priceElement =
        document.querySelector("span.a-price.a-text-price.a-size-medium.a-color-price") ||
        document.querySelector("span.a-price-whole");

      if (priceElement) {
        const priceText = priceElement.textContent
          ?.replace(/[^\d.]/g, "")
          .trim();
        price = priceText ? parseFloat(priceText) : 0;
      }

      // Image - layered approach, most reliable first
      let imageUrl: string | undefined;

      const isUsable = (s: string | null | undefined): s is string =>
        !!s && s.startsWith("http") && !s.startsWith("data:");

      // 1. Main landing image: prefer hi-res, then largest of the dynamic-image map, then src
      const landing =
        (document.querySelector("#landingImage") as HTMLImageElement | null) ||
        (document.querySelector("#imgTagWrapperId img") as HTMLImageElement | null) ||
        (document.querySelector("img.a-dynamic-image") as HTMLImageElement | null);

      if (landing) {
        const hires = landing.getAttribute("data-old-hires");
        if (isUsable(hires)) {
          imageUrl = hires;
        }

        if (!imageUrl) {
          // data-a-dynamic-image is a JSON map of { url: [w, h] } — pick the widest
          const dynamic = landing.getAttribute("data-a-dynamic-image");
          if (dynamic) {
            try {
              const map = JSON.parse(dynamic) as Record<string, number[]>;
              let bestUrl: string | undefined;
              let bestWidth = -1;
              for (const [u, dims] of Object.entries(map)) {
                const w = Array.isArray(dims) ? dims[0] : 0;
                if (isUsable(u) && w > bestWidth) {
                  bestWidth = w;
                  bestUrl = u;
                }
              }
              if (bestUrl) imageUrl = bestUrl;
            } catch {
              // ignore malformed JSON
            }
          }
        }

        if (!imageUrl && isUsable(landing.src)) {
          imageUrl = landing.src;
        }
      }

      // 2. Fallback: Open Graph image meta tag (set on most Amazon product pages)
      if (!imageUrl) {
        const og = document
          .querySelector('meta[property="og:image"]')
          ?.getAttribute("content");
        if (isUsable(og)) imageUrl = og;
      }

      // Jar size/Count - from size variants, matched against title
      let jarSize = 120; // default
      const titleText = titleElement?.textContent || "";

      // Find all size variant elements (size_name_0, size_name_1, etc)
      const sizeElements = document.querySelectorAll("span[id^='size_name_']");
      if (sizeElements.length > 0) {
        // Extract all possible sizes and find the one in the title
        for (const elem of sizeElements) {
          const sizeText = elem.textContent || "";
          const numbers = sizeText.match(/\d+/);
          if (numbers) {
            const possibleSize = numbers[0];
            // Check if this size appears in the title
            if (titleText.includes(possibleSize)) {
              jarSize = parseInt(possibleSize, 10);
              break; // Use the first match found in title
            }
          }
        }
      }

      // Description - try to get product details from bullet points
      let description: string | undefined;
      const descElement =
        document.querySelector("#feature-bullets") ||
        document.querySelector("ul.a-unordered-list");
      if (descElement) {
        const bullets = descElement.querySelectorAll("li span");
        const bulletTexts = Array.from(bullets)
          .slice(0, 3)
          .map((li) => li.textContent?.trim())
          .filter(Boolean);
        if (bulletTexts.length > 0) {
          description = bulletTexts.join(" · ");
        }
      }

      return {
        name,
        price,
        imageUrl,
        description,
        jarSize,
      };
    });

    return productData;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
