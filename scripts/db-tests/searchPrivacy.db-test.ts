// Run by hand against a throwaway local UTF-8 Postgres with all migrations applied:
//   DATABASE_URL=postgresql://…@127.0.0.1:…/db DIRECT_URL=<same> JWT_SECRET=<16+ chars> npx tsx scripts/db-tests/searchPrivacy.db-test.ts
//
// Public register reads: /api/search, the /r/[id] share page's data,
// GET /api/registers/[id] and the register list API. Unauthenticated (and
// other users') responses carry only what the pages render: no drafts, no due
// date, no consent fields, no address mode, no status, no surname. The owner
// still gets her full record, and admins are unchanged. Drives the real
// routes. Writes test rows, so it refuses any non-local or non-UTF-8 database.
import { NextRequest } from "next/server";
import { prisma } from "../../src/lib/prisma";
import { signToken } from "../../src/lib/auth";
import { fetchSharePageRegister } from "../../src/lib/publicRegisterShapes";
import { GET as search } from "../../src/app/api/search/route";
import { GET as getRegister } from "../../src/app/api/registers/[id]/route";
import { GET as listRegisters } from "../../src/app/api/registers/route";
import { GET as savedRegisters } from "../../src/app/api/registers/saved/route";

const dbUrl = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(dbUrl)) {
  console.error("Refusing to run: DATABASE_URL must point at a local throwaway Postgres (127.0.0.1 or localhost).");
  process.exit(1);
}
if (!process.env.JWT_SECRET) { console.error("Set JWT_SECRET."); process.exit(1); }
async function requireUtf8() {
  const [{ enc }] = await prisma.$queryRawUnsafe<{ enc: string }[]>(`SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = current_database()`);
  if (enc !== "UTF8") { console.error(`Refusing to run: the database encoding is ${enc}; it must be UTF8, like prod.`); process.exit(1); }
}

let fails = 0;
const check = (label: string, ok: boolean, detail = "") => { if (!ok) fails++; console.log(ok ? "pass" : "FAIL", label, detail); };
let n = 0;
const uid = () => `${Date.now()}-${n++}`;
const get = (url: string, bearer?: string) =>
  new NextRequest(`http://localhost${url}`, { headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} });
const p = <T extends Record<string, string>>(o: T) => ({ params: Promise.resolve(o) });
const allKeys = (v: unknown, out = new Set<string>()) => {
  JSON.stringify(v, (k, x) => { if (k && Number.isNaN(Number(k))) out.add(k); return x; });
  return out;
};
// Fields that must never reach an unauthenticated or non-owner caller.
const PRIVATE_KEYS = ["dueDate", "featureConsent", "featureConsentAt", "featureConsentVersion", "addressMode",
  "createdAt", "updatedAt", "closedAt", "completedAt", "creatorId", "location", "assignment", "note", "sku", "title"];

(async () => {
  await requireUtf8();

  const mom = await prisma.user.create({ data: { name: "Amina Okafor", email: `m${uid()}@t.test`, password: "x", location: "SecretLocationville" } });
  const momToken = await signToken({ userId: mom.id, role: "RECIPIENT", name: "Amina Okafor" });
  const stranger = await prisma.user.create({ data: { name: "Sam Stranger", email: `s${uid()}@t.test`, password: "x" } });
  const strangerToken = await signToken({ userId: stranger.id, role: "DONOR", name: "Sam Stranger" });
  const admin = await prisma.user.create({ data: { name: "Ada Admin", email: `a${uid()}@t.test`, password: "x", role: "ADMIN" } });
  const adminToken = await signToken({ userId: admin.id, role: "ADMIN", name: "Ada Admin" });

  const dueDate = new Date("2027-03-14T00:00:00Z");
  const reg = (title: string, status: "ACTIVE" | "DRAFT" | "CLOSED") => prisma.register.create({ data: {
    title, city: "Torontoville", dueDate, creatorId: mom.id, status, featureConsent: true, featureConsentVersion: 2, featureConsentAt: new Date(),
  } });
  const active = await reg("baby things for March", "ACTIVE");
  const surname = await reg("Okafor twins babylist", "ACTIVE");   // withheld: her surname
  const empty = await reg("", "ACTIVE");                           // no title at all
  const draft = await reg("draft baby list", "DRAFT");
  const closed = await reg("closed baby list", "CLOSED");
  const diapers = await prisma.registerItem.create({ data: { name: "Diapers", registerId: active.id, standardPriceCents: 2000, note: "SecretNoteText" } });
  const donor = await prisma.user.create({ data: { name: "Bisi Adeyemi", email: `bisi${uid()}@secret.test`, password: "x", verificationLevel: 2, avatar: "https://img.test/SecretAvatar.png" } });
  await prisma.item.create({ data: { title: "baby crib", category: "Sleep", condition: "Good", quantity: "1", location: "Lagos", donorId: donor.id, status: "ACTIVE" } });

  // ── Unauthenticated search ───────────────────────────────────────────────
  const s1 = await (await search(get("/api/search?q=baby&type=registers"))).json();
  const ids = s1.registers.map((r: { id: string }) => r.id);
  check("search: active register found", ids.includes(active.id));
  check("search: no drafts", !ids.includes(draft.id));
  check("search: no closed registers", !ids.includes(closed.id));
  check("search: a title withheld by the check can't be matched", !ids.includes(surname.id));
  check("search: only id, first name, title, city and display name", s1.registers.every((r: object) => JSON.stringify(Object.keys(r).sort()) === JSON.stringify(["city", "displayName", "firstName", "id", "title"])),
    JSON.stringify(s1.registers));
  const s1text = JSON.stringify(s1);
  check("search: no due date, consent fields, status or surname", !/dueDate|featureConsent|addressMode|"status"|Okafor|2027-03-14/.test(s1text), s1text.slice(0, 200));
  check("search: first name only", s1.registers.find((r: { id: string }) => r.id === active.id)?.firstName === "Amina");
  const s2 = await (await search(get("/api/search?q=okafor&type=registers"))).json();
  check("search: her surname finds nothing", s2.registers.length === 0, JSON.stringify(s2.registers));
  const s3 = await (await search(get("/api/search?q=torontoville&type=registers"))).json();
  const bySurnameReg = s3.registers.find((r: { id: string }) => r.id === surname.id);
  check("search: city match returns it with the title withheld", !!bySurnameReg && bySurnameReg.title === null, JSON.stringify(s3.registers));
  check("search: city match still no drafts", !s3.registers.some((r: { id: string }) => r.id === draft.id));

  // The display name: "First · title", or "First's Register" when the title is withheld or empty.
  check("search name: first name and title", s1.registers.find((r: { id: string }) => r.id === active.id)?.displayName === "Amina · baby things for March",
    JSON.stringify(s1.registers));
  check("search name: title withheld → her Register", bySurnameReg?.displayName === "Amina's Register", JSON.stringify(bySurnameReg));
  check("search name: title empty → her Register", s3.registers.find((r: { id: string }) => r.id === empty.id)?.displayName === "Amina's Register");
  check("search name: never a surname", !/Okafor/.test(JSON.stringify(s3)));
  // Her first name finds her registers (draft and closed still excluded).
  const s4 = await (await search(get("/api/search?q=amina&type=registers"))).json();
  const s4ids = s4.registers.map((r: { id: string }) => r.id);
  check("search: her first name finds her active registers", s4ids.includes(active.id) && s4ids.includes(surname.id) && !s4ids.includes(draft.id) && !s4ids.includes(closed.id),
    JSON.stringify(s4.registers.map((r: { displayName: string }) => r.displayName)));

  // Discover items: the donor by first name only.
  const si = await (await search(get("/api/search?q=crib&type=items"))).json();
  const crib = si.items.find((i: { title: string }) => i.title === "baby crib");
  check("search items: donor first name only", JSON.stringify(crib?.donor) === JSON.stringify({ firstName: "Bisi", verified: true }), JSON.stringify(crib?.donor));
  const siText = JSON.stringify(si);
  check("search items: no donor full name, id, email or avatar", !siText.includes("Adeyemi") && !siText.includes(donor.id) && !siText.includes("secret.test")
    && !siText.includes("SecretAvatar") && !allKeys(si).has("donorId") && !allKeys(si).has("email"), siText.slice(0, 300));
  check("search items: only the fields the page shows", crib && JSON.stringify(Object.keys(crib).sort()) === JSON.stringify(["category", "condition", "createdAt", "donor", "id", "images", "location", "title"]));

  // ── The share page /r/[id] data ──────────────────────────────────────────
  const share = (await fetchSharePageRegister(active.id))!;
  check("share page: only what it renders", JSON.stringify(Object.keys(share).sort()) === JSON.stringify(["city", "displayName", "firstName", "id", "intro", "items", "stageLine", "status", "verificationBadge"]));
  check("share page: no raw title, due date or note", !/"title"|2027-03-14|dueDate|SecretNoteText|Okafor/.test(JSON.stringify(share)));
  check("share page heading: first name and title", share.displayName === "Amina · baby things for March", share.displayName);
  check("share page heading: title withheld → her Register", (await fetchSharePageRegister(surname.id))?.displayName === "Amina's Register");
  check("share page heading: title empty → her Register", (await fetchSharePageRegister(empty.id))?.displayName === "Amina's Register");
  check("share page: a draft has no page", (await fetchSharePageRegister(draft.id)) === null);

  // ── GET /api/registers/[id] ──────────────────────────────────────────────
  for (const [who, token] of [["unauthenticated", undefined], ["another user", strangerToken]] as const) {
    const res = await getRegister(get(`/api/registers/${active.id}`, token), p({ id: active.id }));
    const body = await res.json();
    const k = allKeys(body.register);
    const leaked = PRIVATE_KEYS.filter((x) => k.has(x));
    check(`register (${who}): no private fields`, res.status === 200 && leaked.length === 0, leaked.join(","));
    check(`register (${who}): first name only, no location`, body.register?.creator?.name === "Amina" && !JSON.stringify(body).includes("SecretLocationville"));
    check(`register (${who}): stage line instead of due date`, typeof body.register?.stageLine === "string" && !JSON.stringify(body).includes("2027-03-14"));
    check(`register (${who}): a draft is not found`, (await getRegister(get(`/api/registers/${draft.id}`, token), p({ id: draft.id }))).status === 404);
  }
  const viewName = async (id: string, token?: string) => (await (await getRegister(get(`/api/registers/${id}`, token), p({ id }))).json()).register?.displayName;
  check("register page heading: first name and title", await viewName(active.id) === "Amina · baby things for March");
  check("register page heading: title withheld → her Register", await viewName(surname.id) === "Amina's Register");
  check("register page heading: title empty → her Register", await viewName(empty.id) === "Amina's Register");
  check("register page heading: the same name for her and admins", await viewName(surname.id, momToken) === "Amina's Register"
    && await viewName(active.id, adminToken) === "Amina · baby things for March");
  check("register (unauthenticated): the withheld title is nowhere in it", !JSON.stringify(await (await getRegister(get(`/api/registers/${surname.id}`), p({ id: surname.id }))).json()).includes("twins"));
  const own = (await (await getRegister(get(`/api/registers/${active.id}`, momToken), p({ id: active.id }))).json()).register;
  check("register (owner): her full record", own.dueDate?.startsWith("2027-03-14") && own.title === "baby things for March"
    && own.addressMode === "ASK_PER_SHIPMENT" && own.featureConsent === true && own.featureConsentVersion === 2
    && own.creator.name === "Amina Okafor" && own.creator.location === "SecretLocationville" && own.status === "ACTIVE");
  check("register (owner): her own draft", (await getRegister(get(`/api/registers/${draft.id}`, momToken), p({ id: draft.id }))).status === 200);
  const adm = (await (await getRegister(get(`/api/registers/${active.id}`, adminToken), p({ id: active.id }))).json()).register;
  check("register (admin): unchanged, full record", adm.dueDate?.startsWith("2027-03-14") && adm.title === "baby things for March" && adm.creator.name === "Amina Okafor" && "featureConsent" in adm);
  check("register (admin): drafts too", (await getRegister(get(`/api/registers/${draft.id}`, adminToken), p({ id: draft.id }))).status === 200);

  // ── The register list API ────────────────────────────────────────────────
  const list = async (url: string, token?: string) => (await (await listRegisters(get(url, token))).json()).registers as Record<string, unknown>[];
  for (const [who, token] of [["unauthenticated", undefined], ["another user", strangerToken]] as const) {
    for (const url of ["/api/registers", `/api/registers?creatorId=${mom.id}`]) {
      const rows = await list(url, token);
      const rids = rows.map((r) => r.id);
      const leaked = PRIVATE_KEYS.filter((x) => allKeys(rows).has(x));
      check(`list ${url.includes("creatorId") ? "?creatorId" : "(browse)"} (${who}): no drafts or closed, no private fields`,
        !rids.includes(draft.id) && !rids.includes(closed.id) && rids.includes(active.id) && leaked.length === 0, leaked.join(","));
      check(`list ${url.includes("creatorId") ? "?creatorId" : "(browse)"} (${who}): no surname or raw date`, !/Okafor|2027-03-14/.test(JSON.stringify(rows)));
    }
  }
  const ownList = await list(`/api/registers?creatorId=${mom.id}`, momToken);
  check("list (owner, her own): every status, full records", [active.id, draft.id, closed.id].every((id) => ownList.some((r) => r.id === id))
    && ownList.every((r) => "dueDate" in r && "title" in r && "featureConsent" in r));
  const adminList = await list(`/api/registers?creatorId=${mom.id}`, adminToken);
  check("list (admin, ?creatorId): unchanged, every status, full records", adminList.some((r) => r.id === draft.id) && adminList.every((r) => "dueDate" in r && "title" in r));
  const adminBrowse = await list("/api/registers", adminToken);
  check("list (admin, browse): unchanged, ACTIVE full records", adminBrowse.some((r) => r.id === active.id) && !adminBrowse.some((r) => r.id === draft.id)
    && adminBrowse.every((r) => "dueDate" in r));
  const browse = await list("/api/registers");
  const card = (id: string) => browse.find((r) => r.id === id) as { displayName?: string } | undefined;
  check("browse card: first name and title", card(active.id)?.displayName === "Amina · baby things for March");
  check("browse card: title withheld → her Register", card(surname.id)?.displayName === "Amina's Register");
  check("browse card: title empty → her Register", card(empty.id)?.displayName === "Amina's Register");
  check("browse: the withheld title is nowhere in it", !JSON.stringify(browse).includes("twins"));
  check("browse (admin): cards named the same way", (await list("/api/registers", adminToken)).find((r) => r.id === surname.id)?.displayName === "Amina's Register");
  const label = browse.find((r) => r.id === active.id) as { dueLabel?: string; dueSoon?: boolean } | undefined;
  check("list (browse): a rough due label, no day or month", /^Due in \d+ weeks$/.test(label?.dueLabel ?? "") && label?.dueSoon === false, JSON.stringify(label));

  // The saved list (another mother's register, to a donor): rough label, first name.
  await prisma.savedItem.create({ data: { userId: stranger.id, itemId: diapers.id, registerId: active.id } });
  const twinsItem = await prisma.registerItem.create({ data: { name: "Wipes", registerId: surname.id, standardPriceCents: 500 } });
  await prisma.savedItem.create({ data: { userId: stranger.id, itemId: twinsItem.id, registerId: surname.id } });
  const saved = await (await savedRegisters(get("/api/registers/saved", strangerToken))).json();
  const sreg = saved.items?.find((i: { register: { id: string } }) => i.register.id === active.id)?.register;
  const sregW = saved.items?.find((i: { register: { id: string } }) => i.register.id === surname.id)?.register;
  check("saved list: first name and title", sreg?.displayName === "Amina · baby things for March", JSON.stringify(sreg));
  check("saved list: title withheld → her Register", sregW?.displayName === "Amina's Register", JSON.stringify(sregW));
  check("saved list: the withheld title is nowhere in it", !JSON.stringify(saved).includes("twins"));
  check("saved list: id, city, rough due label, first name only", sreg && JSON.stringify(Object.keys(sreg).sort()) === JSON.stringify(["city", "creator", "displayName", "dueLabel", "id"])
    && JSON.stringify(sreg.creator) === JSON.stringify({ firstName: "Amina" }) && /^Due in \d+ weeks$/.test(sreg.dueLabel), JSON.stringify(sreg));

  // No due date, in any form, in any public response.
  const DATE = /2027-03-14|March 14|Mar 14|14 March|"dueDate"/;
  const publicTexts: [string, string][] = [
    ["search", JSON.stringify(s1) + JSON.stringify(s3) + JSON.stringify(s4)],
    ["share page", JSON.stringify(share)],
    ["register (unauthenticated)", JSON.stringify(await (await getRegister(get(`/api/registers/${active.id}`), p({ id: active.id }))).json())],
    ["browse list", JSON.stringify(await list("/api/registers"))],
    ["?creatorId list (unauthenticated)", JSON.stringify(await list(`/api/registers?creatorId=${mom.id}`))],
    ["saved list", JSON.stringify(saved)],
  ];
  for (const [where, text] of publicTexts) check(`no due date in ${where}`, !DATE.test(text), (text.match(DATE) ?? [""])[0]);

  console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILED`);
  await prisma.$disconnect();
  process.exit(fails === 0 ? 0 : 1);
})();
