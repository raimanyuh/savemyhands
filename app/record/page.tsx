import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PokerTable from "@/components/poker/PokerTable";

export default async function RecordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-base font-semibold tracking-tight text-foreground">
          Record Hand
        </h1>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Dashboard
        </Link>
      </header>
      <main className="flex-1 flex flex-col items-center justify-start px-6 py-10">
        <PokerTable />
      </main>
    </div>
  );
}
