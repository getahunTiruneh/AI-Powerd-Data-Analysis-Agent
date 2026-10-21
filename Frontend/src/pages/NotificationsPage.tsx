import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/hooks/useApi";
import { Bell, CheckCheck, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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

const typeIcons: Record<string, string> = {
  user_registration: "👤",
  account_status: "🔔",
  promotion: "🎉",
  data_mart: "📊",
  system: "⚙️",
};

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const { data } = await apiFetch("/notifications");
      setNotifications(data?.data || []);
    } catch {
      toast.error("Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (notification: Notification) => {
    if (notification.is_read) return;
    try {
      await apiFetch(`/notifications/${notification.id}/read`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      if (notification.link) navigate(notification.link);
    } catch {
      toast.error("Failed to mark as read");
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}`, { method: "DELETE" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success("Notification deleted");
    } catch {
      toast.error("Failed to delete notification");
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground text-sm">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchNotifications}>
            <Loader2 className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-lg font-medium mb-1">No notifications</p>
            <p className="text-sm text-muted-foreground">
              You're all caught up!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`cursor-pointer transition-all hover:border-primary/30 ${
                !notification.is_read
                  ? "border-l-4 border-l-primary bg-primary/5"
                  : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">
                    {typeIcons[notification.type] || "📢"}
                  </span>
                  <div
                    className="flex-1 min-w-0"
                    onClick={() => markAsRead(notification)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className={`text-sm ${
                            !notification.is_read
                              ? "font-semibold"
                              : "font-medium"
                          }`}
                        >
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground/70 shrink-0 whitespace-nowrap">
                        {formatDistanceToNow(
                          new Date(notification.created_at),
                          { addSuffix: true }
                        )}
                      </span>
                    </div>
                    {notification.link && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                        <ExternalLink className="h-3 w-3" />
                        <span>Navigate to page</span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteNotification(notification.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
