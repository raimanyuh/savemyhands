import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import ReplayerShell from "@/components/poker/ReplayerShell";
import { recordedToHand } from "@/components/poker/hand";
import { getHandForViewing } from "@/lib/hands/db";
import { createClient } from "@/lib/supabase/server";
import { SAMPLE_HAND_ID, getSampleHand } from "@/lib/sample-hand";

// Per-hand tab title. Combines with the root template "%s — savemyhands"
// to render e.g. "AAxx vs JJ — savemyhands" in the browser tab and
// social-card title slot. Falls back to a generic title when the hand
// can't be loaded (private + non-owner, or 404).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (id === SAMPLE_HAND_ID) {
    return { title: "Sample hand" };
  }
  const fromDb = await getHandForViewing(id);
  if (!fromDb) return { title: "Hand" };
  return { title: fromDb.hand.name || "Untitled hand" };
}

export default async function HandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // The bundled sample hand bypasses the DB. We still need to know whether
  // the visitor is signed in so the replayer renders the "Dashboard" back
  // link (logged in) vs the "Sign up" CTA (logged out). Owner controls are
  // always off — nobody owns the sample.
  let result: {
    hand: ReturnType<typeof getSampleHand>;
    isOwner: boolean;
    isAuthenticated: boolean;
    ownerUsername: string | null;
  };
  if (id === SAMPLE_HAND_ID) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    result = {
      hand: getSampleHand(),
      isOwner: false,
      isAuthenticated: !!user,
      ownerUsername: null,
    };
  } else {
    const fromDb = await getHandForViewing(id);
    if (!fromDb) notFound();
    result = fromDb;
  }

  const replayHand = recordedToHand(result.hand);
  if (!replayHand) notFound();

  // Build the canonical share URL from the live request so dev (localhost)
  // and prod (vercel) both get the right host without a hardcoded constant.
  const h = await headers();
  const host = h.get("host") ?? "savemyhands.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const shareUrl = `${proto}://${host}/hand/${id}`;

  return (
    <ReplayerShell
      hand={replayHand}
      shareUrl={shareUrl}
      handId={id}
      handName={result.hand.name}
      isOwner={result.isOwner}
      isPublic={!!result.hand.isPublic}
      isAuthenticated={result.isAuthenticated}
      ownerUsername={result.ownerUsername}
      fullPayload={result.hand._full}
    />
  );
}
