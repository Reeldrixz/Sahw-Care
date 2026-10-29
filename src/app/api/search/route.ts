import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toSearchRegister, toSearchItem, type SearchRegister } from "@/lib/publicRegisterShapes";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = (searchParams.get("q") ?? "").trim();
  const type = searchParams.get("type") ?? "all";

  if (q.length < 2) {
    return NextResponse.json({ items: [], bundles: [], registers: [], total: 0, query: q });
  }

  const [items, bundles, registers] = await Promise.all([
    type === "bundles" || type === "registers" ? Promise.resolve([]) :
    prisma.item.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { title:       { contains: q, mode: "insensitive" } },
          { category:    { contains: q, mode: "insensitive" } },
          { location:    { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      // Only what the search page renders. The donor's full name is read for
      // her first name only (lib/publicRegisterShapes toSearchItem); no donor
      // id, email or avatar leaves the server.
      select: {
        id: true, title: true, category: true, condition: true, location: true, images: true, createdAt: true,
        donor: { select: { name: true, verificationLevel: true } },
      },
      take: 20,
      orderBy: { createdAt: "desc" },
    }),

    type === "items" || type === "registers" ? Promise.resolve([]) :
    prisma.bundleTemplate.findMany({
      where: {
        isActive: true,
        OR: [
          { name:        { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { targetStage: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),

    // Registers: ACTIVE only (no drafts, nothing closed or abandoned), and only
    // the columns needed to build lib/publicRegisterShapes SearchRegister: id,
    // first name, the checked title, city and its label. Her full name is read
    // for the first name and the surname check only, and never leaves the
    // server. Fetched wider than shown, because a candidate matched only by a
    // withheld title or by her surname drops out below (toSearchRegister).
    type === "items" || type === "bundles" ? Promise.resolve([]) :
    prisma.register.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { city:  { contains: q, mode: "insensitive" } },
          // A candidate only: toSearchRegister keeps it if her FIRST name
          // matches, never her surname.
          { creator: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: { id: true, title: true, city: true, creator: { select: { name: true } } },
      take: 25,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const publicRegisters = registers
    .map((r) => toSearchRegister(r, q))
    .filter((r): r is SearchRegister => r !== null)
    .slice(0, 5);

  return NextResponse.json({
    items: items.map(toSearchItem),
    bundles,
    registers: publicRegisters,
    total: items.length + bundles.length + publicRegisters.length,
    query: q,
  });
}
