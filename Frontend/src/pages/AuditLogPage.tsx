import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuditLogs, useAuditLogSources, useAuditLogDetail, useAuditSecuritySummary, useDeleteAuditLog, AuditLog, AuditLogFilters } from "@/hooks/useApiData";
import {
  Search, Download, RefreshCw, AlertTriangle, Shield,
  ChevronLeft, ChevronRight, Eye, XCircle, CheckCircle2, Clock,
  User, Monitor, Globe, Hash, Calendar, Info, Copy, Flag, MoreHorizontal,
  CalendarDays, Activity, Terminal, Clipboard, Trash2, ArrowDown, ArrowUp,
  KeyRound, Network, FileText, AlertCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const sourceIcons: Record<string, React.ReactNode> = {
  AUTH: <KeyRound className="h-3.5 w-3.5 text-chart-gold" />,
  CHAT: <Activity className="h-3.5 w-3.5 text-chart-purple" />,
  SYSTEM: <Terminal className="h-3.5 w-3.5 text-muted-foreground" />,
  ADMIN: <Shield className="h-3.5 w-3.5 text-chart-plum" />,
  API: <Network className="h-3.5 w-3.5 text-chart-bronze" />,
};

const actionIcons: Record<string, React.ReactNode> = {
  LOGIN: <KeyRound className="h-3.5 w-3.5" />,
  LOGOUT: <KeyRound className="h-3.5 w-3.5" />,
  CHAT: <Activity className="h-3.5 w-3.5" />,
  CREATE: <FileText className="h-3.5 w-3.5" />,
  DELETE: <Trash2 className="h-3.5 w-3.5" />,
  UPDATE: <Clipboard className="h-3.5 w-3.5" />,
};

const levelBadges: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  info: {
    bg: "bg-blue-50 dark:bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    icon: <Info className="h-3.5 w-3.5" />,
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  error: {
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
};

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string; icon: React.ReactNode }> = {
  success: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
    label: "Success",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  failed: {
    bg: "bg-red-50 dark:bg-red-500/10",
    text: "text-red-700 dark:text-red-400",
    dot: "bg-red-500",
    label: "Failed",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
    label: "Warning",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
};

const roleColors: Record<string, { bg: string; text: string }> = {
  admin: { bg: "bg-purple-50 dark:bg-purple-500/10", text: "text-purple-700 dark:text-purple-400" },
  business_user: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-700 dark:text-amber-400" },
  system: { bg: "bg-zinc-100 dark:bg-zinc-500/10", text: "text-zinc-600 dark:text-zinc-400" },
};

const AuditLogPage = () => {
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: 10,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AuditLog | null>(null);

  const { data: logsData, isLoading, refetch } = useAuditLogs(filters);
  const { data: sources = [] } = useAuditLogSources();
  const { data: securityData } = useAuditSecuritySummary();
  const deleteLog = useDeleteAuditLog();
  const { data: selectedLogDetail } = useAuditLogDetail(selectedLog?.id || "");

  const logs = logsData?.data || [];
  const pagination = logsData?.pagination || { page: 1, limit: 15, total: 0, totalPages: 0 };

  const debouncedSearch = useCallback((term: string) => {
    setFilters(prev => ({ ...prev, search: term || undefined, page: 1 }));
  }, []);

  const debounceTimer = useMemo(() => {
    let timer: NodeJS.Timeout;
    return (term: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => debouncedSearch(term), 350);
    };
  }, [debouncedSearch]);

  useEffect(() => {
    debounceTimer(search);
  }, [search, debounceTimer]);

  const handleFilterChange = (key: keyof AuditLogFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: (value === "all" || value === "") ? undefined : value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const params = new URLSearchParams();
      params.append('format', format);
      if (filters.level) params.append('level', filters.level);
      if (filters.source) params.append('source', filters.source);
      if (filters.search) params.append('search', filters.search);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await fetch(`/api/admin/audit-logs/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
      }
      toast.success("Export completed");
    } catch (error) {
      toast.error("Export failed");
    }
  };

  const openDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary/100">Audit Logs</h1>
          <p className="text-muted-foreground text-xs">Track user activity and system events</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 text-xs">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')} className="h-8 text-xs">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Security Summary */}
      {securityData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="border-l-4 border-l-destructive">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-lg font-bold">{securityData.failedLoginsLast24h}</p>
                  <p className="text-[10px] text-muted-foreground">Failed Logins (24h)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-chart-gold">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-chart-gold/10">
                  <Shield className="h-4 w-4 text-chart-gold" />
                </div>
                <div>
                  <p className="text-lg font-bold">{securityData.suspiciousIPs?.length || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Suspicious IPs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-chart-purple">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-chart-purple/10">
                  <User className="h-4 w-4 text-chart-purple" />
                </div>
                <div>
                  <p className="text-lg font-bold">{securityData.usersWithFailures?.length || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Users with Failures</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
              <Input
                placeholder="Search all logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <Select value={filters.level || "all"} onValueChange={(v) => handleFilterChange('level', v)}>
              <SelectTrigger className="w-[110px] h-8 text-xs">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.source || "all"} onValueChange={(v) => handleFilterChange('source', v)}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map((source: string) => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                className="h-8 px-2 rounded-md border border-input bg-background text-[11px]"
                value={filters.startDate || ""}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
              <span className="text-muted-foreground text-[11px]">to</span>
              <input
                type="date"
                className="h-8 px-2 rounded-md border border-input bg-background text-[11px]"
                value={filters.endDate || ""}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>

            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setFilters({ page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' });
                setSearch('');
              }}
              className="h-8 text-xs"
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/50">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-36">Timestamp</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-32">Level</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-28">Source</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-28">Message</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-40">User</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-36">Data Mart</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-24">Role</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-28">Status</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-32">IP</TableHead>
                  <TableHead className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">Loading audit logs...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <Shield className="h-10 w-10 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">No audit logs found</p>
                        <p className="text-xs text-muted-foreground/70">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log: AuditLog, index: number) => {
                    const levelConf = levelBadges[log.level?.toLowerCase()] || levelBadges.info;
                    const statusConf = statusConfig[log.status] || statusConfig.success;
                    const sourceIcon = sourceIcons[log.source?.toUpperCase()] || sourceIcons.SYSTEM;
                    const roleConf = roleColors[log.role] || roleColors.system;
                    const logTime = new Date(log.createdAt);
                    const timeStr = logTime.toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
                    });
                    const timeAgo = (() => {
                      const diff = Date.now() - logTime.getTime();
                      const mins = Math.floor(diff / 60000);
                      if (mins < 1) return 'Just now';
                      if (mins < 60) return `${mins}m ago`;
                      const hrs = Math.floor(mins / 60);
                      if (hrs < 24) return `${hrs}h ago`;
                      const days = Math.floor(hrs / 24);
                      return `${days}d ago`;
                    })();

                    return (
                      <TableRow
                        key={log.id}
                        className="group transition-colors duration-150 hover:bg-muted/40 cursor-pointer border-border/30"
                        onClick={() => openDetail(log)}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-foreground">{timeStr}</span>
                            <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${levelConf.bg} ${levelConf.text}`}>
                            {levelConf.icon}
                            {log.level || 'info'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {sourceIcon}
                            <span className="text-xs font-medium">{log.source || '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs text-foreground leading-snug line-clamp-1">{log.message || '—'}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-chart-purple/80 text-[9px] font-bold text-primary-foreground shadow-sm">
                              {(log.userName || 'S')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{log.userName || 'System'}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{log.userEmail || ''}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.dataMartName ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-primary/5 text-primary dark:bg-primary/10 dark:text-primary/80 border border-primary/10">
                              <FileText className="h-2.5 w-2.5" />
                              <span className="truncate max-w-[100px]">{log.dataMartName}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-semibold capitalize ${roleConf.bg} ${roleConf.text}`}>
                            {(log.role || 'system').replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusConf.bg} ${statusConf.text}`}>
                            <span className={`h-1 w-1 rounded-full ${statusConf.dot}`} />
                            {statusConf.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <code className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1 py-0.5 rounded">
                            {log.ip || '—'}
                          </code>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-50 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openDetail(log); }}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(log.id || '');
                                toast.success('Log ID copied');
                              }}>
                                <Copy className="h-4 w-4 mr-2" />
                                Copy Log ID
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(JSON.stringify(log, null, 2));
                                toast.success('Log data copied');
                              }}>
                                <Clipboard className="h-4 w-4 mr-2" />
                                Copy JSON
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(log);
                              }} className="text-destructive focus:text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {pagination.total > 0 ? (
                  <>
                    Showing <span className="font-semibold text-foreground">{((pagination.page - 1) * pagination.limit) + 1}</span>–<span className="font-semibold text-foreground">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-semibold text-foreground">{pagination.total.toLocaleString()}</span>
                  </>
                ) : (
                  'No entries'
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              {Array.from({ length: Math.min(5, pagination.totalPages || 1) }, (_, i) => {
                let pageNum: number;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (pagination.page <= 3) {
                  pageNum = i + 1;
                } else if (pagination.page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = pagination.page - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={pagination.page === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    className={`h-7 w-7 p-0 text-[11px] ${pagination.page === pageNum ? 'bg-primary text-primary-foreground' : ''}`}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-muted/40 to-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold">Audit Log Details</DialogTitle>
                  <DialogDescription>Complete log information and metadata</DialogDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(selectedLog?.id || '');
                  toast.success('Log ID copied');
                }}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy ID
              </Button>
            </div>
          </DialogHeader>

          {selectedLog && (
            <div className="flex-1 overflow-y-auto py-5 px-6 space-y-5">
              {/* Status Banner */}
              <div className={`px-4 py-3 rounded-xl flex items-center justify-between ${selectedLog.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20' :
                selectedLog.status === 'failed' ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20' :
                  'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20'
                }`}>
                <div className="flex items-center gap-2">
                  {selectedLog.status === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> :
                    selectedLog.status === 'failed' ? <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" /> :
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
                  <span className={`font-semibold text-sm ${selectedLog.status === 'success' ? 'text-emerald-700 dark:text-emerald-400' :
                    selectedLog.status === 'failed' ? 'text-red-700 dark:text-red-400' :
                      'text-amber-700 dark:text-amber-400'
                    }`}>
                    {selectedLog.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {sourceIcons[selectedLog.source?.toUpperCase()]}
                  <span className="text-xs font-medium text-muted-foreground">{selectedLog.source}</span>
                </div>
              </div>

              {/* Main Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-3">
                  <InfoField label="USER" icon={<User className="h-4 w-4" />}>
                    <p className="font-semibold text-sm">{selectedLog.userName || 'System'}</p>
                    <p className="text-xs text-muted-foreground">{selectedLog.userEmail || '—'}</p>
                  </InfoField>

                  <InfoField label="ROLE" icon={<Shield className="h-4 w-4" />}>
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold capitalize ${(roleColors[selectedLog.role || 'system'] || roleColors.system).bg} ${(roleColors[selectedLog.role || 'system'] || roleColors.system).text}`}>
                      {(selectedLog.role || 'system').replace('_', ' ')}
                    </span>
                  </InfoField>

                  <InfoField label="IP ADDRESS" icon={<Globe className="h-4 w-4" />}>
                    <code className="text-sm font-mono text-muted-foreground">{selectedLog.ip || 'Not recorded'}</code>
                  </InfoField>

                  <InfoField label="DATA MART / FILE" icon={<FileText className="h-4 w-4" />}>
                    {selectedLog.dataMartName ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium bg-primary/5 text-primary dark:bg-primary/10 dark:text-primary/80 border border-primary/10">
                        <FileText className="h-3.5 w-3.5" />
                        {selectedLog.dataMartName}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground/50">Not applicable</span>
                    )}
                  </InfoField>
                </div>

                {/* Right Column */}
                <div className="space-y-3">
                  <InfoField label="TIMESTAMP" icon={<CalendarDays className="h-4 w-4" />}>
                    <p className="font-semibold text-sm">{formatDate(selectedLog.createdAt)}</p>
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(selectedLog.createdAt)}</p>
                  </InfoField>

                  <InfoField label="DEVICE" icon={<Monitor className="h-4 w-4" />}>
                    <p className="text-xs font-mono text-muted-foreground line-clamp-2">{selectedLog.userAgent || 'Not recorded'}</p>
                  </InfoField>

                  <InfoField label="LOG ID" icon={<Hash className="h-4 w-4" />}>
                    <code className="text-xs font-mono text-muted-foreground break-all">{selectedLog.id}</code>
                  </InfoField>
                </div>
              </div>

              {/* Message */}
              <InfoField label="MESSAGE" icon={<Activity className="h-4 w-4" />} full>
                <p className="text-sm leading-relaxed">{selectedLog.message}</p>
              </InfoField>

              {/* Prompt & Response (chat logs) */}
              {selectedLog.details?.prompt && (
                <InfoField label="PROMPT" icon={<Terminal className="h-4 w-4" />} full>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono bg-muted/30 rounded-lg p-3">{selectedLog.details.prompt}</p>
                </InfoField>
              )}
              {selectedLog.details?.response && (
                <InfoField label="AI RESPONSE" icon={<Activity className="h-4 w-4" />} full>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono bg-muted/30 rounded-lg p-3">{selectedLog.details.response}</p>
                </InfoField>
              )}

              {/* Additional IDs */}
              {(selectedLog.sessionId || selectedLog.requestId) && (
                <InfoField label="ADDITIONAL IDS" icon={<Hash className="h-4 w-4" />} full>
                  <div className="space-y-1">
                    {selectedLog.requestId && (
                      <div className="flex items-start gap-3">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">Request ID:</span>
                        <code className="text-xs font-mono break-all">{selectedLog.requestId}</code>
                      </div>
                    )}
                    {selectedLog.sessionId && (
                      <div className="flex items-start gap-3">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">Session ID:</span>
                        <code className="text-xs font-mono break-all">{selectedLog.sessionId}</code>
                      </div>
                    )}
                  </div>
                </InfoField>
              )}

              {/* Raw Data Toggle */}
              <details className="group">
                <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  <ChevronRight className="h-4 w-4 group-open:rotate-90 transition-transform" />
                  View Raw JSON
                </summary>
                <pre className="mt-2 bg-zinc-950 dark:bg-zinc-900 text-emerald-400 p-4 rounded-xl overflow-x-auto text-xs font-mono max-h-64">
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Audit Log</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this log entry?
              {deleteTarget && (
                <span className="block mt-2 text-xs font-mono bg-muted p-2 rounded">"{deleteTarget.message}"</span>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteLog.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const InfoField = ({ label, icon, children, full }: { label: string; icon: React.ReactNode; children: React.ReactNode; full?: boolean }) => (
  <div className={`bg-muted/20 rounded-xl p-4 ${full ? 'col-span-2' : ''}`}>
    <div className="flex items-center gap-2 text-muted-foreground mb-2">
      {icon}
      <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
    </div>
    <div className="pl-6">{children}</div>
  </div>
);

export default AuditLogPage;
