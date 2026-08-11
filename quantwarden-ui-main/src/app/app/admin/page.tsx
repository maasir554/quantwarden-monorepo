import { redirect } from "next/navigation";
import { getSuperAdminAuth } from "@/lib/super-admin";
import AdminConsole from "./admin-console";

export default async function SuperAdminPage() {
  const admin = await getSuperAdminAuth();
  if (!admin.ok) redirect("/app");
  return <AdminConsole />;
}
