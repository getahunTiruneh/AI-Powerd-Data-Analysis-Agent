import { motion } from "framer-motion";
import { MessageSquare, Clock, Bookmark, Search, Trash2, Pencil, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useConversations, useDeleteConversation, useToggleBookmark } from "@/hooks/useApiData";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/hooks/useApi";

const HistoryPage = () => {
  const { data: conversations = [], isLoading } = useConversations();
  const deleteConv = useDeleteConversation();
  const toggleBookmark = useToggleBookmark();
  const [search, setSearch] = useState("");
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const navigate = useNavigate();

  const filtered = conversations.filter((c: any) => {
    const matchSearch = c.title?.toLowerCase().includes(search.toLowerCase());
    const matchBookmark = !showBookmarked || c.bookmarked;
    return matchSearch && matchBookmark;
  });

  const handleRename = async (id: string) => {
    if (!renameValue.trim() || renameValue.trim().length < 2) {
      toast.error("Title must be at least 2 characters");
      return;
    }
    setIsRenaming(true);
    try {
      await apiFetch(`/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: renameValue.trim() }),
      });
      toast.success("Conversation renamed");
      setRenamingId(null);
      setRenameValue("");
    } catch {
      toast.error("Failed to rename");
    } finally {
      setIsRenaming(false);
    }
  };

  const formatDate = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
    return new Date(d).toLocaleDateString();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Chat History</h1>
          <p className="text-muted-foreground text-sm">Review and revisit your previous analyses</p>
        </div>
        <Button variant={showBookmarked ? "default" : "outline"} size="sm" onClick={() => setShowBookmarked(!showBookmarked)}>
          <Bookmark className="h-4 w-4 mr-1" /> Bookmarked
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search conversations..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No conversations found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((chat: any, i: number) => (
            <motion.div
              key={chat.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/chat?conversationId=${chat.id}`)}
              className="flex items-center gap-4 rounded-xl border bg-card p-4 hover:border-primary/30 transition-colors cursor-pointer group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium truncate">{chat.title}</h3>
                  {chat.bookmarked && <Bookmark className="h-3.5 w-3.5 text-accent fill-accent shrink-0" />}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {chat.data_mart_name && <Badge variant="secondary" className="text-xs">{chat.data_mart_name}</Badge>}
                  <span className="text-xs text-muted-foreground">{chat.chat_messages?.[0]?.count || 0} messages</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatDate(chat.updated_at)}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {renamingId === chat.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="h-8 w-40"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(chat.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-chart-green"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRename(chat.id);
                      }}
                      disabled={isRenaming}
                    >
                      {isRenaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingId(chat.id);
                        setRenameValue(chat.title);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-accent"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark.mutate({ id: chat.id, bookmarked: !chat.bookmarked });
                      }}
                    >
                      <Bookmark className={`h-4 w-4 ${chat.bookmarked ? "fill-accent" : ""}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConv.mutate(chat.id);
                        toast.success("Conversation deleted");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
