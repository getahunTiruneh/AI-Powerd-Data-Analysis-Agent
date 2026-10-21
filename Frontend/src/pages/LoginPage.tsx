import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const XYZ_BANK_LOGO = "/xyz-bank-logo.svg";

const LoginPage = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [dept, setDept] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        if (!name.trim() || !email.trim() || !password.trim() || !dept.trim()) {
          toast.error("Please fill in all fields");
          return;
        }
        if (password.length < 8) {
          toast.error("Password must be at least 8 characters");
          return;
        }
        if (!email.includes('@') || !email.includes('.')) {
          toast.error("Please enter a valid email address");
          return;
        }
        const result = await register(name, email, password, dept);
        if (result.success) {
          setRegistered(true);
          toast.success("Registration submitted! Awaiting admin approval.");
        } else {
          toast.error(result.error || "Registration failed");
        }
      } else {
        if (!email.trim() || !password.trim()) {
          toast.error("Please enter email and password");
          return;
        }
        const result = await login(email, password);
        if (result.success) {
          navigate(result.role === 'admin' ? '/admin' : '/chat');
        } else {
          // More user-friendly messages
          if (result.error === "Account is pending") {
            toast.error("Your account is pending approval. Please contact admin or try again later.");
          } else if (result.error === "Account is suspended") {
            toast.error("Your account has been suspended. Please contact the administrator.");
          } else {
            toast.error(result.error || "Login failed");
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50 p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl shadow-slate-200/50 text-center border border-slate-100"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-50 mx-auto mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
            >
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </motion.div>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Request Submitted</h2>
          <p className="text-slate-600 mb-6 leading-relaxed">
            Access request for <span className="font-semibold text-primary">{email}</span> is now pending admin review.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 mb-8 text-sm text-slate-500 text-left border border-slate-100">
            <p>• Verification email sent</p>
            <p>• Admin review (typically 24h)</p>
            <p>• System access notification via SMS</p>
          </div>
          <Button
            variant="ghost"
            className="w-full hover:bg-slate-100 text-slate-600"
            onClick={() => { setRegistered(false); setIsRegister(false); setName(""); setDept(""); setPassword(""); }}
          >
            Return to Login
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex font-sans bg-white">
      {/* Left panel - Branding & Visuals */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary items-center justify-center p-16 relative overflow-hidden">
        {/* Dynamic Background Pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                x: [0, Math.random() * 50, 0],
                y: [0, Math.random() * 50, 0]
              }}
              transition={{ duration: 10 + i, repeat: Infinity }}
              className="absolute rounded-full bg-white/10 blur-3xl"
              style={{ width: 400, height: 400, left: `${i * 20}%`, top: `${Math.random() * 80}%` }}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 w-full max-w-lg"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-8 text-xs font-medium text-white/90 uppercase tracking-widest">
            <span className="flex h-2 w-2 rounded-full bg-teal-300 animate-pulse align-middle" />
            Enterprise Analytics
          </div>
          <div className="flex items-center gap-4 mb-10">
            <div className="p-3 bg-white rounded-2xl shadow-2xl">
              <img src={XYZ_BANK_LOGO} alt="XYZ Bank" className="h-12 w-12 object-contain" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">XYZ Bank <span className="text-teal-300">Data Insight Agent</span></h1>
              <p className="text-white/60 text-sm">Next-Gen Intelligence Platform</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-6 leading-[1.1]">
            Decisions driven by <span className="text-white bg-clip-text bg-gradient-to-r from-teal-200 to-cyan-300">real-time data</span>
          </h2>
          <p className="text-white/70 text-xl font-light leading-relaxed">
            The internal command center for bank-wide analytics. Secure, fast, and remarkably intelligent.
          </p>
        </motion.div>
      </div>

      {/* Right panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-12 lg:p-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex justify-center mb-12">
            <img src={XYZ_BANK_LOGO} alt="XYZ Bank" className="h-14 w-14" />
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
              {isRegister ? "Access Request" : "System Login"}
            </h2>
            <p className="text-slate-500 mt-2">
              {isRegister ? "Fill in your details for verification." : "Enter your credentials to continue."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1.5">
                <Label htmlFor="name" className="text-slate-700 font-semibold ml-1">Full Name</Label>
                <Input id="name" placeholder="Full Name" className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all" value={name} onChange={(e) => setName(e.target.value)} />
              </motion.div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-700 font-semibold ml-1">Work Email</Label>
              <div className="relative">
                <Input id="email" type="email" placeholder="username" className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:bg-white pr-24 transition-all" value={email} onChange={(e) => setEmail(e.target.value)} />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-200/50 px-2 py-1 rounded">@cbe.com.et</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <Label htmlFor="password" className="text-slate-700 font-semibold">Password</Label>
                {!isRegister && (
                  <button type="button" onClick={() => navigate("/forgot-password")} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                    Reset Password?
                  </button>
                )}
              </div>
              <Input id="password" type="password" placeholder="••••••••" className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            {isRegister && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1.5">
                <Label htmlFor="department" className="text-slate-700 font-semibold ml-1">Department</Label>
                <Input id="department" placeholder="e.g. IT Audit" className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all" value={dept} onChange={(e) => setDept(e.target.value)} />
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-4 gradient-primary border-0 text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] transition-all"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <span className="flex items-center">
                  {isRegister ? "Submit Request" : "Secure Login"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-100">
            <p className="text-center text-sm text-slate-600">
              {isRegister ? "Already authorized?" : "New to the platform?"}{" "}
              <button onClick={() => setIsRegister(!isRegister)} className="text-primary font-bold hover:underline underline-offset-4 transition-all">
                {isRegister ? "Sign In" : "Request Access"}
              </button>
            </p>

            <div className="mt-8 flex items-center justify-center gap-6 opacity-40 grayscale group-hover:grayscale-0 transition-all">
              <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">XYZ Bank</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Secure Internal System</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
