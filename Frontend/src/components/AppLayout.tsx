import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Search, Wifi, WifiOff, User, Settings, LogOut, ChevronDown } from "lucide-react";
import { ReactNode, useState, useEffect } from "react";
import { apiFetch } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<{ host: string; database: string } | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const checkConnectionStatus = async () => {
    try {
      const { data } = await apiFetch("/admin/data-marts/connection/status");
      setIsDbConnected(data?.connected || false);
      setConnectionInfo(data?.config || null);
    } catch {
      setIsDbConnected(false);
      setConnectionInfo(null);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data } = await apiFetch("/notifications");
      const notifications = data?.data || [];
      setNotifications(notifications);
      setUnreadCount(notifications.filter((n: Notification) => !n.is_read).length);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  useEffect(() => {
    checkConnectionStatus();
    fetchNotifications();
    
    const connectionInterval = setInterval(checkConnectionStatus, 30000);
    const notificationInterval = setInterval(fetchNotifications, 60000);
    
    return () => {
      clearInterval(connectionInterval);
      clearInterval(notificationInterval);
    };
  }, []);

  const handleDisconnect = async () => {
    if (!isDbConnected) return;
    
    setShowDisconnectDialog(false);
    setIsDisconnecting(true);
    try {
      const { error } = await apiFetch("/admin/data-marts/connection", { method: "DELETE" });
      if (error) throw new Error(error);
      setIsDbConnected(false);
      setConnectionInfo(null);
      toast.success("Disconnected from external database");
    } catch (err: any) {
      toast.error(err.message || "Failed to disconnect");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const markAsRead = async (notification: Notification) => {
    if (notification.is_read) return;
    
    try {
      await apiFetch(`/notifications/${notification.id}/read`, { method: "PATCH" });
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      if (notification.link) {
        navigate(notification.link);
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/notifications/${id}`, { method: "DELETE" });
      const notification = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'user_registration':
        return '👤';
      case 'account_status':
        return '🔔';
      case 'promotion':
        return '🎉';
      case 'data_mart':
        return '📊';
      case 'system':
        return '⚙️';
      default:
        return '📢';
    }
  };

  return (
    <>
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col">
        <header className="h-14 flex items-center justify-between border-b bg-card px-4 shrink-0">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="hidden md:flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search queries, data marts..."
                className="bg-transparent text-sm outline-none placeholder:text-muted-foreground w-64"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* WiFi Connection Status */}
            <Tooltip>
                <TooltipTrigger asChild>
                  {isDbConnected ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowDisconnectDialog(true)}
                      disabled={isDisconnecting}
                      className="relative text-chart-green hover:text-chart-green"
                    >
                      <Wifi className="h-4 w-4" />
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-chart-green animate-pulse" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-chart-red"
                    >
                      <WifiOff className="h-4 w-4" />
                    </Button>
                  )}
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isDbConnected ? (
                    <div className="text-center">
                      <p className="font-medium text-chart-green">Connected</p>
                      <p className="text-xs text-muted-foreground">{connectionInfo?.host}/{connectionInfo?.database}</p>
                      <p className="text-xs text-chart-green mt-1">Click to disconnect</p>
                    </div>
                  ) : (
                    <p className="text-chart-red">No External Database Connected</p>
                  )}
                </TooltipContent>
              </Tooltip>

              {/* Notifications */}
              <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] gradient-gold border-0">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold">Notifications</h3>
                    {unreadCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-auto py-1 px-2">
                        Mark all read
                      </Button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No notifications</p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => markAsRead(notification)}
                          className={`flex items-start gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                            !notification.is_read ? 'bg-primary/5' : ''
                          }`}
                        >
                          <span className="text-xl shrink-0">{getNotificationIcon(notification.type)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-sm truncate ${!notification.is_read ? 'font-medium' : ''}`}>
                                {notification.title}
                              </p>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                                onClick={(e) => deleteNotification(notification.id, e)}
                              >
                                <span className="sr-only">Delete</span>
                                ✕
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                            <p className="text-xs text-muted-foreground/50 mt-1">
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          {!notification.is_read && (
                            <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 h-9 px-2 text-muted-foreground hover:text-foreground">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full gradient-gold text-xs font-bold text-accent-foreground">
                      {user?.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                    </div>
                    <span className="hidden md:inline text-sm font-medium">{user?.name}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 border-b">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={async () => { await logout(); navigate("/"); }} 
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <div className="flex-1 overflow-hidden">{children}</div>
        </SidebarInset>
    </SidebarProvider>
    <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect Database</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to disconnect from <strong>{connectionInfo?.host}/{connectionInfo?.database}</strong>?
            All data mart queries will stop working until you reconnect.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDisconnect} disabled={isDisconnecting}>
            Disconnect
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
