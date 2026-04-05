import { useAuth } from "@/hooks/useAuth";
import SalesDashboard from "@/components/dashboards/SalesDashboard";
import SupportManagerDashboard from "@/components/dashboards/SupportManagerDashboard";
import EngineerDashboard from "@/components/dashboards/EngineerDashboard";
import CEODashboard from "@/components/dashboards/CEODashboard";
import PMDashboard from "@/components/dashboards/PMDashboard";

export default function Dashboard() {
  const { isProjectManager, isSales, isSalesManager, isSupportManager, isEngineer, isCEO, isAdminManager, isAccountsManager } = useAuth();

  // Priority order: PM > CEO > Support Manager > Sales/Sales Manager > Engineer > fallback PM
  if (isProjectManager) return <PMDashboard />;
  if (isCEO) return <CEODashboard />;
  if (isSupportManager) return <SupportManagerDashboard />;
  if (isSales || isSalesManager) return <SalesDashboard />;
  if (isEngineer) return <EngineerDashboard />;
  if (isAdminManager || isAccountsManager) return <PMDashboard />;

  return <PMDashboard />;
}
