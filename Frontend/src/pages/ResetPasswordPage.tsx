import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot, KeyRound, CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "@/hooks/useApi";

const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      navigate("/forgot-password");
    }
  }, [token, navigate]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!token) {
      toast.error("Invalid token");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: password })
      });
      if (error) {
        toast.error(error);
      } else {
        setSuccess(true);
        toast.success("Password reset successful");
        setTimeout(() => navigate("/"), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-chart-green/20 mx-auto mb-6">
            <CheckCircle2 className="h-8 w-8 text-chart-green" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Password Reset</h2>
          <p className="text-muted-foreground mb-6">Your password has been reset successfully.</p>
          <Button onClick={() => navigate("/")} className="w-full">
            Go to Login
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold">XYZ Bank Data Insight Agent</span>
        </div>

        <div className="text-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary mx-auto mb-4 shadow-glow-primary">
            <KeyRound className="h-7 w-7 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-1">Reset Password</h2>
          <p className="text-muted-foreground">Enter your new password</p>
        </div>

        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" />
          </div>
          <Button type="submit" disabled={loading || !token} className="w-full gradient-primary border-0 text-primary-foreground shadow-glow-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Reset Password
          </Button>
        </form>

        <button onClick={() => navigate("/")} className="flex items-center gap-2 mt-6 mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors">
          Back to Login
        </button>
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;