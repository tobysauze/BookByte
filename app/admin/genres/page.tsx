import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isEditor } from "@/lib/user-roles";
import { AdminGenresClient } from "@/components/admin-genres-client";

export default async function AdminGenresPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const editorCheck = await isEditor();
  if (!editorCheck) redirect("/");

  return <AdminGenresClient />;
}
