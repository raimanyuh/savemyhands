import { ImageResponse } from "next/og";

// Apple touch icon for iOS home-screen shortcuts. iOS overlays its own
// rounded-corner mask so we just paint a square — the borderRadius is a
// belt-and-suspenders for older iOS that doesn't mask.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#171717",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 36,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 70,
            fontWeight: 900,
            letterSpacing: -4,
            color: "#10b981",
            lineHeight: 1,
            display: "flex",
          }}
        >
          smh
        </div>
      </div>
    ),
    { ...size },
  );
}
