import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, MessageSquare, Database, Activity, TrendingUp,
  ArrowUpRight, Clock, Shield,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { useProfiles, useDataMarts, useConversationStats, useAllMessages, useAllAssignments } from "@/hooks/useApiData";
import { useMemo } from "react";

const COLORS = [
  "hsl(213, 62%, 35%)",
  "hsl(174, 70%, 34%)",
  "hsl(210, 16%, 30%)",
  "hsl(192, 55%, 42%)",
  "hsl(42, 70%, 42%)",
  "hsl(160, 42%, 48%)",
  "hsl(198, 42%, 52%)",
  "hsl(25, 55%, 42%)",
];

const AdminDashboard = () => {
  const { data: profiles = [] } = useProfiles();
  const { data: dataMarts = [] } = useDataMarts();
  const { data: conversationStats = [] } = useConversationStats();
  const { data: messages = [] } = useAllMessages();
  const { data: assignments = [] } = useAllAssignments();

  const stats = useMemo(() => {
    const activeUsers = profiles.filter((p: any) => p.status === "active").length;
    const pendingUsers = profiles.filter((p: any) => p.status === "pending").length;
    const totalQueries = messages.filter((m: any) => m.role === "user").length;

    return [
      { label: "Total Users", value: profiles.length.toString(), sub: `${activeUsers} active, ${pendingUsers} pending`, icon: Users, color: "text-primary" },
      { label: "Active Data Marts", value: dataMarts.filter((m: any) => m.status === "connected").length.toString(), sub: `${dataMarts.length} total configured`, icon: Database, color: "text-accent" },
      { label: "Total Queries", value: totalQueries.toString(), sub: `${conversationStats.length} conversations`, icon: MessageSquare, color: "text-chart-plum" },
      { label: "Total Assignments", value: assignments.length.toString(), sub: `across ${new Set(assignments.map((a: any) => a.user_id)).size} users`, icon: Shield, color: "text-chart-bronze" },
    ];
  }, [profiles, dataMarts, conversationStats, messages, assignments]);

  const dataMartUsage = useMemo(() => {
    const counts: Record<string, number> = {};
    conversationStats.forEach((c: any) => {
      const name = c.data_mart_name || "Unknown";
      if (name && name !== "Unknown") {
        counts[name] = (counts[name] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [conversationStats]);

  const queryByDay = useMemo(() => {
    const days: Record<string, number> = {};
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    messages.forEach((m: any) => {
      if (m.role === "user" && m.created_at) {
        const d = new Date(m.created_at);
        const key = dayNames[d.getDay()];
        days[key] = (days[key] || 0) + 1;
      }
    });
    return dayNames.map((name) => ({ name, queries: days[name] || 0 }));
  }, [messages]);

  const usersByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    profiles.forEach((p: any) => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [profiles]);

  const recentConversations = useMemo(() => {
    return conversationStats.slice(0, 5).map((c: any) => ({
      title: c.title || "Untitled",
      mart: c.data_mart_name || "—",
      date: c.updated_at ? new Date(c.updated_at).toLocaleDateString() : "—",
      userName: c.user_name || "—",
    }));
  }, [conversationStats]);

  const assignmentsPerMart = useMemo(() => {
    const counts: Record<string, number> = {};
    assignments.forEach((a: any) => {
      const name = a.data_mart_name || "Unknown";
      if (name && name !== "Unknown") {
        counts[name] = (counts[name] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, users]) => ({ name, users }))
      .sort((a, b) => b.users - a.users);
  }, [assignments]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary/100">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm">Real-time platform analytics and monitoring</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="border bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Query Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Query Activity by Day</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={queryByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Bar dataKey="queries" fill="hsl(var(--chart-purple))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Data Mart Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Mart Usage</CardTitle>
          </CardHeader>
          <CardContent>
            {dataMartUsage.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={dataMartUsage} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke="none">
                      {dataMartUsage.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {dataMartUsage.map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground truncate">{item.name}</span>
                      </div>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No conversations yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Users by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {usersByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={usersByStatus} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={80} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="value" fill="hsl(var(--chart-gold))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No users yet</p>
            )}
          </CardContent>
        </Card>

        {/* Data Mart Assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-accent" /> Assignments per Data Mart
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assignmentsPerMart.length > 0 ? (
              <div className="space-y-3">
                {assignmentsPerMart.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.name}</p>
                      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full gradient-primary"
                          style={{ width: `${(item.users / Math.max(...assignmentsPerMart.map(a => a.users))) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{item.users} users</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No assignments yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Conversations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-chart-plum" /> Recent Conversations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentConversations.length > 0 ? (
            <div className="space-y-3">
              {recentConversations.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.userName} · {c.mart}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{c.date}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No conversations yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
