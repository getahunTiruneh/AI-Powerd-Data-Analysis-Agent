import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Mail, Building2, Shield, Database, Calendar, CheckCircle2, XCircle, Clock, WifiOff } from "lucide-react";
import { useProfile, useUpdateProfileStatus, useDataMarts, useAssignments, useAssignDataMart, useUnassignDataMart } from "@/hooks/useApiData";
import { toast } from "sonner";

const statusConfig: Record<string, any> = {
  active: { label: "Active", icon: CheckCircle2, className: "text-chart-green bg-chart-green/10" },
  pending: { label: "Pending", icon: Clock, className: "text-accent bg-accent/10" },
  suspended: { label: "Suspended", icon: XCircle, className: "text-chart-red bg-chart-red/10" },
};

const UserDetailPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { data: user, isLoading } = useProfile(userId);
  const { data: dataMarts = [], isLoading: isLoadingMarts } = useDataMarts();
  const { data: userAssignments = [] } = useAssignments(userId);
  const updateStatus = useUpdateProfileStatus();
  const assignMart = useAssignDataMart();
  const unassignMart = useUnassignDataMart();

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  if (!user) return (
    <div className="p-6 text-center">
      <p className="text-muted-foreground">User not found.</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/users")}>Back to Users</Button>
    </div>
  );

  const statusKey = (user.status || "pending") as string;
  const status = statusConfig[statusKey] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/users")}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold text-primary/100">User Details</h1>
      </div>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl gradient-primary text-xl font-bold text-primary-foreground">
                {(user.name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">{user.name}</h2>
                  <Badge className={`${status.className} border-0`}><StatusIcon className="h-3 w-3 mr-1" /> {status.label}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm">{user.email}</p></div></div>
                  <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Role</p><p className="text-sm">{user.role === "admin" ? "Admin" : "Business User"}</p></div></div>
                  <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Department</p><p className="text-sm">{user.dept || "—"}</p></div></div>
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Registered</p><p className="text-sm">{user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</p></div></div>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  {user.status === "pending" && (
                    <Button size="sm" className="gradient-primary border-0 text-primary-foreground" onClick={() => { updateStatus.mutate({ userId: user.id, status: "active" }); toast.success("User approved"); }}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                  )}
                  {user.status === "active" && user.role !== "admin" && (
                    <Button size="sm" variant="destructive" onClick={() => { updateStatus.mutate({ userId: user.id, status: "suspended" }); toast.warning("User suspended"); }}>Suspend</Button>
                  )}
                  {user.status === "suspended" && (
                    <Button size="sm" variant="outline" onClick={() => { updateStatus.mutate({ userId: user.id, status: "active" }); toast.success("User reactivated"); }}>Reactivate</Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> Data Mart Access</CardTitle></CardHeader>
          <CardContent>
            {isLoadingMarts ? (
              <div className="text-center py-4 text-muted-foreground">Loading data marts...</div>
            ) : dataMarts.length === 0 ? (
              <div className="text-center py-8">
                <WifiOff className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">No database connected</p>
                <p className="text-xs text-muted-foreground mt-1">Connect to a database in Data Mart Management to assign tables</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/admin/datamarts")}>
                  Go to Data Marts
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {dataMarts.map((mart: any) => {
                  const isAssigned = userAssignments.some((a: any) => a.data_mart_id === mart.id);
                  return (
                    <div key={mart.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                      <Checkbox 
                        checked={isAssigned} 
                        onCheckedChange={(checked) => {
                          if (checked) { 
                            assignMart.mutate({ userId: user.id, dataMartId: mart.id }); 
                            toast.success(`Assigned ${mart.name}`); 
                          } else { 
                            unassignMart.mutate({ userId: user.id, dataMartId: mart.id }); 
                            toast.info(`Removed ${mart.name}`); 
                          }
                        }} 
                      />
                      <span className="text-lg">{mart.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{mart.name}</p>
                        <p className="text-xs text-muted-foreground">{mart.column_count || 0} columns</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default UserDetailPage;
