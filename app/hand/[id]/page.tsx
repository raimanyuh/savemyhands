"use client";

import { use, useState } from "react";
import Replayer from "@/components/poker/Replayer";
import {
  recordedToHand,
  type ReplayHand,
  type SavedHand,
} from "@/components/poker/hand";

function loadHand(id: string): ReplayHand | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(
      localStorage.getItem("smh:hands") || "[]",
    ) as SavedHand[];
    const found = saved.find((h) => h.id === id);
    if (found) return recordedToHand(found);
  } catch {
    /* fall through */
  }
  return null;
}

export default function HandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  // Lazy init reads localStorage once on the client. If the hand isn't found
  // (or we're rendering on the server), Replayer falls back to its sample.
  const [hand] = useState<ReplayHand | null>(() => loadHand(id));
  return <Replayer hand={hand} />;
}
