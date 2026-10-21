import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  AlertTriangle,
  AlertCircle,
  Info,
  Bug,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  User,
  Database,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLogs } from "@/hooks/useApiData";
import { Loader2 } from "lucide-react";

type LogLevel = "info" | "warning" | "error" | "debug";

interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  user?: string;
  dataMart?: string;
}

const logLevelConfig: Record<LogLevel, { icon: typeof Info; className: string; label: string }> = {
  info: { icon: Info, className: "text-chart-lavender bg-chart-lavender/10", label: "INFO" },
  warning: { icon: AlertTriangle, className: "text-accent bg-accent/10", label: "WARN" },
  error: { icon: AlertCircle, className: "text-chart-red bg-chart-red/10", label: "ERROR" },
  debug: { icon: Bug, className: "text-muted-foreground bg-muted", label: "DEBUG" },
};

const LogMonitoringPage = () => {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: logsData, isLoading, refetch } = useLogs(
    levelFilter !== "all" ? levelFilter : undefined,
    sourceFilter !== "all" ? sourceFilter : undefined,
    search || undefined
  );

  const logs: LogEntry[] = logsData?.logs || [];
  const counts = logsData?.counts || { info: 0, warning: 0, error: 0, debug: 0 };
  const sources = [...new Set(logs.map((l) => l.source))];

  const filtered = logs.filter((log) => {
    const matchSearch =
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      (log.user && log.user.toLowerCase().includes(search.toLowerCase())) ||
      (log.dataMart && log.dataMart.toLowerCase().includes(search.toLowerCase()));
    const matchLevel = levelFilter === "all" || log.level === levelFilter;
    const matchSource = sourceFilter === "all" || log.source === sourceFilter;
    return matchSearch && matchLevel && matchSource;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Log Monitoring</h1>
          <p className="text-muted-foreground text-sm">Real-time system logs and activity tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setAutoRefresh(!autoRefresh);
              if (!autoRefresh) refetch();
            }}
            className={autoRefresh ? "gradient-primary border-0 text-primary-foreground" : ""}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${autoRefresh ? "animate-spin" : ""}`} style={autoRefresh ? { animationDuration: "3s" } : {}} />
            {autoRefresh ? "Live" : "Paused"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["info", "warning", "error", "debug"] as LogLevel[]).map((level) => {
          const config = logLevelConfig[level];
          const Icon = config.icon;
          return (
            <Card
              key={level}
              className={`cursor-pointer transition-all ${levelFilter === level ? "ring-2 ring-primary" : ""}`}
              onClick={() => setLevelFilter(levelFilter === level ? "all" : level)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.className}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{counts[level]}</p>
                  <p className="text-xs text-muted-foreground uppercase">{config.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">
          {filtered.length} entries
        </Badge>
      </div>

      {/* Log Entries */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((log, i) => {
                const config = logLevelConfig[log.level as LogLevel] || logLevelConfig.info;
                const Icon = config.icon;
                const isExpanded = expandedLog === log.id;
                const timestamp = new Date(log.timestamp).toLocaleString();
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <div>
                      <button
                        className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${config.className} mt-0.5`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-muted-foreground">{timestamp}</span>
                              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                                {log.source}
                              </Badge>
                            </div>
                            <p className="text-sm mt-1">{log.message}</p>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              {log.user && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <User className="h-3 w-3" /> {log.user}
                                </span>
                              )}
                              {log.dataMart && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Database className="h-3 w-3" /> {log.dataMart}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                          </div>
                        </div>
                      </button>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="px-4 pb-3 pt-0"
                        >
                          <div className="bg-muted/50 rounded-lg p-3 ml-9 space-y-2">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Level:</span>{' '}
                                <span className="font-medium">{log.level?.toUpperCase()}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Source:</span>{' '}
                                <span className="font-medium">{log.source}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Time:</span>{' '}
                                <span className="font-medium">{new Date(log.timestamp).toLocaleString()}</span>
                              </div>
                              {log.user && (
                                <div>
                                  <span className="text-muted-foreground">User:</span>{' '}
                                  <span className="font-medium">{log.user}</span>
                                </div>
                              )}
                            </div>
                            {log.dataMart && (
                              <div className="text-xs">
                                <span className="text-muted-foreground">Data Mart:</span>{' '}
                                <span className="font-medium">{log.dataMart}</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
              {filtered.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No log entries match your filters.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LogMonitoringPage;
