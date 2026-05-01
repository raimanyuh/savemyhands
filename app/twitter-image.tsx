import { ImageResponse } from "next/og";

// Twitter card image. Same layout as the OpenGraph image so the unfurl
// looks consistent across both networks. Twitter accepts the same 1200x630
// summary_large_image dimensions.
export const alt = "savemyhands — live poker hand recorder and replayer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#171717",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 280,
            fontWeight: 900,
            letterSpacing: -16,
            color: "#10b981",
            lineHeight: 1,
            display: "flex",
          }}
        >
          smh
        </div>
        <div
          style={{
            fontSize: 38,
            fontWeight: 600,
            color: "#fafafa",
            letterSpacing: -1,
            marginTop: 28,
            display: "flex",
          }}
        >
          savemyhands.app
        </div>
        <div
          style={{
            fontSize: 22,
            color: "#a3a3a3",
            marginTop: 12,
            display: "flex",
          }}
        >
          Live poker hand recorder &amp; replayer
        </div>
      </div>
    ),
    { ...size },
  );
}
