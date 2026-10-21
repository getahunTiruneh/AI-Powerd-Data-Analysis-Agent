import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/hooks/useApi";

const XYZ_BANK_LOGO = "/xyz-bank-logo.svg";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      if (error) {
        toast.error(error);
      } else if (data?.success) {
        setResetToken(data.resetToken);
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <img src={XYZ_BANK_LOGO} alt="XYZ Bank logo" className="h-10 w-10 object-contain" />
            <span className="text-lg font-bold">XYZ Bank Data Insight Agent</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Check Your Email</h2>
          <p className="text-muted-foreground mb-2">
            Password reset requested for <span className="font-medium text-foreground">{email}</span>
          </p>
          <p className="text-sm text-muted-foreground mb-4">Use token below to reset your password.</p>
          <div className="bg-muted p-3 rounded-lg mb-4">
            <code className="text-xs break-all">{resetToken}</code>
          </div>
          <Button onClick={() => navigate(`/reset-password?token=${resetToken}`)} className="w-full mb-3">
            Continue to Reset Password
          </Button>
          <button onClick={() => navigate("/")} className="text-sm text-primary hover:underline">
            Back to Login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <img src={XYZ_BANK_LOGO} alt="XYZ Bank logo" className="h-10 w-10 object-contain justify-center" />
          <span className="text-lg font-bold text-center">XYZ Bank Data Insight Agent</span>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-1">Forgot Password?</h2>
          <p className="text-muted-foreground">Enter your email and we'll send you a reset link</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" placeholder="name@cbe.com.et" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full gradient-primary border-0 text-primary-foreground shadow-glow-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Send Reset Link
          </Button>
        </form>

        <button onClick={() => navigate("/")} className="flex items-center gap-2 mt-6 mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Login
        </button>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;
