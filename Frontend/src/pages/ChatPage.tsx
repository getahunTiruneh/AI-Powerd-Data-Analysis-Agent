import { useState, useRef, useEffect, useCallback } from "react";
import Papa from "papaparse";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Send, User, Download, Copy, Database, FileText,
  Loader2, Paperclip, X, Mic,
  RotateCcw, Check, Pencil, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { useAuth } from "@/contexts/AuthContext";
import {
  useDataMarts, useAssignments, useCreateConversation,
  useSaveMessage, useConversationMessages, useConversation
} from "@/hooks/useApiData";
import { useStreamChat } from "@/hooks/useStreamChat";
import { toast } from "sonner";
import { exportAsCSV, exportAsPDF } from "@/utils/chatExport";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const XYZ_BANK_LOGO = "/xyz-bank-logo.svg";

function hasTable(content: string): boolean {
  return /^\|.+\|\s*$|^#\s*\|.+/m.test(content);
}

function hasChart(content: string): boolean {
  return /```json\s*\n\s*\{\s*"type"\s*:\s*"(?:bar|line|pie)"/.test(content);
}

function stripMarkdown(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/###?\s*/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[\| ]*[-]+[\| ]*$/gm, "")
    .replace(/^\|/gm, "")
    .replace(/\|\s*$/gm, "")
    .replace(/\|/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTableCSV(content: string): string | null {
  const tableRegex = /^\|(.+)\|\s*$/gm;
  const rows: string[][] = [];
  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const cells = match[1].split("|").map(c => c.trim());
    rows.push(cells);
  }
  if (rows.length < 2) return null;
  const separatorRow = rows[1];
  const isSeparator = separatorRow.every(c => /^[-:\s]+$/.test(c));
  const dataRows = isSeparator ? [rows[0], ...rows.slice(2)] : rows.slice(1);
  const csv = dataRows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  return csv;
}

const ChatPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: allMarts = [], isLoading: loadingMarts } = useDataMarts();
  const { data: assignments = [], isLoading: loadingAssignments } = useAssignments(user?.id, user?.role);
  const createConversation = useCreateConversation();
  const saveMessage = useSaveMessage();
  const { streamChat, isStreaming } = useStreamChat();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedMart, setSelectedMart] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; data: any[]; headers: string[] } | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [frequentPrompts, setFrequentPrompts] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [suggestion, setSuggestion] = useState("");
  const autoCompleteTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const token = localStorage.getItem("token");
    try {
      const resp = await fetch(`${API_BASE}/chat/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          dataMartName: selectedMart?.name || "",
          totalRows: selectedMart?.row_count || 0,
          columnCount: selectedMart?.column_count || 0,
          fileName: uploadedFile?.name || "",
          fileHeaders: uploadedFile?.headers || [],
          fileRows: uploadedFile?.data?.length || 0,
        }),
      });
      const data = await resp.json();
      setSuggestedQuestions(data.suggestions || []);
      setFrequentPrompts(data.frequentPrompts || []);
    } catch {
      setSuggestedQuestions([]);
      setFrequentPrompts([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [selectedMart, uploadedFile]);

  const fetchAutoComplete = useCallback((text: string) => {
    if (autoCompleteTimer.current) clearTimeout(autoCompleteTimer.current);
    if (text.trim().length < 3 || isStreaming) { setSuggestion(""); return; }
    autoCompleteTimer.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem("token");
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        const resp = await fetch(`${API_BASE}/chat/autocomplete`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            currentInput: text,
            dataMartName: selectedMart?.name || null,
            dataMartDescription: selectedMart?.description || null,
          }),
        });
        const data = await resp.json();
        setSuggestion(data.suggestion?.trim() ? text + data.suggestion : "");
      } catch { setSuggestion(""); }
    }, 400);
  }, [selectedMart, isStreaming]);

  const toggleVoiceInput = useCallback(() => {
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice input is not supported in your browser");
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join("");
        setInput((prev) => prev + transcript);
      };
      recognition.onerror = (event: any) => {
        setIsRecording(false);
        const msg: Record<string, string> = {
          "not-allowed": "Microphone permission denied. Enable mic access in your browser settings and reload.",
          "no-speech": "No speech detected",
          "audio-capture": "No microphone found",
          "network": "Network error",
          "service-not-allowed": "Speech service not allowed",
        };
        toast.error(msg[event.error] || `Voice input failed: ${event.error}`);
      };
      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
      setIsRecording(true);
      recognition.start();
    }).catch(() => {
      toast.error("Unable to access the microphone. Please check settings.");
    });
  }, [isRecording]);

  // --- File Logic ---
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLoading(true);
    setSelectedMart(null);
    setConversationId(null);
    setMessages([]);
    const ext = file.name.split('.').pop()?.toLowerCase();

    const onComplete = (data: any[], headers: string[]) => {
      setUploadedFile({ name: file.name, data, headers });
      setFileLoading(false);
      toast.success(`${file.name} attached successfully`);
    };

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => onComplete(results.data as any[], results.meta.fields || []),
        error: () => { toast.error("Failed to parse CSV"); setFileLoading(false); }
      });
    } else if (['xlsx', 'xls'].includes(ext || '')) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const XLSX = await import("xlsx");
          const wb = XLSX.read(evt.target?.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws);
          onComplete(data, data.length > 0 ? Object.keys(data[0] as object) : []);
        } catch { toast.error("Failed to parse Excel"); setFileLoading(false); }
      };
      reader.readAsBinaryString(file);
    } else {
      toast.error("Please upload CSV or Excel");
      setFileLoading(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // --- Data Logic ---
  const assignedMartIds = (assignments || []).map((a: any) => a.data_mart_id);
  const availableMarts = user?.role === "admin" ? allMarts : allMarts.filter((m: any) => assignedMartIds.includes(m.id));

  const { data: previousMessages = [] } = useConversationMessages(conversationId);
  const { data: conversationData } = useConversation(conversationId);

  useEffect(() => {
    if (conversationData?.data_mart_id && !selectedMart && !uploadedFile) {
      const mart = availableMarts.find((m: any) => m.id === conversationData.data_mart_id);
      if (mart) setSelectedMart(mart);
    }
  }, [conversationData, availableMarts, selectedMart, uploadedFile]);

  useEffect(() => {
    if (!loadingMarts && !selectedMart && availableMarts.length > 0 && !uploadedFile) {
      setSelectedMart(availableMarts[0]);
    }
  }, [loadingMarts, availableMarts, selectedMart, uploadedFile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const convId = searchParams.get("conversationId");
    if (convId && convId !== conversationId) setConversationId(convId);
  }, [searchParams, conversationId]);

  useEffect(() => {
    if (previousMessages.length > 0) {
      setMessages(previousMessages.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
    }
  }, [previousMessages]);

  useEffect(() => {
    setSuggestedQuestions([]);
    setFrequentPrompts([]);
    setShowSuggestions(false);
    fetchSuggestions();
  }, [selectedMart?.id, uploadedFile?.name]);

  // --- Chat Actions ---
  const handleSend = async (overrideContent?: string) => {
    const contentToSend = overrideContent || input;
    if (!contentToSend.trim() || (!selectedMart && !uploadedFile) || isStreaming) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: contentToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    let convId = conversationId;
    if (!convId) {
      try {
        const conv = await createConversation.mutateAsync({
          dataMartId: selectedMart?.id || null,
          title: contentToSend.slice(0, 50),
        });
        convId = conv.id;
        setConversationId(convId);
        setSearchParams({ conversationId: convId! });
      } catch {
        toast.error("Session failed to initialize");
        return;
      }
    }

    saveMessage.mutate({ conversationId: convId!, role: "user", content: contentToSend });

    let assistantContent = "";
    await streamChat({
      messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
      dataMartId: selectedMart?.id || 'file',
      selectedMart: selectedMart,
      fileData: uploadedFile || undefined,
      onDelta: (chunk) => {
        assistantContent += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
          }
          return [...prev, { id: `ai-${Date.now()}`, role: "assistant", content: assistantContent }];
        });
      },
      onDone: () => {
        if (convId && assistantContent) {
          saveMessage.mutate({ conversationId: convId, role: "assistant", content: assistantContent });
        }
      },
      onError: (err) => toast.error(err),
    });
  };

  const handleSaveEdit = async (msg: Message) => {
    const msgIndex = messages.findIndex(m => m.id === msg.id);
    if (msgIndex === -1) return;

    setMessages(messages.slice(0, msgIndex));
    setEditingId(null);
    handleSend(editInput);
    setEditInput("");
  };

  // --- Render Helpers ---
  const renderInputBox = () => (
    <div className={`rounded-2xl border bg-slate-50 transition-all focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/5 focus-within:border-primary/20 ${isStreaming ? "opacity-70 pointer-events-none" : ""}`}>
      {uploadedFile && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-primary/5 rounded-t-2xl">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-primary truncate flex-1">{uploadedFile.name}</span>
          <button onClick={() => setUploadedFile(null)} className="hover:bg-primary/10 p-1 rounded-full"><X className="h-3 w-3 text-primary" /></button>
        </div>
      )}
      <div className="flex items-end gap-2 p-3">
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.xlsx,.xls" className="hidden" />
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl shrink-0" onClick={() => fileInputRef.current?.click()}>
          {fileLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5 text-slate-400" />}
        </Button>
        <div className="relative flex-1">
          {suggestion && input && suggestion.startsWith(input) && (
            <div className="absolute inset-0 pointer-events-none text-sm py-2.5 text-slate-300 truncate">{suggestion}</div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); fetchAutoComplete(e.target.value); }}
            onKeyDown={(e) => {
              if (e.key === "Tab" && suggestion.startsWith(input)) { e.preventDefault(); setInput(suggestion); setSuggestion(""); }
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Ask XYZ Bank Data Insight Agent..."
            rows={1}
            className="block w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm py-2.5 max-h-48 resize-none scrollbar-hide"
            style={{ height: "auto" }}
            onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = "auto"; t.style.height = `${Math.min(t.scrollHeight, 192)}px`; }}
          />
        </div>
        <Button variant="ghost" size="icon" onClick={toggleVoiceInput} disabled={isStreaming} className={`h-10 w-10 rounded-xl shrink-0 ${isRecording ? "bg-red-100 text-red-500 hover:bg-red-200 animate-pulse" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}>
          <Mic className="h-5 w-5" />
        </Button>
        <Button onClick={() => handleSend()} disabled={!input.trim() || isStreaming} className="h-10 w-10 rounded-xl bg-slate-900 hover:bg-slate-800 shrink-0 p-0 shadow-lg">
          {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-white" />}
        </Button>
      </div>
    </div>
  );

  if (loadingMarts || loadingAssignments) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (availableMarts.length === 0 && !loadingMarts) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Card className="max-w-md border-dashed">
          <CardContent className="p-10 text-center">
            <Database className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-bold">No Data Access</h3>
            <p className="text-sm text-muted-foreground mt-2 mb-6">Contact IT to assign Data Marts to your profile.</p>
            {user?.role === "admin" && <Button onClick={() => window.location.href = "/admin/datamarts"}>Manage Data Marts</Button>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden">
      {/* 1. SIDEBAR - Stays fixed on the left */}
      <aside className="hidden lg:flex w-72 flex-col border-r bg-slate-50/50 shrink-0 h-full">
        <div className="p-4 border-b bg-white/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{uploadedFile ? "Active Source" : "Data Sources"}</h3>
            <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full" onClick={() => { setMessages([]); setConversationId(null); setSearchParams({}); }}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* Uploaded File */}
          {uploadedFile && (
            <div className="w-full flex items-center gap-3 rounded-xl px-3 py-3 bg-primary/5 ring-1 ring-primary/20 text-primary">
              <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-4 w-4" />
              </div>
              <div className="text-left overflow-hidden">
                <p className="text-sm font-bold truncate">{uploadedFile.name}</p>
                <p className="text-[10px] opacity-60 truncate">{uploadedFile.data.length} rows · Ready</p>
              </div>
              <button onClick={() => setUploadedFile(null)} className="ml-auto hover:bg-primary/10 p-1 rounded-full shrink-0"><X className="h-3 w-3" /></button>
            </div>
          )}

          {/* Data Marts */}
          <div className={cn("space-y-2", uploadedFile && "opacity-30 pointer-events-none")}>
            <p className={cn("text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1", uploadedFile && "hidden")}>Data Sources</p>
            {availableMarts.map((mart: any) => (
              <button
                key={mart.id}
                onClick={() => { setSelectedMart(mart); setUploadedFile(null); setMessages([]); setConversationId(null); }}
                className={`w-full group flex items-center gap-3 rounded-xl px-3 py-3 transition-all ${selectedMart?.id === mart.id ? "bg-white shadow-sm ring-1 ring-primary/10 text-primary" : "text-slate-500 hover:bg-slate-100"
                  }`}
              >
                <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${selectedMart?.id === mart.id ? "bg-primary/10" : "bg-slate-100"}`}>
                  {mart.icon ? <span className="text-xl">{mart.icon}</span> : <Database className="h-4 w-4 text-purple-800" />}
                </div>
                <div className="text-left overflow-hidden">
                  <p className="text-sm font-bold truncate">{mart.name}</p>
                  <p className="text-[10px] opacity-60 truncate">
                    {mart.row_count?.toLocaleString()} rows · {mart.column_count} cols
                  </p>
                </div>
                <ChevronRight className={`ml-auto h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity ${selectedMart?.id === mart.id ? "text-primary opacity-100" : ""}`} />
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* 2. MAIN COLUMN */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative bg-white">
        {messages.length === 0 ? (
          /* ── CENTERED EMPTY LAYOUT ── */
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center mb-8">
              <div className="h-20 w-20 rounded-3xl flex items-center justify-center mb-6">
                <img src={XYZ_BANK_LOGO} alt="XYZ Bank" className="h-22 w-26 opacity-70" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 mb-2">How can I help with your data?</h1>
              <p className="text-slate-400 text-sm max-w-sm">Ask complex queries, generate visualizations, or summarize trends instantly.</p>
            </motion.div>

            <div className="w-full max-w-2xl">
              <div className="mb-3">
                <button onClick={() => { setShowSuggestions(!showSuggestions); if (!showSuggestions && suggestedQuestions.length === 0) fetchSuggestions(); }} className="text-[10px] text-slate-400 hover:text-slate-600 font-bold uppercase tracking-wider transition-colors mb-2 block">
                  {showSuggestions ? "Hide suggestions" : "Suggested Queries"}
                </button>
                {showSuggestions && (
                  <div className="space-y-3">
                    {loadingSuggestions ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400 px-2">
                        <Loader2 className="h-3 w-3 animate-spin" /> Generating suggestions...
                      </div>
                    ) : (
                      <>
                        {suggestedQuestions.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/60 mb-1.5">AI Suggestions</p>
                            <div className="flex flex-wrap gap-2">
                              {suggestedQuestions.map((q) => (
                              <button
                                key={q}
                                onClick={() => { setInput(q); setShowSuggestions(false); textareaRef.current?.focus(); }}
                                className="text-[11px] px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-primary/5 hover:border-primary/20 hover:text-primary transition-all font-medium"
                              >
                                {q}
                              </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {frequentPrompts.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600/60 mb-1.5">Most Asked</p>
                            <div className="flex flex-wrap gap-2">
                              {frequentPrompts.map((q) => (
                              <button
                                key={q}
                                onClick={() => { setInput(q); setShowSuggestions(false); textareaRef.current?.focus(); }}
                                className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-all font-medium"
                              >
                                {q}
                              </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {renderInputBox()}
              <p className="text-[10px] text-center text-slate-400 mt-3 font-medium tracking-tighter">Confidential · AI-Powered Intelligence System · XYZ Bank Internal Use Only</p>
            </div>
          </div>
        ) : (
          /* ── CHAT LAYOUT (header + scrollable messages + fixed bottom input) ── */
          <>
            <header className="flex items-center justify-between border-b px-6 py-3 h-16 shrink-0 z-10 bg-white/80 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 border shadow-sm">
                  <img src={XYZ_BANK_LOGO} alt="XYZ Bank" className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">XYZ Bank Data Insight Agent</h2>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-[10px] text-slate-500 font-medium">{uploadedFile ? `Analyzing: ${uploadedFile.name}` : `Connected to ${selectedMart?.name || 'System'}`}</p>
                  </div>
                </div>
              </div>
              <Badge variant="secondary" className="rounded-full px-3 py-1 gap-1.5 bg-slate-100 text-slate-600 border-none">
                <img src={XYZ_BANK_LOGO} alt="XYZ Bank" className="h-3 w-3" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">AI Powered</span>
              </Badge>
            </header>

            <div className="flex-1 overflow-y-auto scroll-smooth px-4 md:px-6 py-8">
              <div className="max-w-7xl mx-auto space-y-8">
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && <div className="h-9 w-9 shrink-0 rounded-full bg-slate-100 border flex items-center justify-center self-start mt-1"><img src={XYZ_BANK_LOGO} alt="XYZ Bank" className="h-5 w-5" /></div>}
                      <div className={`group relative ${msg.role === "assistant" && hasChart(msg.content) ? "flex-1 min-w-0" : "max-w-[85%]"} ${msg.role === "user" ? "order-first" : ""}`}>
                        <div className={`rounded-2xl px-5 py-4 ${msg.role === "user" ? "bg-[#e9eef6] text-black shadow-sm" : "bg-white border border-slate-100 shadow-sm text-slate-800"}`}>
                          {editingId === msg.id ? (
                            <div className="space-y-3 min-w-[85%]">
                              <textarea value={editInput} onChange={(e) => setEditInput(e.target.value)} className="w-full bg-[#e9eef6] border-none rounded-md p-2 text-sm outline-none text-black" />
                              <div className="flex justify-end gap-1 min-w-[400px]">
                                <Button size="sm" variant="ghost" className="text-black hover:bg-black/10" onClick={() => setEditingId(null)}>Cancel</Button>
                                <Button size="sm" className="bg-primary" onClick={() => handleSaveEdit(msg)}>send</Button>
                              </div>
                            </div>
                          ) : (
                            msg.role === "assistant" ? <MarkdownRenderer content={msg.content} /> : <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                          )}
                        </div>
                        {!editingId && (
                          <div className={`flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === "user" ? "justify-end" : ""}`}>
                            <button onClick={() => { navigator.clipboard.writeText(msg.role === "assistant" ? stripMarkdown(msg.content) : msg.content); setCopiedId(msg.id); setTimeout(() => setCopiedId(null), 2000); }} className="text-[10px] font-bold text-slate-400 hover:text-primary flex items-center gap-1">
                              {copiedId === msg.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copiedId === msg.id ? "Copied" : "Copy"}
                            </button>
                            {msg.role === "user" && <button onClick={() => { setEditingId(msg.id); setEditInput(msg.content); }} className="text-[10px] font-bold text-slate-400 hover:text-primary flex items-center gap-1"><Pencil className="h-3 w-3" /> Edit</button>}
                            {msg.role === "assistant" && hasTable(msg.content) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger className="text-[10px] font-bold text-slate-400 hover:text-primary flex items-center gap-1"><Download className="h-3 w-3" /> Export</DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem onClick={() => { const csv = extractTableCSV(msg.content); if (csv) { const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `table_${msg.id.slice(0, 8)}.csv`; a.click(); URL.revokeObjectURL(url); } }}>Export Table CSV</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        )}
                      </div>
                      {msg.role === "user" && <div className="h-9 w-9 shrink-0 rounded-full bg-slate-200 flex items-center justify-center self-start mt-1"><User className="h-5 w-5 text-slate-500" /></div>}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
                    <div className="h-9 w-9 shrink-0 rounded-xl bg-slate-100 border flex items-center justify-center"><img src={XYZ_BANK_LOGO} alt="XYZ Bank" className="h-5 w-5" /></div>
                    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm px-5 py-4">
                      <div className="flex gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="h-2 w-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            </div>

            <footer className="p-4 bg-white shrink-0">
              <div className="max-w-4xl mx-auto">
                <div className="mb-3">
                  <button onClick={() => { setShowSuggestions(!showSuggestions); if (!showSuggestions && suggestedQuestions.length === 0) fetchSuggestions(); }} className="text-[10px] text-slate-400 hover:text-slate-600 font-bold tracking-wider transition-colors mb-2 block">
                    {showSuggestions ? "Hide suggestions" : "Suggested Queries"}
                  </button>
                  {showSuggestions && (
                    <div className="space-y-3">
                      {loadingSuggestions ? (
                        <div className="flex items-center gap-2 text-xs text-slate-400 px-2">
                          <Loader2 className="h-3 w-3 animate-spin" /> Generating suggestions...
                        </div>
                      ) : (
                        <>
                          {suggestedQuestions.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/60 mb-1.5">AI Suggestions</p>
                              <div className="flex flex-wrap gap-2">
                                {suggestedQuestions.map((q) => (
                                <button
                                  key={q}
                                  onClick={() => { setInput(q); setShowSuggestions(false); textareaRef.current?.focus(); }}
                                  className="text-[11px] px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-primary/5 hover:border-primary/20 hover:text-primary transition-all font-medium"
                                >
                                  {q}
                                </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {frequentPrompts.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600/60 mb-1.5">Most Asked</p>
                              <div className="flex flex-wrap gap-2">
                                {frequentPrompts.map((q) => (
                                <button
                                  key={q}
                                  onClick={() => { setInput(q); setShowSuggestions(false); textareaRef.current?.focus(); }}
                                  className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-all font-medium"
                                >
                                  {q}
                                </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
                {renderInputBox()}
                <p className="text-[10px] text-center text-slate-400 mt-3 font-medium tracking-tighter">Confidential · AI-Powered Intelligence System · XYZ Bank Internal Use Only</p>
              </div>
            </footer>
          </>
        )}
      </main>
    </div>
  );
};

export default ChatPage;