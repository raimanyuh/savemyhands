import type { MetadataRoute } from "next";
import { listPublicHandIds } from "@/lib/hands/db";

// Search-engine sitemap. Static surfaces + every public hand replay.
// The hand pages are the viral surface — without listing them here, Google
// only finds them via inbound links (chat unfurls, social shares), which
// indexes slowly. Listing them explicitly puts the long tail of public
// hands into the index.
//
// Soft cap: Google accepts up to 50,000 URLs per sitemap. If we ever hit
// that, switch to the `generateSitemaps` route-segment pattern.
//
// Static-host source of truth lives in app/layout.tsx (metadataBase).
const HOST = "https://savemyhands.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: `${HOST}/`,
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${HOST}/login`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${HOST}/signup`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${HOST}/hand/sample`,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];

  // RLS limits anonymous SELECT to is_public hands; the helper adds the
  // explicit filter for query-plan determinism.
  const publicHands = await listPublicHandIds();
  const handUrls: MetadataRoute.Sitemap = publicHands.map((h) => ({
    url: `${HOST}/hand/${h.id}`,
    lastModified: h.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticUrls, ...handUrls];
}
