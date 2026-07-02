import { action, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Actions are publicly callable — require a signed-in user before doing work. */
async function requireAuth(ctx: ActionCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated.");
}

// DSLD (NIH Dietary Supplement Label Database) — public, no API key required.
const API = "https://api.ods.od.nih.gov/dsld/v9";
const S3 = "https://api.ods.od.nih.gov/dsld/s3/pdf";

const thumbnailUrl = (id: string) => `${S3}/thumbnails/${id}.jpg`;
const pdfUrl = (id: string) => `${S3}/${id}.pdf`;

interface FactRow {
  name: string;
  ingredientGroup?: string;
  category?: string;
  amount?: number;
  unit?: string;
  operator?: string;
  dvPercent?: number;
  dvFootnote?: string;
  level: number;
  isOther: boolean;
}

interface ParsedLabel {
  dsldId: string;
  fullName: string;
  brandName?: string;
  form?: string;
  category?: string;
  servingSize?: string;
  servingsPerContainer?: number;
  jarSizeSuggestion?: number;
  upcSku?: string;
  offMarket: boolean;
  rows: FactRow[];
  otherIngredients?: string;
  nutrientHighlights: { name: string; amount: number; unit: string }[];
  thumbnailUrl: string;
}

const factRowValidator = v.object({
  name: v.string(),
  ingredientGroup: v.optional(v.string()),
  category: v.optional(v.string()),
  amount: v.optional(v.number()),
  unit: v.optional(v.string()),
  operator: v.optional(v.string()),
  dvPercent: v.optional(v.number()),
  dvFootnote: v.optional(v.string()),
  level: v.number(),
  isOther: v.boolean(),
});

const parsedLabelValidator = v.object({
  dsldId: v.string(),
  fullName: v.string(),
  brandName: v.optional(v.string()),
  form: v.optional(v.string()),
  category: v.optional(v.string()),
  servingSize: v.optional(v.string()),
  servingsPerContainer: v.optional(v.number()),
  jarSizeSuggestion: v.optional(v.number()),
  upcSku: v.optional(v.string()),
  offMarket: v.boolean(),
  rows: v.array(factRowValidator),
  otherIngredients: v.optional(v.string()),
  nutrientHighlights: v.array(
    v.object({ name: v.string(), amount: v.number(), unit: v.string() })
  ),
  thumbnailUrl: v.string(),
});

/* eslint-disable @typescript-eslint/no-explicit-any */

function flattenRows(rows: any[], level: number, out: FactRow[]) {
  for (const r of rows ?? []) {
    const q = (r.quantity ?? [])[0];
    const dv = (q?.dailyValueTargetGroup ?? [])[0];
    const pct = dv?.percent;
    out.push({
      name: r.name ?? "",
      ingredientGroup: r.ingredientGroup || undefined,
      category: r.category || undefined,
      amount: typeof q?.quantity === "number" ? q.quantity : undefined,
      unit: q?.unit || undefined,
      operator: q?.operator && q.operator !== "=" ? q.operator : undefined,
      dvPercent: pct !== null && pct !== undefined && pct !== "" ? Number(pct) : undefined,
      dvFootnote: dv?.footnote || undefined,
      level,
      isOther: false,
    });
    if (r.nestedRows?.length) flattenRows(r.nestedRows, level + 1, out);
  }
}

function otherIngredientsText(label: any): string | undefined {
  const oi = label.otheringredients;
  if (!oi) return undefined;
  if (oi.text) return String(oi.text);
  const names = (oi.ingredients ?? []).map((i: any) => i.name).filter(Boolean);
  return names.length ? names.join(", ") : undefined;
}

function servingSizeString(label: any): string | undefined {
  const ss = (label.servingSizes ?? [])[0];
  if (!ss) return undefined;
  const min = ss.minQuantity;
  const max = ss.maxQuantity;
  const qty = max && max !== min ? `${min}-${max}` : `${min}`;
  return `${qty} ${ss.unit ?? ""}`.trim();
}

function parseLabel(dsldId: string, label: any): ParsedLabel {
  const rows: FactRow[] = [];
  flattenRows(label.ingredientRows ?? [], 0, rows);

  const ss = (label.servingSizes ?? [])[0];
  // DSLD returns servingsPerContainer as a string (e.g. "100") — coerce it.
  const spcNum = Number(label.servingsPerContainer);
  const servingsPerContainer =
    label.servingsPerContainer != null &&
    label.servingsPerContainer !== "" &&
    Number.isFinite(spcNum)
      ? spcNum
      : undefined;

  // Suggested pill count: servings × serving size, else count-based net contents.
  let jarSizeSuggestion: number | undefined;
  if (servingsPerContainer && ss?.minQuantity) {
    jarSizeSuggestion = servingsPerContainer * ss.minQuantity;
  } else {
    const nc = (label.netContents ?? [])[0];
    const qty = nc ? Number(nc.quantity) : NaN;
    if (
      Number.isFinite(qty) &&
      qty > 0 &&
      /capsule|tablet|softgel|caplet|gummy|lozenge|pill|count|piece/i.test(
        nc.unit ?? ""
      )
    ) {
      jarSizeSuggestion = qty;
    }
  }

  // Curated highlights for the chip display: top-level nutrient-ish rows.
  const nutrientHighlights = rows
    .filter(
      (r) =>
        r.level === 0 &&
        typeof r.amount === "number" &&
        r.category !== "other" &&
        r.name.toLowerCase() !== "calories"
    )
    .slice(0, 6)
    .map((r) => ({ name: r.name, amount: r.amount!, unit: r.unit ?? "" }));

  return {
    dsldId,
    fullName: label.fullName ?? "",
    brandName: label.brandName || undefined,
    form: label.physicalState?.langualCodeDescription || undefined,
    category: label.productType?.langualCodeDescription || undefined,
    servingSize: servingSizeString(label),
    servingsPerContainer,
    jarSizeSuggestion,
    upcSku: label.upcSku || undefined,
    offMarket: label.offMarket === 1,
    rows,
    otherIngredients: otherIngredientsText(label),
    nutrientHighlights,
    thumbnailUrl: thumbnailUrl(dsldId),
  };
}

// --- Search: lightweight hits for the results picker ---
export const search = action({
  args: { query: v.string(), size: v.optional(v.number()) },
  returns: v.array(
    v.object({
      dsldId: v.string(),
      fullName: v.string(),
      brandName: v.string(),
      form: v.string(),
      netContents: v.string(),
      productType: v.string(),
      offMarket: v.boolean(),
      thumbnailUrl: v.string(),
    })
  ),
  handler: async (ctx, { query, size }) => {
    await requireAuth(ctx);
    const q = query.trim();
    if (!q) return [];
    const url = `${API}/search-filter?q=${encodeURIComponent(q)}&size=${size ?? 20}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`DSLD search failed (${res.status})`);
    const data = await res.json();
    return (data.hits ?? []).map((h: any) => {
      const s = h._source ?? {};
      return {
        dsldId: String(h._id),
        fullName: s.fullName ?? "",
        brandName: s.brandName ?? "",
        form: s.physicalState?.langualCodeDescription ?? "",
        netContents: (s.netContents ?? [])
          .map((n: any) => n.display)
          .filter(Boolean)
          .join(", "),
        productType: s.productType?.langualCodeDescription ?? "",
        offMarket: s.offMarket === 1,
        thumbnailUrl: thumbnailUrl(String(h._id)),
      };
    });
  },
});

// --- Label detail: parsed facts for filling the form (no storage writes) ---
export const getLabel = action({
  args: { dsldId: v.string() },
  returns: parsedLabelValidator,
  handler: async (ctx, { dsldId }): Promise<ParsedLabel> => {
    await requireAuth(ctx);
    const res = await fetch(`${API}/label/${dsldId}`);
    if (!res.ok) throw new Error(`DSLD label fetch failed (${res.status})`);
    const label = await res.json();
    return parseLabel(dsldId, label);
  },
});

async function storeAsset(
  ctx: { storage: { store: (b: Blob) => Promise<string> } },
  url: string
): Promise<string | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    if (blob.size === 0) return undefined;
    return await ctx.storage.store(blob);
  } catch {
    return undefined;
  }
}

// --- Import: fetch label + images, store assets, write the facts record ---
export const importFacts = action({
  args: { supplementId: v.id("supplements"), dsldId: v.string() },
  returns: v.null(),
  handler: async (ctx, { supplementId, dsldId }) => {
    // Throws unless the caller is signed in AND owns this supplement.
    await ctx.runQuery(internal.supplements.assertAccess, { id: supplementId });
    const res = await fetch(`${API}/label/${dsldId}`);
    if (!res.ok) throw new Error(`DSLD label fetch failed (${res.status})`);
    const label = await res.json();
    const parsed = parseLabel(dsldId, label);

    const [thumbnailStorageId, pdfStorageId] = await Promise.all([
      storeAsset(ctx, thumbnailUrl(dsldId)),
      storeAsset(ctx, pdfUrl(dsldId)),
    ]);

    await ctx.runMutation(internal.supplementFacts.upsert, {
      supplementId,
      dsldId,
      fullName: parsed.fullName,
      brandName: parsed.brandName,
      form: parsed.form,
      servingSize: parsed.servingSize,
      servingsPerContainer: parsed.servingsPerContainer,
      upcSku: parsed.upcSku,
      offMarket: parsed.offMarket,
      rows: parsed.rows,
      otherIngredients: parsed.otherIngredients,
      raw: JSON.stringify(label),
      thumbnailStorageId: thumbnailStorageId as any,
      pdfStorageId: pdfStorageId as any,
    });
  },
});
