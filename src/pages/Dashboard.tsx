import { useAuth } from "@/hooks/useAuth";
import SalesDashboard from "@/components/dashboards/SalesDashboard";
import SupportManagerDashboard from "@/components/dashboards/SupportManagerDashboard";
import EngineerDashboard from "@/components/dashboards/EngineerDashboard";
import CEODashboard from "@/components/dashboards/CEODashboard";
import PMDashboard from "@/components/dashboards/PMDashboard";
import EngineeringManagerDashboard from "@/components/dashboards/EngineeringManagerDashboard";

export default function Dashboard() {
  const { isProjectManager, isSales, isSalesManager, isSupportManager, isSupportEngineer, isEngineering, isCEO, isAdminManager, isAccountsManager, isEngineeringManager } = useAuth();

  if (isProjectManager) return <PMDashboard />;
  if (isCEO) return <CEODashboard />;
  if (isEngineeringManager) return <EngineeringManagerDashboard />;
  if (isSupportManager) return <SupportManagerDashboard />;
  if (isSales || isSalesManager) return <SalesDashboard />;
  if (isSupportEngineer || isEngineering) return <EngineerDashboard />;
  if (isAdminManager || isAccountsManager) return <PMDashboard />;

  return <PMDashboard />;
}
