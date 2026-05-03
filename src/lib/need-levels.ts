type NeedLevel = "HIGH" | "LOW" | null;

const HIGH_NEED_SKUS = new Set([
  "F02", // Ready-to-feed formula
  "M01", // Postpartum pads
  "M02", // Disposable underwear
  "M03", // Peri bottle
  "M05", // Cold packs
  "D01", // Newborn diapers
]);

const LOW_NEED_SKUS = new Set([
  "H03", // Bath set
  "M09", // Pregnancy pillow
  "C09", // Snowsuit
  "C10", // Hooded towels
]);

export function calculateNeedLevel(sku: string | null | undefined): NeedLevel {
  if (!sku) return null;
  if (HIGH_NEED_SKUS.has(sku)) return "HIGH";
  if (LOW_NEED_SKUS.has(sku)) return "LOW";
  return null;
}
