// Server-side data layer for the `hands` table.
//
// All callers go through the cookie-bound Supabase client, so RLS enforces:
//   * SELECT — public (anyone with the URL can view a hand)
//   * INSERT/UPDATE/DELETE — owner only (auth.uid() = user_id)

import { createClient } from "@/lib/supabase/server";
import type { SavedHand } from "@/components/poker/hand";

// 8-char base-36 id. Bumped from the recorder's old 6-char value — keyspace
// of ~2.8T means birthday-paradox collisions don't show up until ~1.7M
// hands. Insert retries below cover the unlucky cases anyway.
export function newHandId(): string {
  let s = "";
  while (s.length < 8) {
    s += Math.random().toString(36).slice(2);
  }
  return s.slice(0, 8);
}

type HandRow = {
  id: string;
  user_id: string;
  name: string;
  date_display: string;
  date_iso: string | null;
  stakes: string;
  loc: string | null;
  hero_position: string | null;
  multiway: boolean | null;
  board: string[];
  pot_type: SavedHand["type"];
  tags: string[];
  result: number;
  fav: boolean;
  notes: string | null;
  is_public: boolean;
  payload: NonNullable<SavedHand["_full"]>;
  created_at: string;
  updated_at: string;
};

function rowToSavedHand(row: HandRow): SavedHand {
  return {
    id: row.id,
    name: row.name,
    date: row.date_display,
    stakes: row.stakes,
    loc: row.loc ?? "—",
    positions: row.hero_position ?? "",
    multiway: row.multiway ?? undefined,
    board: row.board,
    type: row.pot_type,
    tags: row.tags,
    result: row.result,
    fav: row.fav,
    notes: row.notes ?? undefined,
    isPublic: row.is_public,
    _full: row.payload,
  };
}

// Build the column-shaped object passed to insert/update. `loc` and `notes`
// store as NULL when blank so SQL filters can use IS NULL semantics.
// `is_public` is intentionally omitted on insert so the DB default (false)
// applies — sharing is opt-in via setHandPublic.
function savedHandToColumns(h: SavedHand, userId: string) {
  return {
    id: h.id,
    user_id: userId,
    name: h.name,
    date_display: h.date,
    date_iso: h._full?.date ?? null,
    stakes: h.stakes,
    loc: h.loc && h.loc !== "—" ? h.loc : null,
    hero_position: h.positions || null,
    multiway: typeof h.multiway === "boolean" ? h.multiway : null,
    board: h.board,
    pot_type: h.type,
    tags: h.tags,
    result: h.result,
    fav: h.fav,
    notes: h.notes ?? null,
    payload: h._full ?? null,
  };
}

export async function listMyHands(): Promise<SavedHand[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("hands")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as HandRow[]).map(rowToSavedHand);
}

export async function getHand(id: string): Promise<SavedHand | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hands")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToSavedHand(data as HandRow);
}

// Server-rendered hand page needs the data, the viewer's relationship to it
// (signed in? owner?), and the owner's public username for attribution. RLS
// already filters out private rows for non-owners — we just learn whether to
// surface owner-only controls and the dashboard back-link.
export async function getHandForViewing(id: string): Promise<{
  hand: SavedHand;
  isOwner: boolean;
  isAuthenticated: boolean;
  // The owner's @username, or null if they haven't picked one. Public-readable
  // via the profiles RLS policy so anon viewers see it too.
  ownerUsername: string | null;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("hands")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as HandRow;
  const { data: profileData } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", row.user_id)
    .maybeSingle();
  return {
    hand: rowToSavedHand(row),
    isOwner: !!user && user.id === row.user_id,
    isAuthenticated: !!user,
    ownerUsername: (profileData as { username: string } | null)?.username ?? null,
  };
}

export async function countMyHands(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count, error } = await supabase
    .from("hands")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (error) throw error;
  return count ?? 0;
}

// Mints a fresh id and inserts. PK collisions (PG 23505) get retried with a
// new id; the keyspace makes this exceedingly unlikely.
export async function insertHand(
  input: Omit<SavedHand, "id">,
): Promise<SavedHand> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = newHandId();
    const hand: SavedHand = { ...input, id };
    const { error } = await supabase
      .from("hands")
      .insert(savedHandToColumns(hand, user.id));
    if (!error) return hand;
    // 23505 = unique_violation. Anything else is a real failure.
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not mint a unique hand id after 5 attempts");
}

// Patch the metadata fields editable from the dashboard's "Edit details"
// modal. RLS enforces ownership — non-owners just get 0 rows updated.
type HandDetailsPatch = Partial<
  Pick<SavedHand, "name" | "loc" | "notes" | "date" | "tags" | "fav" | "_full">
>;

export async function updateHandDetails(
  id: string,
  patch: HandDetailsPatch,
): Promise<void> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.loc !== undefined)
    update.loc = patch.loc && patch.loc !== "—" ? patch.loc : null;
  if (patch.notes !== undefined) update.notes = patch.notes ?? null;
  if (patch.date !== undefined) update.date_display = patch.date;
  if (patch.tags !== undefined) update.tags = patch.tags;
  if (patch.fav !== undefined) update.fav = patch.fav;
  if (patch._full !== undefined) {
    update.payload = patch._full;
    if (patch._full?.date !== undefined) update.date_iso = patch._full.date;
  }
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase.from("hands").update(update).eq("id", id);
  if (error) throw error;
}

// Toggle whether a hand is viewable by non-owners. RLS enforces that only
// the owner can call this — others get 0 rows updated and silently no-op.
export async function setHandPublic(
  id: string,
  isPublic: boolean,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("hands")
    .update({ is_public: isPublic })
    .eq("id", id);
  if (error) throw error;
}

// Bulk variant of setHandPublic. Same RLS semantics — non-owners just get
// 0 rows updated. No-ops on empty input so callers can pass a filtered list
// without an extra guard.
export async function setHandsPublic(
  ids: string[],
  isPublic: boolean,
): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("hands")
    .update({ is_public: isPublic })
    .in("id", ids);
  if (error) throw error;
}

export async function deleteHand(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("hands").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteHands(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("hands").delete().in("id", ids);
  if (error) throw error;
}
