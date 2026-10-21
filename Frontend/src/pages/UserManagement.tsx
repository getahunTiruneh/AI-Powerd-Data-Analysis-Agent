import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, MoreVertical, Shield, CheckCircle2, XCircle, Clock, Database, Eye, AlertTriangle, Info } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useProfiles, useUpdateProfileStatus, useAssignments } from "@/hooks/useApiData";
import { useNavigate } from "react-router-dom";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
  icon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = ({ open, title, description, confirmLabel, confirmVariant = "default", icon, onConfirm, onCancel }: ConfirmDialogProps) => (
  <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${confirmVariant === "destructive" ? "bg-destructive/10" : "bg-primary/10"}`}>
            {icon || (confirmVariant === "destructive" ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <Info className="h-5 w-5 text-primary" />)}
          </div>
          <DialogTitle>{title}</DialogTitle>
        </div>
        <DialogDescription className="pt-2">{description}</DialogDescription>
      </DialogHeader>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const statusConfig = {
  active: { label: "Active", icon: CheckCircle2, className: "text-chart-green bg-chart-green/10" },
  pending: { label: "Pending", icon: Clock, className: "text-accent bg-accent/10" },
  suspended: { label: "Suspended", icon: XCircle, className: "text-chart-red bg-chart-red/10" },
};

const UserManagement = () => {
  const { data: users = [] } = useProfiles();
  const { data: allAssignments = [] } = useAssignments();
  const updateStatus = useUpdateProfileStatus();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    confirmVariant?: "default" | "destructive";
    icon?: React.ReactNode;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", confirmLabel: "", onConfirm: () => {} });

  const pendingUsers = users.filter((u: any) => u.status === "pending");

  const filtered = users.filter((u: any) => {
    const matchSearch = u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || u.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const showConfirm = (config: Omit<typeof confirmDialog, "open">) => {
    setConfirmDialog({ ...config, open: true });
  };

  const handleApprove = (user: any) => {
    showConfirm({
      title: "Approve User Access",
      description: `Are you sure you want to approve access for ${user.name} (${user.email})? They will be able to log in and use the platform.`,
      confirmLabel: "Approve",
      confirmVariant: "default",
      icon: <CheckCircle2 className="h-5 w-5 text-chart-green" />,
      onConfirm: () => {
        updateStatus.mutate({ userId: user.id, status: "active" }, {
          onSuccess: () => setConfirmDialog(prev => ({ ...prev, open: false })),
          onError: () => setConfirmDialog(prev => ({ ...prev, open: false }))
        });
      }
    });
  };

  const handleReject = (user: any) => {
    showConfirm({
      title: "Reject User Access",
      description: `Are you sure you want to reject access for ${user.name}? Their account will be suspended.`,
      confirmLabel: "Reject",
      confirmVariant: "destructive",
      icon: <XCircle className="h-5 w-5 text-destructive" />,
      onConfirm: () => {
        updateStatus.mutate({ userId: user.id, status: "suspended" }, {
          onSuccess: () => setConfirmDialog(prev => ({ ...prev, open: false })),
          onError: () => setConfirmDialog(prev => ({ ...prev, open: false }))
        });
      }
    });
  };

  const handleSuspend = (user: any) => {
    showConfirm({
      title: "Suspend User",
      description: `Are you sure you want to suspend ${user.name}'s account?`,
      confirmLabel: "Suspend",
      confirmVariant: "destructive",
      icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
      onConfirm: () => {
        updateStatus.mutate({ userId: user.id, status: "suspended" }, {
          onSuccess: () => setConfirmDialog(prev => ({ ...prev, open: false })),
          onError: () => setConfirmDialog(prev => ({ ...prev, open: false }))
        });
      }
    });
  };

  const handleReactivate = (user: any) => {
    showConfirm({
      title: "Reactivate User",
      description: `Are you sure you want to reactivate ${user.name}'s account?`,
      confirmLabel: "Reactivate",
      confirmVariant: "default",
      icon: <CheckCircle2 className="h-5 w-5 text-chart-green" />,
      onConfirm: () => {
        updateStatus.mutate({ userId: user.id, status: "active" }, {
          onSuccess: () => setConfirmDialog(prev => ({ ...prev, open: false })),
          onError: () => setConfirmDialog(prev => ({ ...prev, open: false }))
        });
      }
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary/100">User Management</h1>
          <p className="text-muted-foreground text-sm">Manage platform users and access</p>
        </div>
        {pendingUsers.length > 0 && (
          <Badge className="gradient-gold border-0 text-accent-foreground">
            {pendingUsers.length} Pending Request{pendingUsers.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          {["all", "active", "pending", "suspended"].map((s) => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" className="capitalize text-xs" onClick={() => setStatusFilter(s)}>{s}</Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">User</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Role</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Department</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Data Marts</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user: any, i: number) => {
                  const statusKey = (user.status || "pending") as keyof typeof statusConfig;
                  const status = statusConfig[statusKey] || statusConfig.pending;
                  const StatusIcon = status.icon;
                  const userAssignments = allAssignments.filter((a: any) => a.user_id === user.id);
                  return (
                    <motion.tr key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/admin/users/${user.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full gradient-primary text-xs font-bold text-primary-foreground">
                            {(user.name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {user.role === "admin" && <Shield className="h-3 w-3 mr-1" />}
                          {user.role === "admin" ? "Admin" : "Business User"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{user.dept || "—"}</td>
                      <td className="px-4 py-3 text-sm font-medium">{userAssignments.length}</td>
                      <td className="px-4 py-3">
                        <Badge className={`${status.className} border-0 text-xs`}><StatusIcon className="h-3 w-3 mr-1" />{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/users/${user.id}`); }}>
                              <Eye className="h-3.5 w-3.5 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/assignments?user=${user.id}`); }}>
                              <Database className="h-3.5 w-3.5 mr-2" /> Manage Data Marts
                            </DropdownMenuItem>
                            {user.status === "pending" && (
                              <>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleApprove(user); }}>
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-chart-green" /> Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleReject(user); }} className="text-destructive">
                                  <XCircle className="h-3.5 w-3.5 mr-2" /> Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            {user.status === "active" && user.role !== "admin" && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleSuspend(user); }} className="text-destructive">
                                <AlertTriangle className="h-3.5 w-3.5 mr-2" /> Suspend User
                              </DropdownMenuItem>
                            )}
                            {user.status === "suspended" && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleReactivate(user); }}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-chart-green" /> Reactivate User
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        confirmVariant={confirmDialog.confirmVariant}
        icon={confirmDialog.icon}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
};

export default UserManagement;
