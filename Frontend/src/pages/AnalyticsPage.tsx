import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
} from "recharts";
import { useAnalytics } from "@/hooks/useApiData";
import { Loader2, TrendingUp, Shield, Users, Activity, AlertTriangle, Clock } from "lucide-react";

const AnalyticsPage = () => {
  const { data: analytics, isLoading } = useAnalytics();

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hourlyData = analytics?.hourlyQueries?.map((h) => ({
    hour: `${h.hour}:00`,
    queries: h.count || 0,
  })) || Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, queries: 0 }));

  const quickStats = [
    { label: "Avg. Queries/User", value: analytics?.avgQueriesPerUser || "0", icon: Users, color: "text-primary" },
    { label: "Query Success Rate", value: `${analytics?.querySuccessRate || 0}%`, icon: Activity, color: "text-chart-green" },
    { label: "Failed Logins (24h)", value: analytics?.failedLogins24h || 0, icon: AlertTriangle, color: (analytics?.failedLogins24h || 0) > 5 ? "text-destructive" : "text-chart-gold" },
    { label: "Users w/ Failures", value: analytics?.failedLoginUsers || 0, icon: Shield, color: "text-accent" },
  ]; 

  const topUsersData = analytics?.topUsers?.map((u: any) => ({
    name: u.name,
    conversations: u.conversations,
  })) || [];

  const topDataMartsData = analytics?.topDataMarts?.map((d: any) => ({
    name: d.name,
    conversations: d.conversations,
  })) || [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary/100">Analytics</h1>
        <p className="text-muted-foreground text-sm">Performance metrics, engagement patterns, and security insights</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card className="border">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <s.icon className={`h-5 w-5 ${s.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Query Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-chart-purple" /> Query Distribution (24hr)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={3} />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Area type="monotone" dataKey="queries" stroke="hsl(var(--chart-purple))" fill="hsl(var(--chart-purple))" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Most Active Users */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-chart-gold" /> Most Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topUsersData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topUsersData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={100} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="conversations" fill="hsl(var(--chart-gold))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No user activity yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Data Marts by Conversations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-chart-plum" /> Top Data Marts by Conversation Count
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topDataMartsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topDataMartsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Bar dataKey="conversations" fill="hsl(var(--chart-plum))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No data mart usage yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsPage;
