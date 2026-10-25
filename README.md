This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Stud release flags

`ENABLE_STUD_HIGH=true` enables Seven-Card Stud High on the server, including
desktop/mobile recorder entry points, dashboard filters, replay routes and
social previews. `ENABLE_RAZZ=true` independently enables the complete Razz
recorder/replayer, dashboard filters and social previews. Both default off.
Stud/8 remains unavailable. Set each flag only after verifying that format
in the target environment; local QA flags do not enable a deployed release.

New Stud recordings deal an individual seventh downcard to each live seat.
The recorder assumes the dealer can supply those cards and does not infer
deck exhaustion or simulate reshuffles from anonymous card counts. Known
card identities still cannot be duplicated. Previously saved shared-seventh
histories retain their original replay and payouts for compatibility.

Apply `supabase/migrations/0005_fractional_hand_results.sql` before enabling
Stud in an environment. It widens `hands.result` to `numeric` for fractional
antes and split awards while retaining ownership policies and private defaults.
Set the flag in the server environment, then restart/redeploy that environment.

Before release, verify signed-in save → dashboard → reload → replay for
Single Draw, Triple Draw and Stud, including a fractional Stud result. Confirm
new hands are private, anonymous private URLs show the not-found page without
hand data, public URLs replay without a session, and making the test hand
private again removes anonymous
access. Check game filters on desktop and mobile. Run `npm test`,
`npx tsc --noEmit --incremental false`, `npm run lint` and `npm run build`.

The existing hand loading boundary streams responses: Next.js can return
HTTP 200 for a not-found page after streaming starts. Check the not-found UI,
`noindex`, absence of hand data, and an empty anonymous database query as well
as the status code when verifying privacy.
