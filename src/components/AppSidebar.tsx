import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  ClipboardList,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function AppSidebar() {
  const { signOut, user, isProjectManager, isEngineer } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, visible: true },
    { to: "/projects", label: "Projects", icon: FolderKanban, visible: true },
    { to: "/engineers", label: "Engineers", icon: Users, visible: isProjectManager },
    { to: "/updates", label: "Daily Updates", icon: ClipboardList, visible: isProjectManager || isEngineer },
    { to: "/documents", label: "Documents", icon: FileText, visible: true },
    { to: "/users", label: "Users", icon: UserCog, visible: isProjectManager },
    { to: "/settings", label: "Settings", icon: Settings, visible: isProjectManager },
  ];

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <LayoutDashboard className="h-4 w-4" />
            </div>
            <span className="text-base font-bold text-sidebar-primary-foreground">ProjectHub</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-md p-1 hover:bg-sidebar-accent"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.filter(item => item.visible).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User & Logout */}
      <div className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="mb-2 truncate text-xs text-sidebar-foreground/60">
            {user?.email}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && "Sign Out"}
        </Button>
      </div>
    </aside>
  );
}
