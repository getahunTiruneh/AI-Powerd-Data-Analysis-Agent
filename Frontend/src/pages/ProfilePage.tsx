import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useDataMarts, useAssignments, useConversations } from "@/hooks/useApiData";
import { apiFetch } from "@/hooks/useApi";
import { User, Mail, Building2, Shield, Database, Calendar, Clock, Edit2, Save, X, Key, Activity, Lock, Bell } from "lucide-react";
import { toast } from "sonner";

const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const { data: dataMarts = [] } = useDataMarts();
  const { data: assignments = [] } = useAssignments(user?.id);
  const { data: conversations = [] } = useConversations();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const assignedMarts = dataMarts.filter((m: any) => assignments.some((a: any) => a.data_mart_id === m.id));

  if (!user) return <div className="p-6 text-center text-muted-foreground">Profile not available.</div>;

  const handleSave = async () => {
    if (editName.trim()) {
      const { data, error } = await apiFetch("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: editName })
      });
      if (error) { toast.error(error); return; }
      await refreshUser();
      toast.success("Profile updated");
    }
    setIsEditing(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    const { data, error } = await apiFetch("/auth/password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword })
    });
    if (error) { toast.error(error); return; }
    toast.success("Password updated");
    setChangingPassword(false);
    setCurrentPassword("");
    setNewPassword("");
  };

  const initials = (user.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden">
          <div className="h-28 gradient-primary relative">
            <div className="absolute inset-0 opacity-20">
              {[...Array(8)].map((_, i) => (<div key={i} className="absolute rounded-full bg-primary-foreground" style={{ width: Math.random() * 120 + 40, height: Math.random() * 120 + 40, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, opacity: Math.random() * 0.15 }} />))}
            </div>
          </div>
          <CardContent className="relative px-6 pb-6">
            <div className="flex flex-col md:flex-row items-start md:items-end gap-4 -mt-12">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl gradient-gold text-3xl font-bold text-accent-foreground border-4 border-card shadow-lg">{initials}</div>
              <div className="flex-1 pt-2 md:pb-1">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9 w-64" />
                    <Button size="sm" variant="ghost" onClick={handleSave}><Save className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">{user.name}</h1>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditName(user.name); setIsEditing(true); }}><Edit2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`${user.status === "active" ? "text-chart-green bg-chart-green/10" : "text-accent bg-accent/10"} border-0 text-xs`}>{user.status}</Badge>
                <Badge variant="outline" className="text-xs">{user.role === "admin" ? "Administrator" : "Business User"}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Tabs defaultValue="overview">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="datamarts">Data Marts</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3"><User className="h-4 w-4 text-primary" /><div><p className="text-xs text-muted-foreground">Full Name</p><p className="text-sm font-medium">{user.name}</p></div></div>
                <Separator />
                <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-primary" /><div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm font-medium">{user.email}</p></div></div>
                <Separator />
                <div className="flex items-center gap-3"><Building2 className="h-4 w-4 text-primary" /><div><p className="text-xs text-muted-foreground">Department</p><p className="text-sm font-medium">{user.dept || "—"}</p></div></div>
                <Separator />
                <div className="flex items-center gap-3"><Shield className="h-4 w-4 text-primary" /><div><p className="text-xs text-muted-foreground">Role</p><p className="text-sm font-medium">{user.role === "admin" ? "Administrator" : "Business User"}</p></div></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Usage Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50"><p className="text-3xl font-bold text-gradient-primary">{conversations.length}</p><p className="text-xs text-muted-foreground mt-1">Conversations</p></div>
                  <div className="text-center p-4 rounded-lg bg-muted/50"><p className="text-3xl font-bold text-gradient-primary">{assignedMarts.length}</p><p className="text-xs text-muted-foreground mt-1">Data Marts</p></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="datamarts" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4 text-primary" />Assigned Data Marts ({assignedMarts.length})</CardTitle></CardHeader>
            <CardContent>
              {assignedMarts.length === 0 ? (
                <div className="text-center py-8"><Database className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No data marts assigned yet.</p></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {assignedMarts.map((mart: any) => (
                    <div key={mart.id} className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/30 transition-colors">
                      <span className="text-2xl">{mart.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{mart.name}</p>
                        <p className="text-xs text-muted-foreground">{typeof mart.row_count === 'number' ? `${mart.row_count.toLocaleString()} rows` : '0 rows'} · {mart.column_count || 0} columns</p>
                        {mart.columns?.length > 0 && <p className="text-[10px] text-muted-foreground/70 truncate">{mart.columns.slice(0, 5).join(', ')}</p>}
                      </div>
                      <Badge variant="outline" className={`text-xs ${mart.status === "connected" ? "text-chart-green border-chart-green/30" : "text-accent border-accent/30"}`}>{mart.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4 text-primary" />Security Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3"><Key className="h-4 w-4 text-muted-foreground" /><div><p className="text-sm font-medium">Password</p><p className="text-xs text-muted-foreground">Change your account password</p></div></div>
                <Button variant="outline" size="sm" onClick={() => setChangingPassword(!changingPassword)}>Change Password</Button>
              </div>
              {changingPassword && (
                <div className="flex items-center gap-2 pl-10">
                  <Input type="password" placeholder="New password (min 6 chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="max-w-xs" />
                  <Button size="sm" onClick={handleChangePassword}>Update</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfilePage;
