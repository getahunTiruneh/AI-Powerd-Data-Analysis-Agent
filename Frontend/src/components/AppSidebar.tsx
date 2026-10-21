import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  MessageSquare,
  History,
  LayoutDashboard,
  Users,
  Database,
  BarChart3,
  Shield,
  ChevronDown,
  UserCog,
  Bell,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const XYZ_BANK_LOGO = "/xyz-bank-logo.svg";

const businessItems = [
  { title: "AI Chat", url: "/chat", icon: MessageSquare },
  { title: "Chat History", url: "/history", icon: History },
  { title: "Notifications", url: "/notifications", icon: Bell },
];

const adminItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "User Management", url: "/admin/users", icon: Users, hasSubmenu: true },
  { title: "Data Marts", url: "/admin/datamarts", icon: Database },
  { title: "Audit Logs", url: "/admin/audit-logs", icon: Shield },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
];

const userManagementSubmenu = [
  { title: "All Users", url: "/admin/users", icon: Users },
  { title: "Assign Data Marts", url: "/admin/assignments", icon: UserCog },
];

const SIDEBAR_COLOR = "#0D2238";
const ICON_WIDTH = "w-12";

const navLinkBase = "flex items-center w-full rounded-lg transition-all duration-200 no-underline whitespace-nowrap";
const navLinkActive = "bg-[#0F766E] text-white";
const navLinkInactive = "text-white/80 hover:bg-white/10 hover:text-white";

export function AppSidebar() {
  const { user } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

  const toggleSubmenu = (key: string) => {
    setOpenSubmenus(prev => ({ [key]: !prev[key] }));
  };

  const textTransition = "transition-all duration-200 ease-in-out";
  const labelHidden = "opacity-0 translate-x-3 w-0";
  const labelVisible = "opacity-100 translate-x-0 w-auto";

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r-0"
      style={{ "--sidebar-width-icon": "4rem", backgroundColor: `${SIDEBAR_COLOR} !important` } as any}
    >
      <SidebarContent 
        style={{ backgroundColor: SIDEBAR_COLOR }} 
        className="overflow-x-hidden"
      >
        {/* Logo & Branding */}
        <div className={cn(
          "flex flex-col items-center transition-all duration-300 ease-in-out overflow-hidden",
          collapsed ? "py-4" : "py-6 mb-2"
        )}>
          <div className={cn(
            "flex shrink-0 items-center justify-center transition-all duration-500",
            collapsed ? "h-8 w-8" : "h-12 w-12"
          )}>
            <img 
              src={XYZ_BANK_LOGO}
              alt="XYZ Bank"
              className="h-full w-full object-contain block drop-shadow-xl"
            />
          </div>
          <div className={cn(
            "flex flex-col items-center text-center overflow-hidden transition-all duration-300",
            collapsed
              ? "opacity-0 scale-75 translate-y-[-8px] max-h-0 mt-0"
              : "opacity-100 scale-100 translate-y-0 max-h-12 mt-2"
          )}>
            <span className="text-xs font-bold text-white whitespace-nowrap tracking-tight">
              XYZ Bank
            </span>
            <span className="text-[8px] font-black text-[#5EEAD4] uppercase tracking-[0.2em] mt-0.5">
              Data Insight Agent
            </span>
          </div>
        </div>

        {/* Workspace Group */}
        <SidebarGroup className={cn(collapsed && "!p-1")}>
          <SidebarGroupLabel className={cn(
            "text-white/40 text-[10px] font-bold uppercase tracking-widest px-2 mb-1 overflow-hidden transition-all duration-200",
            collapsed ? "opacity-0 max-h-16" : "opacity-100 max-h-8"
          )}>
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent className={cn(collapsed ? "px-1" : "px-2")}>
            <div className={cn("flex flex-col", collapsed ? "gap-2" : "gap-0.5")}>
              {businessItems.map((item) => (
                <NavLink 
                  key={item.title} 
                  to={item.url} 
                  className={({ isActive }) => cn(
                    navLinkBase,
                    isActive ? navLinkActive : navLinkInactive
                  )}
                >
                  <div className={cn(ICON_WIDTH, "flex items-center justify-center shrink-0 h-10")}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className={cn(
                    "text-sm font-medium overflow-hidden",
                    textTransition,
                    collapsed ? labelHidden : labelVisible
                  )}>
                    {item.title}
                  </span>
                </NavLink>
              ))}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Divider between groups when collapsed */}
        <div className={cn(
          "transition-all duration-200 overflow-hidden",
          collapsed ? "opacity-100 max-h-8 px-3" : "opacity-0 max-h-0"
        )}>
          <div className="border-t border-white/10" />
        </div>

        {/* Administration Group */}
        {user?.role === "admin" && (
          <SidebarGroup className={cn(collapsed ? "!p-1" : "mt-2")}>
            <SidebarGroupLabel className={cn(
              "text-white/40 text-[10px] font-bold uppercase tracking-widest px-2 mb-1 flex items-center gap-1 overflow-hidden transition-all duration-200",
              collapsed ? "opacity-0 max-h-16" : "opacity-100 max-h-8"
            )}>
              <Shield className="h-3 w-3" /> Administration
            </SidebarGroupLabel>
            <SidebarGroupContent className={cn(collapsed ? "px-1" : "px-2")}>
              <div className={cn("flex flex-col", collapsed ? "gap-2" : "gap-0.5")}>
                {adminItems.map((item) => (
                  <div key={item.title} className="w-full">
                    {item.hasSubmenu && !collapsed ? (
                      <div className="w-full">
                        <button
                          onClick={() => toggleSubmenu(item.title)}
                          className="flex items-center justify-between w-full rounded-lg text-white/80 hover:bg-white/10 transition-all"
                        >
                          <div className={cn(navLinkBase, "flex-1", navLinkInactive)}>
                            <div className={cn(ICON_WIDTH, "flex items-center justify-center shrink-0 h-10")}>
                              <item.icon className="h-5 w-5" />
                            </div>
                            <span className={cn("text-sm font-medium", textTransition, labelVisible)}>
                              {item.title}
                            </span>
                          </div>
                          <ChevronDown className={cn(
                            "h-4 w-4 mr-3 transition-transform shrink-0",
                            openSubmenus[item.title] && "rotate-180"
                          )} />
                        </button>
                        <div className={cn(
                          "overflow-hidden transition-all duration-200",
                          openSubmenus[item.title] ? "max-h-40" : "max-h-0"
                        )}>
                          <div className="ml-4 flex flex-col gap-0.5 border-l border-white/20 py-1">
                            {userManagementSubmenu.map((sub) => (
                              <NavLink 
                                key={sub.title} 
                                to={sub.url} 
                                className={({ isActive }) => cn(
                                  navLinkBase,
                                  isActive ? navLinkActive : navLinkInactive
                                )}
                              >
                                <div className={cn(ICON_WIDTH, "flex items-center justify-center shrink-0 h-9")}>
                                  <sub.icon className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-medium">{sub.title}</span>
                              </NavLink>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <NavLink 
                        to={item.url} 
                        end={item.url === "/admin"}
                        className={({ isActive }) => cn(
                          navLinkBase,
                          isActive ? navLinkActive : navLinkInactive
                        )}
                      >
                        <div className={cn(ICON_WIDTH, "flex items-center justify-center shrink-0 h-10")}>
                          <item.icon className="h-5 w-5" />
                        </div>
                        <span className={cn(
                          "text-sm font-medium overflow-hidden",
                          textTransition,
                          collapsed ? labelHidden : labelVisible
                        )}>
                          {item.title}
                        </span>
                      </NavLink>
                    )}
                  </div>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
