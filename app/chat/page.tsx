import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ChatClient } from "@/components/chat-client";

export default async function ChatPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <ChatClient />;
}
