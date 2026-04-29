export const PICKUP_CATEGORIES = [
  { id: "CAFE",             label: "Café",              icon: "Coffee"    },
  { id: "GROCERY_STORE",   label: "Grocery store",     icon: "ShoppingCart" },
  { id: "COMMUNITY_CENTRE", label: "Community centre",  icon: "Building2" },
  { id: "LIBRARY",          label: "Library",           icon: "BookOpen"  },
  { id: "PHARMACY",         label: "Pharmacy",          icon: "Pill"      },
  { id: "MALL",             label: "Mall",              icon: "Store"     },
] as const;

export type PickupCategoryId = typeof PICKUP_CATEGORIES[number]["id"];

export function getCategoryLabel(id: string): string {
  return PICKUP_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
