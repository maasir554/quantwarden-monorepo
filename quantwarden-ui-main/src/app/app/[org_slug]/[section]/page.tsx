import { notFound } from "next/navigation";
import { isDashboardSection } from "../_components/dashboard-sections";
import { renderOrganizationPage } from "../_components/renderOrganizationPage";

export default async function OrganizationSectionPage(props: {
  params: Promise<{ org_slug: string; section: string }>;
}) {
  const { org_slug, section } = await props.params;

  if (!isDashboardSection(section)) {
    notFound();
  }

  return renderOrganizationPage(org_slug, section);
}
