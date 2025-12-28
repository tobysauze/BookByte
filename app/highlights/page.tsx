import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { HighlightsClient } from "@/components/highlights-client";

export default async function HighlightsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return <HighlightsClient />;
}

