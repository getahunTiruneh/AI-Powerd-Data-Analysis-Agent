import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Database, Table2, CheckCircle2, AlertCircle, MoreVertical, Eye, Trash2, Loader2, Link2, X, Wifi, WifiOff, ChevronDown, Check, Search, LayoutGrid, List } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useDataMarts } from "@/hooks/useApiData";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/hooks/useApi";
import { ScrollArea } from "@/components/ui/scroll-area";

const statusStyles = {
  connected: { label: "Connected", icon: CheckCircle2, className: "text-chart-green bg-chart-green/10" },
  syncing: { label: "Syncing", icon: AlertCircle, className: "text-accent bg-accent/10" },
  error: { label: "Error", icon: AlertCircle, className: "text-chart-red bg-chart-red/10" },
};

const DataMartManagement = () => {
  const { data: dataMarts = [], isLoading, refetch, isFetching } = useDataMarts();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [connection, setConnection] = useState({
    host: "",
    port: "5432",
    database: "",
    username: "",
    password: "",
    ssl: false,
  });
  const [connecting, setConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<{ host: string; database: string } | null>(null);

  const [schemas, setSchemas] = useState<string[]>(["public", "data_mart"]);
  const [selectedSchema, setSelectedSchema] = useState<string>("data_mart");
  const [schemaTables, setSchemaTables] = useState<{ table_name: string; column_count: number }[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [currentSchema, setCurrentSchema] = useState<string | null>(null);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  useEffect(() => {
    if (isConnected && selectedSchema) {
      loadTables(selectedSchema);
    }
  }, [isConnected, selectedSchema]);

  const checkConnectionStatus = async () => {
    try {
      const { data } = await apiFetch("/admin/data-marts/connection/status");
      setIsConnected(data?.connected || false);
      setConnectionInfo(data?.config || null);
      setCurrentSchema(data?.schema || null);
      if (data?.schema) {
        setSelectedSchema(data.schema);
        loadTables(data.schema);
      } else if (data?.connected) {
        // Auto-select data_mart schema if not set
        setSelectedSchema("data_mart");
        await apiFetch("/admin/data-marts/connection/schema", {
          method: "POST",
          body: JSON.stringify({ schema: "data_mart" }),
        });
        loadTables("data_mart");
      }
      if (data?.connected) {
        refetch();
      }
    } catch {
      setIsConnected(false);
      setConnectionInfo(null);
      setCurrentSchema(null);
    }
  };

  const handleConnect = async () => {
    if (!connection.host || !connection.database) {
      toast.error("Host and Database are required");
      return;
    }

    setConnecting(true);
    try {
      const { error } = await apiFetch("/admin/data-marts/connection", {
        method: "POST",
        body: JSON.stringify(connection),
      });

      if (error) {
        toast.error(error);
      } else {
        toast.success("Connected successfully!");
        setIsConnected(true);
        setConnectionInfo({ host: connection.host, database: connection.database });

        // Auto-save schema and load tables
        try {
          await apiFetch("/admin/data-marts/connection/schema", {
            method: "POST",
            body: JSON.stringify({ schema: selectedSchema }),
          });
          loadTables(selectedSchema);
          refetch();
        } catch (err) {
          console.error("Failed to auto-save schema");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await apiFetch("/admin/data-marts/connection", { method: "DELETE" });
      setIsConnected(false);
      setConnectionInfo(null);
      setCurrentSchema(null);
      setSchemas([]);
      setSelectedSchema("data_mart");
      setSchemaTables([]);
      toast.success("Disconnected");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Disconnect failed");
    }
  };

  const loadTables = async (schema: string) => {
    setLoadingTables(true);
    try {
      const { data, error } = await apiFetch(`/admin/data-marts/connection/schemas/${schema}/tables`);
      if (error) throw new Error(error);
      const tables = Array.isArray(data) ? data : (data?.tables || []);
      setSchemaTables(tables);
    } catch (err: any) {
      toast.error(err.message || "Failed to load tables");
    } finally {
      setLoadingTables(false);
    }
  };

  const handleSchemaChange = async (schema: string) => {
    setSelectedSchema(schema);

    try {
      await apiFetch("/admin/data-marts/connection/schema", {
        method: "POST",
        body: JSON.stringify({ schema }),
      });
      loadTables(schema);
      refetch();
    } catch (err) {
      console.error("Failed to save schema selection");
    }
  };

  const handleFinish = async () => {
    try {
      await apiFetch("/admin/data-marts/connection/schema", {
        method: "POST",
        body: JSON.stringify({ schema: selectedSchema }),
      });
    } catch (err) {
      console.error("Failed to save schema selection");
    }
    setCurrentSchema(selectedSchema);
    setShowConnectionDialog(false);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary/100">Data Mart Management</h1>
          <p className="text-muted-foreground text-sm">Connect to a database to see available data marts</p>
        </div>
        {isConnected ? (
          <Button variant="outline" onClick={() => { setShowConnectionDialog(true); }}>
            <Link2 className="h-4 w-4 mr-2" /> Browse More Tables
          </Button>
        ) : (
          <Button className="gradient-primary border-0 text-primary-foreground" onClick={() => setShowConnectionDialog(true)}>
            <Link2 className="h-4 w-4 mr-2" /> Connect Database
          </Button>
        )}
      </div>

      {/* Connection Status Banner */}
      <div className={`flex items-center justify-between p-4 rounded-lg border ${isConnected
          ? "bg-chart-green/5 border-chart-green/20"
          : "bg-muted/50 border-border"
        }`}>
        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              <Wifi className="h-5 w-5 text-chart-green" />
              <div>
                <p className="font-medium text-chart-green">Connected to {connectionInfo?.database}</p>
                <p className="text-sm text-muted-foreground">{connectionInfo?.host}</p>
              </div>
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">No Database Connected</p>
                <p className="text-sm text-muted-foreground">Connect to a database to view data marts</p>
              </div>
            </>
          )}
        </div>
        {isConnected && (
          <Button variant="outline" size="sm" onClick={handleDisconnect} className="text-chart-red border-chart-red/20 hover:bg-chart-red/10">
            <X className="h-4 w-4 mr-1" /> Disconnect
          </Button>
        )}
      </div>

      {/* Data Marts Grid */}
      {!isConnected ? (
        <Card className="p-12 text-center">
          <Database className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Data Source Connected</h3>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            Connect to a database to see available tables as data marts. Your connection details are stored securely.
          </p>
          <Button className="gradient-primary border-0 text-primary-foreground" onClick={() => setShowConnectionDialog(true)}>
            <Link2 className="h-4 w-4 mr-2" /> Connect Database
          </Button>
        </Card>
      ) : dataMarts.length === 0 ? (
        <Card className="p-12 text-center">
          <Table2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Tables Found</h3>
          <p className="text-muted-foreground mb-4">No tables available in the connected database.</p>
          <Button variant="outline" onClick={() => { setShowConnectionDialog(true); }}>
            <Link2 className="h-4 w-4 mr-2" /> Browse Different Schema
          </Button>
        </Card>
      ) : (
        <>
          {/* Search + View Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search data marts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {(dataMarts || [])
                .filter((mart: any) =>
                  mart.name?.toLowerCase().includes(search.toLowerCase()) ||
                  mart.description?.toLowerCase().includes(search.toLowerCase())
                )
                .map((mart: any, i: number) => {
                  const status = statusStyles[mart.status as keyof typeof statusStyles] || statusStyles.connected;
                  const StatusIcon = status.icon;
                  return (
                    <motion.div key={mart.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                      <Card className="border hover:border-primary/30 transition-colors h-full cursor-pointer" onClick={() => navigate(`/admin/datamarts/${mart.id}?schema=${selectedSchema}`)}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              {mart.icon ? <span className="text-2xl">{mart.icon}</span> : <Database className="h-8 w-8 text-purple-800" />}
                              <div>
                                <CardTitle className="text-base">{mart.name}</CardTitle>
                                <Badge className={`${status.className} border-0 text-xs mt-1`}>
                                  <StatusIcon className="h-3 w-3 mr-1" />{status.label}
                                </Badge>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/datamarts/${mart.id}?schema=${selectedSchema}`); }}>
                                  <Eye className="h-3.5 w-3.5 mr-2" /> View Schema
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4">{mart.description || "Data table"}</p>
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="text-center p-2 rounded-lg bg-muted/50">
                              <Table2 className="h-4 w-4 mx-auto text-primary mb-1" />
                              <p className="text-sm font-semibold">{mart.column_count || 0}</p>
                              <p className="text-xs text-muted-foreground">Columns</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-muted/50">
                              <Database className="h-4 w-4 mx-auto text-accent mb-1" />
                              <p className="text-sm font-semibold">{mart.size || "N/A"}</p>
                              <p className="text-xs text-muted-foreground">Size</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t">
                            <span>Type: Table</span>
                            <span className="bg-muted px-2 py-0.5 rounded font-mono">{mart.name}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              {dataMarts.filter((mart: any) =>
                mart.name?.toLowerCase().includes(search.toLowerCase()) ||
                mart.description?.toLowerCase().includes(search.toLowerCase())
              ).length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No data marts match "{search}"</p>
                  </div>
                )}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Name</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Description</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Columns</th>
                    <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Size</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(dataMarts || [])
                    .filter((mart: any) =>
                      mart.name?.toLowerCase().includes(search.toLowerCase()) ||
                      mart.description?.toLowerCase().includes(search.toLowerCase())
                    )
                    .map((mart: any, i: number) => {
                      const status = statusStyles[mart.status as keyof typeof statusStyles] || statusStyles.connected;
                      const StatusIcon = status.icon;
                      return (
                        <motion.tr key={mart.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                          className="hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => navigate(`/admin/datamarts/${mart.id}?schema=${selectedSchema}`)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {mart.icon ? <span className="text-lg">{mart.icon}</span> : <Database className="h-5 w-5 text-purple-800" />}
                              <span className="font-medium text-sm">{mart.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">{mart.description || "Data table"}</td>
                          <td className="px-4 py-3">
                            <Badge className={`${status.className} border-0 text-xs`}>
                              <StatusIcon className="h-3 w-3 mr-1" />{status.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center text-sm">{mart.column_count || 0}</td>
                          <td className="px-4 py-3 text-center text-sm">{mart.size || "N/A"}</td>
                          <td className="px-4 py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/datamarts/${mart.id}?schema=${selectedSchema}`); }}>
                                  <Eye className="h-3.5 w-3.5 mr-2" /> View Schema
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </motion.tr>
                      );
                    })}
                  {(dataMarts || []).filter((mart: any) =>
                    mart.name?.toLowerCase().includes(search.toLowerCase()) ||
                    mart.description?.toLowerCase().includes(search.toLowerCase())
                  ).length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-12">
                          <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                          <p className="text-sm text-muted-foreground">No data marts match "{search}"</p>
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Database Connection Dialog */}
      <Dialog open={showConnectionDialog} onOpenChange={(open) => {
        if (!open) {
          setShowConnectionDialog(false);
          setSchemaTables([]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>{isConnected ? "Select Schema" : "Database Connection"}</DialogTitle>
                <DialogDescription>
                  {isConnected
                    ? `Preview tables from selected schema. ${schemaTables.length} tables loaded.`
                    : "Connect to your data source to see available tables as data marts."}
                </DialogDescription>
              </div>
              {isConnected && (
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-chart-green" />
                  <span className="text-xs text-muted-foreground">Connected</span>
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Connection Form - Show if not connected */}
          {!isConnected && (
            <div className="space-y-4 py-2 overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label>Host *</Label>
                  <Input value={connection.host} onChange={(e) => setConnection({ ...connection, host: e.target.value })} placeholder="localhost or IP address" />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input value={connection.port} onChange={(e) => setConnection({ ...connection, port: e.target.value })} placeholder="5432" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Database Name *</Label>
                <Input value={connection.database} onChange={(e) => setConnection({ ...connection, database: e.target.value })} placeholder="your_database" />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={connection.username} onChange={(e) => setConnection({ ...connection, username: e.target.value })} placeholder="postgres" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={connection.password} onChange={(e) => setConnection({ ...connection, password: e.target.value })} placeholder="••••••••" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={connection.ssl} onCheckedChange={(checked) => setConnection({ ...connection, ssl: checked })} />
                <Label>Use SSL Connection</Label>
              </div>
            </div>
          )}

          {/* Schema Selection + Table Preview - Show when connected */}
          {isConnected && (
            <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
              <div className="space-y-2">
                <Label>Select Schema</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {selectedSchema || "Select a schema"} <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full max-h-60 overflow-y-auto">
                    {(schemas || []).map(schema => (
                      <DropdownMenuItem
                        key={schema}
                        onClick={() => handleSchemaChange(schema)}
                        className="cursor-pointer"
                      >
                        <span className="flex-1">{schema}</span>
                        {selectedSchema === schema && <Check className="h-4 w-4 text-primary" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="text-sm text-muted-foreground">
                {schemaTables.length} tables available in <span className="font-medium text-foreground">{selectedSchema}</span>
              </div>
              <ScrollArea className="flex-1 max-h-64 border rounded-lg">
                {loadingTables ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {(schemaTables || []).map(table => (
                      <div key={table?.table_name || Math.random()} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <Table2 className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 font-mono text-sm">{table?.table_name || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground">{table?.column_count || 0} cols</span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          <DialogFooter>
            <div className="flex gap-2 w-full justify-end">
              {!isConnected && (
                <>
                  <Button variant="outline" onClick={() => setShowConnectionDialog(false)}>Cancel</Button>
                  <Button className="gradient-primary border-0 text-primary-foreground" onClick={handleConnect} disabled={connecting}>
                    {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                    {connecting ? "Connecting..." : "Connect"}
                  </Button>
                </>
              )}
              {isConnected && (
                <>
                  <Button variant="outline" onClick={() => setShowConnectionDialog(false)}>Cancel</Button>
                  <Button
                    className="gradient-primary border-0 text-primary-foreground"
                    onClick={handleFinish}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Done ({schemaTables.length} tables)
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DataMartManagement;
