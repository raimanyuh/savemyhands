"use client";

// Route-level branch between desktop and mobile recorder. The /record
// page is server-rendered (auth gate); this client wrapper picks which
// recorder to mount once the viewport is known. Below 640px → mobile;
// 640px and up → existing desktop UI (tablet reuses desktop).

import { useIsMobile } from "@/lib/use-is-mobile";
import Recorder from "./Recorder";
import MobileRecorder from "@/components/mobile/MobileRecorder";

export default function RecorderShell() {
  const { isMobile, bp } = useIsMobile();
  return (
    <>
      {/* TEMPORARY debug badge — confirms which branch mounted. Remove
          once mobile branching is verified end-to-end. */}
      {process.env.NODE_ENV !== "production" && (
        <div
          style={{
            position: "fixed",
            top: 4,
            right: 4,
            zIndex: 9999,
            padding: "2px 6px",
            background: isMobile ? "oklch(0.696 0.205 155)" : "rgba(255,80,80,0.9)",
            color: "white",
            fontSize: 10,
            fontFamily: "monospace",
            borderRadius: 4,
            pointerEvents: "none",
          }}
        >
          bp:{bp} w:{typeof window !== "undefined" ? window.innerWidth : "?"}
        </div>
      )}
      {isMobile ? <MobileRecorder /> : <Recorder />}
    </>
  );
}
