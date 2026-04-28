import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_CITIES = [
  { name: "Toronto",     country: "Canada"  },
  { name: "Lagos",       country: "Nigeria" },
  { name: "Abuja",       country: "Nigeria" },
  { name: "London",      country: "UK"      },
  { name: "New York",    country: "USA"     },
  { name: "Scarborough", country: "Canada"  },
  { name: "Mississauga", country: "Canada"  },
  { name: "Brampton",    country: "Canada"  },
];

export async function GET() {
  const rows = await prisma.item.findMany({
    where: { status: "ACTIVE" },
    select: { location: true },
    distinct: ["location"],
  });

  const defaultNames = new Set(DEFAULT_CITIES.map((c) => c.name.toLowerCase()));
  const extra: { name: string; country: string }[] = [];

  rows.forEach((row) => {
    const city = row.location.split(",")[0].trim();
    if (city && !defaultNames.has(city.toLowerCase())) {
      extra.push({ name: city, country: "" });
      defaultNames.add(city.toLowerCase());
    }
  });

  return NextResponse.json({ cities: [...DEFAULT_CITIES, ...extra] });
}
