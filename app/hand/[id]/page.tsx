import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Replayer from "@/components/poker/Replayer";
import { recordedToHand } from "@/components/poker/hand";
import { getHandForViewing } from "@/lib/hands/db";

export default async function HandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getHandForViewing(id);
  if (!result) notFound();
  const replayHand = recordedToHand(result.hand);
  if (!replayHand) notFound();

  // Build the canonical share URL from the live request so dev (localhost)
  // and prod (vercel) both get the right host without a hardcoded constant.
  const h = await headers();
  const host = h.get("host") ?? "savemyhands.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const shareUrl = `${proto}://${host}/hand/${id}`;

  return (
    <Replayer
      hand={replayHand}
      shareUrl={shareUrl}
      handId={id}
      isOwner={result.isOwner}
      isPublic={!!result.hand.isPublic}
      isAuthenticated={result.isAuthenticated}
      ownerUsername={result.ownerUsername}
      fullPayload={result.hand._full}
    />
  );
}
