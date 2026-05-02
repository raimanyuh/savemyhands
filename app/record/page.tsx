import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RecorderShell from "@/components/poker/RecorderShell";

export default async function RecordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <RecorderShell />;
}
