import type { MetadataRoute } from "next";

// Crawler rules. Public surfaces (marketing landing, auth pages, public
// hand replays) are allow-listed. Auth-gated routes get disallowed so
// search engines don't try to index login walls or empty dashboards.
// `/auth/callback` is the OAuth return path — never useful to index.
//
// `metadataBase` in app/layout.tsx is the source of truth for the host;
// keep them in sync.
const HOST = "https://savemyhands.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/signup", "/hand/"],
        disallow: ["/dashboard", "/record", "/settings", "/auth/"],
      },
    ],
    sitemap: `${HOST}/sitemap.xml`,
    host: HOST,
  };
}
