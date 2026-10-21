import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Trash2, CheckCircle2, XCircle, Users, Database, RefreshCw, Download, X, ChevronDown, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useProfiles, useDataMartList, useAllAssignments, useAssignDataMart, useUnassignDataMart } from "@/hooks/useApiData";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface InfoDialogProps {
  open: boolean;
  title: string;
  message: string;
  variant?: "error" | "warning" | "success" | "info";
  onClose: () => void;
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = ({ open, title, message, onConfirm, onCancel }: ConfirmDialogProps) => (
  <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-destructive">
          <XCircle className="h-5 w-5" /> {title}
        </DialogTitle>
        <DialogDescription>{message}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant="destructive" onClick={onConfirm}>Remove</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const InfoDialog = ({ open, title, message, variant = "info", onClose }: InfoDialogProps) => {
  const variantConfig = {
    error: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
    warning: { icon: XCircle, color: "text-chart-yellow", bg: "bg-chart-yellow/10" },
    success: { icon: CheckCircle2, color: "text-chart-green", bg: "bg-chart-green/10" },
    info: { icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10" },
  };
  const config = variantConfig[variant];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className={config.color}>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface NewAssignment {
  id: string;
  userId: string;
  dataMartId: string;
}

const DataMartAssignment = () => {
  const { data: users = [], refetch: refetchUsers } = useProfiles();
  const { data: dataMarts = [], refetch: refetchMarts } = useDataMartList();
  const { data: allAssignments = [], refetch: refetchAssignments } = useAllAssignments();
  const assignMart = useAssignDataMart();
  const unassignMart = useUnassignDataMart();

  const [search, setSearch] = useState("");
  const [infoDialog, setInfoDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant?: "error" | "warning" | "success" | "info";
  }>({ open: false, title: "", message: "", variant: "info" });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: (() => void) | null;
  }>({ open: false, title: "", message: "", action: null });
  const [newAssignments, setNewAssignments] = useState<NewAssignment[]>([]);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [removingMart, setRemovingMart] = useState<string | null>(null);

  const businessUsers = users.filter((u: any) => u.role !== "admin" && u.status === "active");

  const filteredAssignments = allAssignments.filter((a: any) => {
    const user = users.find((u: any) => u.id === a.user_id);
    const mart = dataMarts.find((m: any) => m.id === a.data_mart_id);
    const searchLower = search.toLowerCase();
    return (
      user?.name?.toLowerCase().includes(searchLower) ||
      user?.email?.toLowerCase().includes(searchLower) ||
      mart?.name?.toLowerCase().includes(searchLower)
    );
  });

  const groupedAssignments = filteredAssignments.reduce((acc: Record<string, any[]>, assignment: any) => {
    const userId = assignment.user_id;
    if (!acc[userId]) acc[userId] = [];
    acc[userId].push(assignment);
    return acc;
  }, {});

  const groupedList = Object.entries(groupedAssignments).map(([userId, assignments]) => {
    const user = users.find((u: any) => u.id === userId);
    return { userId, user, assignments };
  });

  const toggleExpand = (userId: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const showInfo = (config: Omit<typeof infoDialog, "open">) => setInfoDialog({ ...config, open: true });

  const handleUnassignSingle = (userId: string, dataMartId: string, userName: string, martName: string) => {
    const key = `${userId}-${dataMartId}`;
    if (removingMart === key) return;
    setRemovingMart(key);
    setConfirmDialog({
      open: true,
      title: "Remove Assignment",
      message: `Remove "${martName}" access from ${userName}? They will no longer be able to query this data mart.`,
      action: () => {
        unassignMart.mutate({ userId, dataMartId }, {
          onSettled: () => setRemovingMart(null),
          onSuccess: () => {
            setConfirmDialog(prev => ({ ...prev, open: false, action: null }));
            refetchAssignments();
            toast.success(`"${martName}" removed from ${userName}`);
          },
          onError: () => {
            setConfirmDialog(prev => ({ ...prev, open: false, action: null }));
            toast.error("Failed to remove assignment");
          }
        });
      }
    });
  };

  const handleUnassignAll = (userId: string, userName: string, marts: any[]) => {
    const martNames = marts.map((m: any) => m.name).join(", ");
    setConfirmDialog({
      open: true,
      title: "Remove All Assignments",
      message: `Remove ALL data mart access (${martNames}) from ${userName}? This action cannot be undone.`,
      action: () => {
        let completed = 0;
        const total = marts.length;
        marts.forEach((mart: any) => {
          unassignMart.mutate({ userId, dataMartId: mart.id }, {
            onSettled: () => {
              completed++;
              if (completed === total) {
                setConfirmDialog(prev => ({ ...prev, open: false, action: null }));
                refetchAssignments();
                toast.success(`All assignments removed from ${userName}`);
              }
            }
          });
        });
      }
    });
  };

  const getUserAssignedMarts = (userId: string) => allAssignments.filter((a: any) => a.user_id === userId);

  const addNewAssignmentRow = () => {
    setNewAssignments(prev => [...prev, { id: `new-${Date.now()}`, userId: "", dataMartId: "" }]);
  };

  const updateNewAssignment = (id: string, field: keyof NewAssignment, value: string) => {
    setNewAssignments(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const removeNewAssignmentRow = (id: string) => {
    setNewAssignments(prev => prev.filter(a => a.id !== id));
  };

  const handleAssign = (assignment: NewAssignment) => {
    if (!assignment.userId || !assignment.dataMartId) {
      showInfo({ title: "Missing Information", message: "Please select both a user and a data mart.", variant: "warning" });
      return;
    }
    const user = businessUsers.find((u: any) => u.id === assignment.userId);
    const mart = dataMarts.find((m: any) => m.id === assignment.dataMartId);
    assignMart.mutate({ userId: assignment.userId, dataMartId: assignment.dataMartId }, {
      onSuccess: () => {
        setNewAssignments(prev => prev.filter(a => a.id !== assignment.id));
        refetchAssignments();
        showInfo({ title: "Assignment Created", message: `${user?.name} has been assigned to ${mart?.name}.`, variant: "success" });
      },
      onError: () => showInfo({ title: "Assignment Failed", message: "Failed to create assignment.", variant: "error" })
    });
  };

  const handleAssignAllNew = () => {
    const valid = newAssignments.filter(a => a.userId && a.dataMartId);
    if (valid.length === 0) {
      showInfo({ title: "No Valid Assignments", message: "Please fill in all required fields.", variant: "warning" });
      return;
    }
    let successCount = 0;
    valid.forEach(assignment => {
      assignMart.mutate({ userId: assignment.userId, dataMartId: assignment.dataMartId }, {
        onSuccess: () => { successCount++; refetchAssignments(); },
        onError: () => { }
      });
    });
    setNewAssignments([]);
    showInfo({ title: "Assignments Created", message: `${successCount} assignment(s) created successfully.`, variant: "success" });
  };

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary/100">Data Mart Assignment</h1>
            <p className="text-muted-foreground text-sm">Assign and manage data mart access for users</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { refetchUsers(); refetchMarts(); refetchAssignments(); }}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Business Users Card */}
          <Card className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-xl border-l-4 border-l-purple-600">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-3">
                <p className="text-lg font-bold text-slate-600 dark:text-slate-400">
                  Business Users
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-50">
                    {businessUsers.length}
                  </span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    User Count
                  </span>
                </div>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-purple-100/70 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                <Users className="h-6 w-6 stroke-[2]" />
              </div>
            </CardContent>
          </Card>

          {/* Data Marts Card */}
          <Card className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-xl border-l-4 border-l-amber-500">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-3">
                <p className="text-lg font-bold text-slate-600 dark:text-slate-400">
                  Data Marts
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-50">
                    {dataMarts.length}
                  </span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Connection Counts
                  </span>
                </div>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-amber-100/70 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Database className="h-6 w-6 stroke-[2]" />
              </div>
            </CardContent>
          </Card>

          {/* Active Assignments Card */}
          <Card className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-xl border-l-4 border-l-emerald-600">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-3">
                <p className="text-lg font-bold text-slate-600 dark:text-slate-400">
                  Active Assignments
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-50">
                    {allAssignments.length}
                  </span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Current Links
                  </span>
                </div>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6 stroke-[2]" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* New Assignment Section */}
        <Card className={newAssignments.length > 0 ? "border-primary/50 bg-primary/5" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                New Assignments
                {newAssignments.length > 0 && <Badge variant="default" className="ml-2">{newAssignments.length}</Badge>}
              </CardTitle>
              {newAssignments.length > 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setNewAssignments([])}>Cancel All</Button>
                  <Button size="sm" className="gradient-primary border-0 text-primary-foreground" onClick={handleAssignAllNew}>
                    Assign All ({newAssignments.length})
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {newAssignments.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">Click the button below to add new assignments</p>
                <Button onClick={addNewAssignmentRow}>
                  <Plus className="h-4 w-4 mr-2" /> Add Assignment Row
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12 font-semibold">#</TableHead>
                      <TableHead className="font-semibold">User</TableHead>
                      <TableHead className="font-semibold">Data Mart</TableHead>
                      <TableHead className="w-32 text-center font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newAssignments.map((assignment, index) => {
                      const isAlreadyAssigned = assignment.userId && assignment.dataMartId &&
                        getUserAssignedMarts(assignment.userId).some((a: any) => a.data_mart_id === assignment.dataMartId);
                      return (
                        <TableRow key={assignment.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>
                            <select
                              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              value={assignment.userId}
                              onChange={(e) => updateNewAssignment(assignment.id, "userId", e.target.value)}
                            >
                              <option value="">Select User</option>
                              {businessUsers.map((user: any) => (
                                <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell>
                            <select
                              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              value={assignment.dataMartId}
                              onChange={(e) => updateNewAssignment(assignment.id, "dataMartId", e.target.value)}
                            >
                              <option value="">Select Data Mart</option>
                              {dataMarts.map((mart: any) => (
                                <option key={mart.id} value={mart.id}>{mart.name} ({mart.db_type})</option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm" variant="ghost" className="h-8 w-8 p-0 text-chart-green hover:text-chart-green"
                                    onClick={() => handleAssign(assignment)}
                                    disabled={!assignment.userId || !assignment.dataMartId || isAlreadyAssigned}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{isAlreadyAssigned ? "Already assigned" : "Assign"}</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => removeNewAssignmentRow(assignment.id)}>
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Remove</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current Assignments Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Current Assignments
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search users or data marts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {groupedList.length === 0 ? (
              <div className="text-center py-12">
                <Database className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">No assignments found.</p>
                <Button variant="outline" size="sm" onClick={addNewAssignmentRow}>
                  <Plus className="h-4 w-4 mr-2" /> Create First Assignment
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12 font-semibold">#</TableHead>
                      <TableHead className="font-semibold">User</TableHead>
                      <TableHead className="font-semibold">Assigned Data Marts</TableHead>
                      <TableHead className="w-20 text-center font-semibold">Count</TableHead>
                      <TableHead className="w-24 text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedList.map((group: any, index: number) => {
                      const { userId, user, assignments } = group;
                      const isExpanded = expandedUsers.has(userId);
                      const userMarts = assignments
                        .map((a: any) => {
                          const mart = dataMarts.find((m: any) => m.id === a.data_mart_id || m.name === a.data_mart_id);
                          return mart ? { ...mart, _assignmentId: a.data_mart_id } : null;
                        })
                        .filter(Boolean);
                      const displayMarts = isExpanded ? userMarts : userMarts.slice(0, 3);
                      const hasMore = userMarts.length > 3;
                      const allMarts = userMarts.map((m: any) => m.id);

                      return (
                        <TableRow key={userId} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-xs font-bold text-primary-foreground">
                                {(user?.name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                              </div>
                              <div>
                                <span className="font-medium text-sm">{user?.name || "Unknown"}</span>
                                <p className="text-xs text-muted-foreground">{user?.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {displayMarts.map((mart: any) => (
                                <Badge
                                  key={mart._assignmentId || mart.id}
                                  variant="secondary"
                                  className="group pl-2 pr-1.5 py-1 h-6 text-xs gap-0.5 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-destructive"
                                >
                                  <span className="truncate max-w-[120px]">{mart.name}</span>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        className="ml-0.5 rounded-sm p-0.5 hover:bg-destructive/20 transition-colors"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUnassignSingle(userId, mart.id, user?.name, mart.name);
                                        }}
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Remove assignment</TooltipContent>
                                  </Tooltip>
                                </Badge>
                              ))}
                              {hasMore && (
                                <Button
                                  variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1"
                                  onClick={() => toggleExpand(userId)}
                                >
                                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  {isExpanded ? "Less" : `+${userMarts.length - 3}`}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-xs font-mono">{userMarts.length}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {userMarts.length > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleUnassignAll(userId, user?.name, userMarts)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Remove all assignments</TooltipContent>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialogs */}
        <InfoDialog
          open={infoDialog.open}
          title={infoDialog.title}
          message={infoDialog.message}
          variant={infoDialog.variant}
          onClose={() => setInfoDialog(prev => ({ ...prev, open: false }))}
        />
        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.action || (() => { })}
          onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false, action: null }))}
        />
      </div>
    </TooltipProvider>
  );
};

export default DataMartAssignment;
