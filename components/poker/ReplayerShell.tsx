"use client";

// Route-level branch between desktop and mobile replayer. Mirrors
// RecorderShell / DashboardShell — the /hand/[id] page is server-
// rendered (auth + data fetch); this client wrapper picks which UI to
// mount once the viewport is known. Below 640px → mobile; 640px and up
// → existing desktop UI (tablet reuses desktop).

import { useIsMobile } from "@/lib/use-is-mobile";
import { useState } from "react";
import Replayer from "./Replayer";
import MobileReplayer from "@/components/mobile/MobileReplayer";
import type { ReplayHand, SavedHand } from "./hand";

export default function ReplayerShell(props: Parameters<typeof Replayer>[0]) {
  return <ReplayerLayout key={props.hand.id} {...props} />;
}

function ReplayerLayout({
  hand,
  shareUrl,
  handId,
  handName,
  isOwner,
  isPublic,
  isAuthenticated,
  ownerUsername,
  fullPayload,
}: {
  hand: ReplayHand;
  shareUrl?: string;
  handId?: string;
  // Display name shown as the title in both desktop and mobile
  // replayer headers.
  handName?: string;
  isOwner?: boolean;
  isPublic?: boolean;
  isAuthenticated?: boolean;
  ownerUsername?: string | null;
  fullPayload?: SavedHand["_full"];
}) {
  const { isMobile } = useIsMobile();
  const [sharedPublic, setSharedPublic] = useState(isPublic ?? false);
  if (isMobile) {
    return (
      <MobileReplayer
        hand={hand}
        shareUrl={shareUrl}
        handId={handId}
        handName={handName}
        isOwner={isOwner}
        isPublic={sharedPublic}
        onPublicChangeAction={setSharedPublic}
        isAuthenticated={isAuthenticated}
        ownerUsername={ownerUsername}
        fullPayload={fullPayload}
      />
    );
  }
  return (
    <Replayer
      hand={hand}
      shareUrl={shareUrl}
      handId={handId}
      handName={handName}
      isOwner={isOwner}
      isPublic={sharedPublic}
      onPublicChangeAction={setSharedPublic}
      isAuthenticated={isAuthenticated}
      ownerUsername={ownerUsername}
      fullPayload={fullPayload}
    />
  );
}
