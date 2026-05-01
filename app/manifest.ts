import type { MetadataRoute } from "next";

// Web app manifest — drives the "Add to Home Screen" experience on
// Android (and is read by Chrome/Edge desktop for installability). Icon
// URLs come from the Next file conventions: /icon.svg is the static
// favicon, /apple-icon is the dynamic PNG route for richer surfaces.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "savemyhands",
    short_name: "savemyhands",
    description: "Live poker hand recorder and replayer.",
    start_url: "/",
    display: "standalone",
    background_color: "#171717",
    theme_color: "#171717",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
