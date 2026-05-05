import type { Metadata } from "next";

// Layout wrapper exists only to host the metadata export — the page
// itself is a client component (`useActionState` for the form), and
// Next forbids `metadata` exports on client modules. Keeping this as a
// pass-through layout puts the title under the root template.
export const metadata: Metadata = { title: "Sign in" };

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
