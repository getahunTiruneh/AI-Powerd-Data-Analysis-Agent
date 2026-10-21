import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Database, CheckCircle2, XCircle, Loader2, Server, Shield, Plug } from "lucide-react";
import { useCreateDataMart } from "@/hooks/useApiData";
import { toast } from "sonner";

type Step = "info" | "connection" | "test" | "done";

const dbTypes = [
  { value: "PostgreSQL", label: "PostgreSQL", icon: "🐘", port: "5432" },
  { value: "Oracle", label: "Oracle Database", icon: "🔶", port: "1521" },
  { value: "MySQL", label: "MySQL", icon: "🐬", port: "3306" },
  { value: "SQL Server", label: "Microsoft SQL Server", icon: "🟦", port: "1433" },
  { value: "MongoDB", label: "MongoDB", icon: "🍃", port: "27017" },
  { value: "MariaDB", label: "MariaDB", icon: "🦭", port: "3306" },
];

const icons = ["📊", "🏦", "📱", "💰", "👥", "💳", "🛡️", "📈", "🏢", "📋"];

const NewDataMartPage = () => {
  const navigate = useNavigate();
  const createDataMart = useCreateDataMart();
  const [step, setStep] = useState<Step>("info");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📊");
  const [dbType, setDbType] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [dbName, setDbName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [schema, setSchema] = useState("public");
  const [useSsl, setUseSsl] = useState(true);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [testMessage, setTestMessage] = useState("");

  const selectedDb = dbTypes.find((d) => d.value === dbType);

  const handleDbTypeChange = (value: string) => {
    setDbType(value);
    const db = dbTypes.find((d) => d.value === value);
    if (db) setPort(db.port);
  };

  const validateInfo = () => { if (!name.trim()) { toast.error("Name required"); return false; } if (!description.trim()) { toast.error("Description required"); return false; } return true; };
  const validateConnection = () => { if (!dbType) { toast.error("Select database type"); return false; } if (!host.trim()) { toast.error("Host required"); return false; } if (!dbName.trim()) { toast.error("Database name required"); return false; } return true; };

  const handleTestConnection = () => {
    setTestStatus("testing");
    setTimeout(() => {
      const success = Math.random() > 0.2;
      if (success) { setTestStatus("success"); setTestMessage(`Connected to ${selectedDb?.label} at ${host}:${port}/${dbName}. Found 12 tables, 156 columns.`); toast.success("Connection successful!"); }
      else { setTestStatus("failed"); setTestMessage(`Connection failed: Unable to reach ${host}:${port}.`); toast.error("Connection test failed"); }
    }, 2500);
  };

  const handleCreate = async () => {
    try {
      await createDataMart.mutateAsync({
        name, description, icon, db_type: dbType,
        connection_config: { host, port, database: dbName, schema, username, ssl: useSsl },
      });
      setStep("done");
    } catch { toast.error("Failed to create data mart"); }
  };

  const steps = [{ key: "info", label: "Basic Info", num: 1 }, { key: "connection", label: "Connection", num: 2 }, { key: "test", label: "Test & Create", num: 3 }];
  const currentStepIdx = steps.findIndex((s) => s.key === step);

  if (step === "done") {
    return (
      <div className="p-6 max-w-3xl mx-auto flex items-center justify-center min-h-[60vh]">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary mx-auto mb-6 shadow-glow-primary">
            <CheckCircle2 className="h-10 w-10 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Data Mart Created!</h2>
          <p className="text-muted-foreground mb-6">"{name}" has been configured and connected.</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate("/admin/datamarts")}>View All Data Marts</Button>
            <Button className="gradient-primary border-0 text-primary-foreground" onClick={() => navigate("/chat")}>Start Querying</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/datamarts")}><ArrowLeft className="h-4 w-4" /></Button>
        <div><h1 className="text-2xl font-bold">New Data Mart</h1><p className="text-muted-foreground text-sm">Configure a new enterprise data source</p></div>
      </div>

      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${i <= currentStepIdx ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {i < currentStepIdx ? "✓" : s.num}
            </div>
            <span className={`text-sm ${i <= currentStepIdx ? "font-medium text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
            {i < steps.length - 1 && <div className={`w-12 h-px ${i < currentStepIdx ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {step === "info" && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" />Basic Information</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2"><Label>Data Mart Name *</Label><Input placeholder="e.g., Treasury Operations" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Description *</Label><Textarea placeholder="Describe the purpose..." value={description} onChange={(e) => setDescription(e.target.value)} rows={4} /></div>
              <div className="space-y-2"><Label>Icon</Label><div className="flex gap-2 flex-wrap">{icons.map((ic) => (<button key={ic} onClick={() => setIcon(ic)} className={`h-10 w-10 flex items-center justify-center rounded-lg text-lg border transition-colors ${icon === ic ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>{ic}</button>))}</div></div>
              <div className="flex justify-end pt-2"><Button className="gradient-primary border-0 text-primary-foreground" onClick={() => validateInfo() && setStep("connection")}>Next: Connection<ArrowRight className="h-4 w-4 ml-2" /></Button></div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {step === "connection" && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Plug className="h-5 w-5 text-primary" />Database Connection</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2"><Label>Database Type *</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {dbTypes.map((db) => (<button key={db.value} onClick={() => handleDbTypeChange(db.value)} className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${dbType === db.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"}`}><span className="text-2xl">{db.icon}</span><span className="text-sm font-medium">{db.label}</span></button>))}
                </div>
              </div>
              {dbType && (<>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2"><Label>Host *</Label><Input placeholder="e.g., db.xyzbank.internal" value={host} onChange={(e) => setHost(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Port *</Label><Input value={port} onChange={(e) => setPort(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Database Name *</Label><Input placeholder="e.g., xyz_treasury" value={dbName} onChange={(e) => setDbName(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Schema</Label><Input value={schema} onChange={(e) => setSchema(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Username *</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Shield className="h-4 w-4 text-primary" />
                  <div className="flex-1"><p className="text-sm font-medium">SSL/TLS Encryption</p></div>
                  <Button variant={useSsl ? "default" : "outline"} size="sm" className={useSsl ? "gradient-primary border-0 text-primary-foreground" : ""} onClick={() => setUseSsl(!useSsl)}>{useSsl ? "Enabled" : "Disabled"}</Button>
                </div>
              </>)}
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep("info")}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
                <Button className="gradient-primary border-0 text-primary-foreground" onClick={() => validateConnection() && setStep("test")}>Next: Test<ArrowRight className="h-4 w-4 ml-2" /></Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {step === "test" && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-primary" />Connection Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div><p className="text-xs text-muted-foreground">Data Mart</p><p className="text-sm font-medium">{icon} {name}</p></div>
                  <div><p className="text-xs text-muted-foreground">Database</p><p className="text-sm font-medium">{selectedDb?.icon} {selectedDb?.label}</p></div>
                </div>
                <div className="space-y-3">
                  <div><p className="text-xs text-muted-foreground">Host</p><p className="text-sm font-medium font-mono">{host}:{port}</p></div>
                  <div><p className="text-xs text-muted-foreground">Database</p><p className="text-sm font-medium font-mono">{dbName}</p></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Test Connection</CardTitle><CardDescription>Verify before creating</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full gradient-primary border-0 text-primary-foreground h-12" onClick={handleTestConnection} disabled={testStatus === "testing"}>
                {testStatus === "testing" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testing...</> : testStatus === "success" ? <><CheckCircle2 className="h-4 w-4 mr-2" /> Test Again</> : <><Plug className="h-4 w-4 mr-2" /> Test Connection</>}
              </Button>
              {testStatus === "success" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3 p-4 rounded-lg bg-chart-green/10 border border-chart-green/20">
                  <CheckCircle2 className="h-5 w-5 text-chart-green mt-0.5" /><div><p className="text-sm font-medium text-chart-green">Connection Successful</p><p className="text-xs text-muted-foreground mt-1">{testMessage}</p></div>
                </motion.div>
              )}
              {testStatus === "failed" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3 p-4 rounded-lg bg-chart-red/10 border border-chart-red/20">
                  <XCircle className="h-5 w-5 text-chart-red mt-0.5" /><div><p className="text-sm font-medium text-chart-red">Connection Failed</p><p className="text-xs text-muted-foreground mt-1">{testMessage}</p></div>
                </motion.div>
              )}
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep("connection")}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
                <Button className="gradient-primary border-0 text-primary-foreground" disabled={testStatus !== "success"} onClick={handleCreate}>Create Data Mart</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default NewDataMartPage;
