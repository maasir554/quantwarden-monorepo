import DashboardShell from "../components/DashboardShell";
import AssetInventory from "../components/AssetInventory";

export default function AssetInventoryPage() {
  return (
    <DashboardShell title="Asset Inventory">
      <AssetInventory />
    </DashboardShell>
  );
}
