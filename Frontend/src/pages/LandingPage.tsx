import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Shield, Brain, Menu, X, Lock, ChevronRight,
  Database, MessageSquare, Send,
  TrendingUp, Zap, BarChart3,
  ShieldCheck
} from "lucide-react";

// Constants & Configuration
const XYZ_BANK_LOGO = "/xyz-bank-logo.svg";

const navItems = [
  { label: "Home", href: "#" },
  { label: "Features", href: "#features" },
];

const features = [
  {
    icon: MessageSquare,
    title: "Natural Language Queries",
    description: "Ask questions in plain language — no SQL or technical skills required.",
    color: "text-chart-blue",
    bg: "bg-chart-blue/10",
  },
  {
    icon: BarChart3,
    title: "Auto-Generated Charts",
    description: "AI instantly creates line charts, bar graphs, and data tables.",
    color: "text-chart-gold",
    bg: "bg-chart-gold/10",
  },
  {
    icon: Database,
    title: "Multi Data Mart Support",
    description: "Connect across multiple banking data sources seamlessly.",
    color: "text-chart-cyan",
    bg: "bg-chart-cyan/10",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    description: "Granular permissions admins manage, users analyze, all tracked.",
    color: "text-chart-green",
    bg: "bg-chart-green/10",
  },
  {
    icon: Zap,
    title: "AI-Powered Insights",
    description: "Powered by Llama 70B via Groq for ultra-fast banking analytics.",
    color: "text-chart-blue",
    bg: "bg-chart-blue/10",
  },
  {
    icon: TrendingUp,
    title: "Audit & Analytics",
    description: "Complete audit trail with security monitoring and real-time logs.",
    color: "text-chart-blue",
    bg: "bg-chart-blue/10",
  },
];

const DEMO_DATA = [
  {
    question: "Show monthly transaction trends for 2025",
    chartType: "line",
    title: "Transaction Trends (2025)",
    subtitle: "ETB Millions",
    legend: [
      { label: "Retail", color: "hsl(213, 62%, 35%)" },
      { label: "Digital", color: "hsl(42, 84%, 38%)" },
    ],
    keys: ["retail", "digital"],
    data: [
      { month: 'Jan', retail: 1.2, digital: 0.8 },
      { month: 'Feb', retail: 1.5, digital: 1.1 },
      { month: 'Mar', retail: 1.8, digital: 1.4 },
      { month: 'Apr', retail: 1.6, digital: 1.3 },
      { month: 'May', retail: 2.0, digital: 1.6 },
      { month: 'Jun', retail: 2.2, digital: 1.9 },
    ],
  },
  {
    question: "What are the top performing branches?",
    chartType: "table",
    title: "Top Performing Branches",
    subtitle: "Transaction Volume",
    headers: ["Branch", "Region", "Volume", "Growth"],
    data: [
      { col1: "Addis Ababa", col2: "AA", col3: "4.2M", col4: "+15.3%" },
      { col1: "Bahir Dar", col2: "Amhara", col3: "2.8M", col4: "+8.7%" },
      { col1: "Hawassa", col2: "Oromia", col3: "2.1M", col4: "+12.1%" },
      { col1: "Mekelle", col2: "Tigray", col3: "1.9M", col4: "+10.5%" },
      { col1: "Gondar", col2: "Amhara", col3: "1.5M", col4: "+9.8%" },
      { col1: "Dire Dawa", col2: "DD", col3: "1.2M", col4: "+7.4%" },
    ],
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatStep, setChatStep] = useState(0); // 0: reset, 1: typing, 2: sent, 3: thinking, 4: response
  const [userInput, setUserInput] = useState("");
  const [showAiResponse, setShowAiResponse] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const featuresRef = useRef(null);

  // Chart Styling Constants
  const SVG_W = 260;
  const SVG_H = 80;
  const PAD = { top: 8, right: 8, bottom: 18, left: 28 };
  const plotW = SVG_W - PAD.left - PAD.right;
  const plotH = SVG_H - PAD.top - PAD.bottom;

  useEffect(() => {
    let typingInterval;
    const currentData = DEMO_DATA[currentQuestionIndex];

    if (chatStep === 1) {
      let charIndex = 0;
      typingInterval = setInterval(() => {
        if (charIndex <= currentData.question.length) {
          setUserInput(currentData.question.slice(0, charIndex));
          charIndex++;
        } else {
          clearInterval(typingInterval);
          setTimeout(() => setChatStep(2), 500); // Transition to "Sent"
        }
      }, 40);
    } else if (chatStep === 2) {
      setTimeout(() => setChatStep(3), 600); // Transition to "AI Thinking"
    } else if (chatStep === 3) {
      setTimeout(() => {
        setChatStep(4);
        setShowAiResponse(true);
      }, 1500); // Transition to "Show Chart"
    } else if (chatStep === 4) {
      setTimeout(() => {
        setShowAiResponse(false);
        setChatStep(1); // Loop back
        setCurrentQuestionIndex((prev) => (prev + 1) % DEMO_DATA.length);
      }, 5000);
    } else {
      setChatStep(1); // Start loop
    }

    return () => clearInterval(typingInterval);
  }, [chatStep, currentQuestionIndex]);

  const scrollToFeatures = (e) => {
    e.preventDefault();
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /**
   * Helper: Renders custom SVG charts based on data type
   */
  const renderChart = (data) => {
    if (data.chartType === "line") {
      const keys = data.keys;
      const allVals = data.data.flatMap(d => keys.map(k => d[k]));
      const maxVal = Math.max(...allVals) * 1.2;
      const toX = (i) => PAD.left + i * (plotW / (data.data.length - 1));
      const toY = (v) => PAD.top + plotH - (v / maxVal) * plotH;

      return (
        <div className="p-3 bg-white rounded-md">
          <div className="flex justify-between mb-1">
            <span className="text-[10px] font-bold">{data.title}</span>
            <span className="text-[9px] text-muted-foreground">{data.subtitle}</span>
          </div>
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full">
            {keys.map((key, ki) => (
              <polyline
                key={key}
                points={data.data.map((d, i) => `${toX(i)},${toY(d[key])}`).join(" ")}
                fill="none"
                stroke={data.legend[ki].color}
                strokeWidth="1.5"
                className="transition-all duration-1000"
              />
            ))}
            {data.data.map((d, i) => (
              <text key={i} x={toX(i)} y={SVG_H - 2} textAnchor="middle" fontSize="7" fill="#94a3b8">{d.month}</text>
            ))}
          </svg>
        </div>
      );
    }

    if (data.chartType === "table") {
      return (
        <div className="p-3 bg-white rounded-lg overflow-hidden">
          <p className="text-[10px] font-bold mb-2 uppercase">{data.title}</p>
          <table className="w-full text-[9px] border-collapse">
            <thead>
              <tr className="bg-muted/50">
                {data.headers.map((h, i) => <th key={i} className="p-1 text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.data.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-1 font-medium">{row.col1}</td>
                  <td className="p-1">{row.col2}</td>
                  <td className="p-1">{row.col3}</td>
                  <td className="p-1 text-green-600">{row.col4}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/10">
      {/* --- Header Navigation --- */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src={XYZ_BANK_LOGO} alt="XYZ Bank logo" className="h-9 w-auto" />
              <div className="hidden sm:block border-l pl-3 border-border">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">XYZ Bank Data Insight Agent</span>
                <p className="text-[10px] text-primary font-semibold uppercase tracking-wider">Data Agent</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-8">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={item.href === "#features" ? scrollToFeatures : undefined}
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={() => navigate("/login")} variant="ghost" size="sm" className="hidden sm:flex">
                Sign In
              </Button>
              <Button onClick={() => navigate("/login")} size="sm" className="shadow-lg shadow-primary/20 px-5">
                Launch Workspace
              </Button>
              <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* --- Hero Section --- */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">

          {/* Left Column: Copy */}
          <div className="text-center lg:text-left z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Official XYZ Bank Internal Tool</span>
            </div>

            <h1 className="text-2xl md:text-4xl font-extrabold mb-6 leading-[1.1] tracking-tight font-mono">
              Instant Insights <br />
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                From Banking Data.
              </span>
            </h1>

            <p className="text-md text-muted-foreground mb-10 max-w-lg mx-auto lg:mx-0 leading-relaxed align-justify font-mono">
              Analyze data marts securely using natural language. Get executive reports
              and automated visualizations without writing a single line of SQL.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button onClick={() => navigate("/login")} size="lg" className="h-14 px-8 text-md font-bold group">
                Enter XYZ Bank Workspace
                <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>

            <div className="mt-10 space-y-3">
              <div className="flex items-center justify-center lg:justify-start gap-2 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                <Lock className="h-3.5 w-3.5" />
                <span>Restricted to Authorized Personnel</span>
              </div>
              <div className="flex items-center justify-center lg:justify-start gap-2 text-[11px] font-semibold text-green-600/80 uppercase tracking-wider">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Encrypted Data Connection Active</span>
              </div>
            </div>
          </div>

          {/* Right Column: Chat Mockup */}
          <div className="relative group lg:block hidden">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-chart-gold/30 rounded-[2rem] blur-2xl opacity-50 transition-opacity group-hover:opacity-100" />
            <div className="relative bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden flex flex-col h-[420px]">
              {/* Mockup Header */}
              <div className="bg-primary p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                    <img src={XYZ_BANK_LOGO} alt="XYZ Bank" className="w-5 h-5 object-contain" />
                  </div>
                  <div>
                    <p className="text-white text-xs font-bold leading-none">XYZ Bank Data Insight Agent</p>
                    <p className="text-white/60 text-[10px] mt-1 italic">Enterprise Data Analysis Agent</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-full">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-[9px] text-white font-medium uppercase tracking-tighter">SECURE-LINK</span>
                </div>
              </div>

              {/* Mockup Body */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-muted/20">
                {chatStep >= 2 && (
                  <div className="flex justify-end animate-in slide-in-from-right-4 duration-300">
                    <div className="bg-primary text-white text-xs p-3 rounded-2xl rounded-tr-none max-w-[80%] shadow-md">
                      {userInput}
                    </div>
                  </div>
                )}

                {chatStep === 3 && (
                  <div className="flex gap-3 animate-in fade-in duration-300">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <img src={XYZ_BANK_LOGO} alt="XYZ Bank" className="h-4 w-4" />
                    </div>
                    <div className="bg-white border p-3 rounded-2xl rounded-tl-none flex gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}

                {showAiResponse && (
                  <div className="flex gap-3 animate-in slide-in-from-left-4 duration-500">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <img src={XYZ_BANK_LOGO} alt="XYZ Bank" className="h-4 w-4" />
                    </div>
                    <div className="flex-1 bg-white border rounded-2xl rounded-tl-none shadow-sm overflow-hidden max-w-[90%]">
                      {renderChart(DEMO_DATA[currentQuestionIndex])}
                    </div>
                  </div>
                )}
              </div>

              {/* Mockup Input */}
              <div className="p-4 border-t bg-card">
                <div className="flex items-center gap-3 bg-muted rounded-full px-4 py-2">
                  <div className="text-xs text-muted-foreground flex-1 truncate">
                    {userInput || "Type analysis request..."}
                  </div>
                  <Send className="w-4 h-4 text-primary opacity-50" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Features Grid --- */}
      <section ref={featuresRef} id="features" className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-mono mb-4 tracking-tight">Unified Data Intelligence</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Designed for banking data marts, enabling rapid analysis without compromising security.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <Card key={i} className="group border-none shadow-none bg-background/50 hover:bg-background transition-all hover:shadow-xl hover:shadow-primary/5">
                <CardContent className="p-8">
                  <div className={`w-12 h-12 rounded-xl ${f.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <f.icon className={`w-6 h-6 ${f.color}`} />
                  </div>
                  <h3 className="text-lg font-bold mb-3">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* --- Footer (Brand Theme) --- */}
      <footer className="relative w-full overflow-hidden text-white pt-24 pb-12"
        style={{ background: 'linear-gradient(135deg, hsl(213, 62%, 18%), hsl(205, 55%, 25%))' }}>

        {/* Wavy Decorative Divider */}
        <div className="absolute top-0 left-0 w-full rotate-180">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="h-16 w-full fill-background">
            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V120c43.43-11.45,86.86-22.9,134.42-29.39,46-6.27,94.39-4.84,186.97-34.17Z" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-3 relative z-10">
          <div className="grid md:grid-cols-4 gap-6 border-b border-white/10 pb-6 mb-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 text-teal-300 rounded-lg">
                  <img src={XYZ_BANK_LOGO} alt="XYZ Bank" className="h-6 w-6" />
                </div>
                <span className="text-xl font-bold tracking-tight font-mono text-teal-300">XYZ Bank Data Insight Agent</span>
              </div>
              <p className="text-white/60 text-sm max-w-md font-mono">
                Transforming banking data into actionable insights through secure,
                AI-driven natural language processing.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4 text-teal-200 opacity-80">Legal & Policy</h4>
              <ul className="space-y-4 text-sm text-white/70">
                <li><button className="hover:text-white transition-colors">Privacy Policy</button></li>
                <li><button className="hover:text-white transition-colors">Usage Guidelines</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest mb-4 text-teal-200 opacity-80">Support</h4>
              <ul className="space-y-4 text-sm text-white/70">
                <li><button className="hover:text-white transition-colors">IT Help Desk</button></li>
                <li><button className="hover:text-white transition-colors">Documentation</button></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-2">
            <p className="text-white/40 text-xs font-medium tracking-wider">
              © 2026 XYZ Bank | All Rights Reserved
            </p>
            <div className="flex gap-1">
              <span className="px-3 py-1 bg-white/5 border border-white/10 rounded text-[10px] font-bold tracking-widest text-white/40">
                Internal Use Only
              </span>
              <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded text-[10px] font-bold tracking-widest text-green-400">
                System Online
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}