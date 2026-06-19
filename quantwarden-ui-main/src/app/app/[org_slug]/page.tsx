import { redirect } from "next/navigation";

export default async function OrganizationPage(props: { params: Promise<{ org_slug: string }> }) {
  const { org_slug } = await props.params;
  redirect(`/app/${org_slug}/overview`);
}
