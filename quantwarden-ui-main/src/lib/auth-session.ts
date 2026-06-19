import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function getSafeServerSession() {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch (error) {
    console.error("Failed to get session", error);
    return null;
  }
}
