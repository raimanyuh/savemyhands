import type { Metadata } from "next";

// See login/layout.tsx for why this exists as a pass-through.
export const metadata: Metadata = { title: "Sign up" };

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
