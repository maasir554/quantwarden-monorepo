import DashboardShell from "../components/DashboardShell";
import Overview from "../components/Overview";


export default function DashboardPage() {
  return (
    <DashboardShell title="QuantWarden Security Overview">
      <Overview />
    </DashboardShell>
  );
}