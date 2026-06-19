import { redirect } from "next/navigation";

export default function LegacySignInRedirect() {
  redirect("/login");
}
