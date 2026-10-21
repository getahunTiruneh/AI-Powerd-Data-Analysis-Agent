import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Table2, Database, Key, Link2, Search, CheckCircle2, AlertCircle, ChevronRight, Columns3, Loader2 } from "lucide-react";
import { useDataMart } from "@/hooks/useApiData";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const statusStyles: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  connected: { label: "Connected", icon: CheckCircle2, className: "text-chart-green bg-chart-green/10" },
  syncing: { label: "Syncing", icon: AlertCircle, className: "text-accent bg-accent/10" },
  error: { label: "Error", icon: AlertCircle, className: "text-chart-red bg-chart-red/10" },
};

const DataMartDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: mart, isLoading, error } = useDataMart(id);
  const [search, setSearch] = useState("");
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !mart) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Table Not Found</h3>
        <p className="text-muted-foreground mb-4">The table "{id}" does not exist.</p>
        <Button variant="outline" onClick={() => navigate("/admin/datamarts")}>Back to Data Marts</Button>
      </div>
    );
  }

  const status = statusStyles[mart.status as keyof typeof statusStyles] || statusStyles.connected;
  const StatusIcon = status.icon;
  const columns = mart.columns || [];
  const filteredColumns = columns.filter((col: any) =>
    col.name?.toLowerCase().includes(search.toLowerCase()) ||
    col.type?.toLowerCase().includes(search.toLowerCase()) ||
    col.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/datamarts")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <span className="text-3xl">{mart.icon || "📊"}</span>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{mart.name}</h1>
              <Badge className={`${status.className} border-0 text-xs`}>
                <StatusIcon className="h-3 w-3 mr-1" />{status.label}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">{mart.description || "Data table"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Columns3, label: "Columns", value: columns.length },
          { icon: Database, label: "Type", value: "Table" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className="h-5 w-5 text-primary" />
              <div>
                <p className="text-lg font-semibold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Table Schema</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search columns..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="pl-10 h-9" 
            />
          </div>
        </div>
        
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Column</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Type</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Keys</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Nullable</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Description</th>
                </tr>
              </thead>
              <tbody>
                {filteredColumns.map((col: any, i: number) => (
                  <motion.tr 
                    key={col.name} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-t hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">{col.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs font-mono">{col.type}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex gap-1">
                        {col.isPrimaryKey && (
                          <Badge className="bg-primary/10 text-primary border-0 text-[10px] px-1.5">
                            <Key className="h-3 w-3 mr-0.5" /> PK
                          </Badge>
                        )}
                        {col.isForeignKey && (
                          <Badge className="bg-accent/10 text-accent border-0 text-[10px] px-1.5">
                            <Link2 className="h-3 w-3 mr-0.5" /> FK
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${col.nullable ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {col.nullable ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {col.description || '-'}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {filteredColumns.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                {columns.length === 0 ? "No columns found." : "No columns match your search."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DataMartDetail;
