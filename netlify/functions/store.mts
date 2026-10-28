import type { Config } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { db } from "../../db/index.js";
import { storeState } from "../../db/schema.js";

const ROW_ID = "main";
const MAX_BYTES = 200_000;
const STORE_FIELDS = ["name", "tag", "hero", "sub", "email", "fb", "pay", "ship", "url"] as const;

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");

// Only keep the fields the storefront knows about, so a save can't inject anything unexpected.
function clean(input: any) {
  if (!input || typeof input !== "object" || !input.store || !Array.isArray(input.items)) return null;
  const store: Record<string, string> = {};
  for (const f of STORE_FIELDS) store[f] = str(input.store[f]);
  if (!store.name.trim()) return null;
  const items = input.items.slice(0, 1000).map((i: any) => ({
    id: str(i?.id, 64) || "i" + Date.now() + Math.random().toString(36).slice(2, 6),
    t: i?.t === "pack" ? "pack" : "single",
    name: str(i?.name, 300),
    meta: str(i?.meta, 300),
    note: str(i?.note),
    price: typeof i?.price === "number" && isFinite(i.price) && i.price >= 0 ? i.price : null,
    out: !!i?.out,
  }));
  return { store, qr: str(input.qr, 50_000), items };
}

// The owner is the Identity user with the "admin" role. Nobody else can save changes.
async function getOwner() {
  const user = await getUser();
  return user && user.roles?.includes("admin") ? user : null;
}

export default async (req: Request) => {
  if (req.method === "GET") {
    const [row] = await db.select().from(storeState).limit(1);
    const owner = new URL(req.url).searchParams.has("me") ? !!(await getOwner()) : undefined;
    return Response.json(
      { data: row?.data ?? null, updatedAt: row?.updatedAt ?? null, owner },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (req.method === "PUT") {
    const user = await getOwner();
    if (!user) return Response.json({ error: "Only the store owner can make changes." }, { status: 403 });
    const body = await req.text();
    if (body.length > MAX_BYTES) return Response.json({ error: "That's too much data to save at once." }, { status: 413 });
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return Response.json({ error: "Invalid data." }, { status: 400 });
    }
    const data = clean(parsed);
    if (!data) return Response.json({ error: "The store needs a name and a list of items." }, { status: 400 });
    const now = new Date();
    const by = user.email ?? user.id;
    await db
      .insert(storeState)
      .values({ id: ROW_ID, data, updatedAt: now, updatedBy: by })
      .onConflictDoUpdate({ target: storeState.id, set: { data, updatedAt: now, updatedBy: by } });
    return Response.json({ data, updatedAt: now });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/store" };
