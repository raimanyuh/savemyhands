import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Recorder from "@/components/poker/Recorder";

export default async function RecordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <Recorder />;
}
