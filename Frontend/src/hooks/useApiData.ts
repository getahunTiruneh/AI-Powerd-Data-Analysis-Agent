import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "./useApi";

function getData(result: any) {
  if (!result) return null;
  if (Array.isArray(result)) return result;
  if (result.data !== undefined) return result.data;
  return result;
}

// ===== Profiles =====
export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const profilesRes = await apiFetch("/admin/profiles");
      if (profilesRes.error) throw profilesRes.error;
      const profilesData = getData(profilesRes.data) || [];
      return profilesData.map((p: any) => ({
        ...p,
        role: p.role || 'business_user',
        assignedDataMarts: []
      }));
    },
  });
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const profileRes = await apiFetch(`/admin/profiles/${userId}`);
      if (profileRes.error) throw profileRes.error;
      const profileData = getData(profileRes.data);
      return profileData;
    },
  });
}

export function useUpdateProfileStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const { error } = await apiFetch(`/admin/profiles/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }),
  });
}

export function usePromoteToAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await apiFetch(`/admin/profiles/${userId}/promote-to-admin`, {
        method: "POST",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("User promoted to admin");
    },
  });
}

// ===== Data Marts (Tables in data_mart schema) =====
export interface DataMartRow {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  status?: string;
  size?: string;
  column_count?: number;
  columns?: any[];
}

// Get actual data mart definitions from database
export function useDataMartList() {
  return useQuery({
    queryKey: ["data_mart_list"],
    queryFn: async () => {
      const { data, error } = await apiFetch("/admin/data-marts/list");
      if (error) throw error;
      return getData(data) as DataMartRow[];
    },
  });
}

function getUserRole(): string | null {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || null;
  } catch {
    return null;
  }
}

export function useDataMarts() {
  return useQuery({
    queryKey: ["data_marts"],
    queryFn: async () => {
      const role = getUserRole();
      const endpoint = role === 'admin' ? "/admin/data-marts/list" : "/admin/data-marts/assigned";
      const { data, error } = await apiFetch(endpoint);
      
      if (error) {
        if (error.includes("401") || error.includes("No token")) {
          return [];
        }
        throw error;
      }
      
      const resultData = data?.data || data || [];
      return resultData as DataMartRow[];
    },
  });
}

export function useDataMart(tableName: string | undefined) {
  return useQuery({
    queryKey: ["data_mart", tableName],
    enabled: !!tableName,
    queryFn: async () => {
      const { data, error } = await apiFetch(`/admin/data-marts/${tableName}`);
      if (error) throw error;
      const resultData = data?.data || data;
      return resultData as DataMartRow;
    },
  });
}

export function useDeleteDataMart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tableName: string) => {
      const { error } = await apiFetch(`/admin/data-marts/${tableName}`, {
        method: "DELETE",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["data_marts"] });
      toast.success("Table deleted from data mart");
    },
  });
}

// ===== Assignments =====
export function useAssignments(userId?: string, userRole?: string) {
  return useQuery({
    queryKey: ["assignments", userId],
    queryFn: async () => {
      const endpoint = userRole === 'business_user' ? '/assignments/my' : `/admin/assignments${userId ? `?user_id=${userId}` : ''}`;
      const q = await apiFetch(endpoint);
      if (q.error) throw q.error;
      const resultData = getData(q.data);
      return resultData || [];
    },
  });
}

// Get all assignments (admin)
export function useAllAssignments() {
  return useQuery({
    queryKey: ["all_assignments"],
    queryFn: async () => {
      const { data, error } = await apiFetch("/admin/assignments");
      if (error) throw error;
      return getData(data) || [];
    },
  });
}

// Get all messages (admin)
export function useAllMessages() {
  return useQuery({
    queryKey: ["all_messages"],
    queryFn: async () => {
      const { data, error } = await apiFetch("/messages");
      if (error) throw error;
      return getData(data) || [];
    },
  });
}

export function useAssignDataMart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, dataMartId }: { userId: string; dataMartId: string }) => {
      const { error } = await apiFetch("/admin/assignments", {
        method: "POST",
        body: JSON.stringify({ user_id: userId, data_mart_id: dataMartId }),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });
}

export function useUnassignDataMart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, dataMartId }: { userId: string; dataMartId: string }) => {
      const { error } = await apiFetch(`/admin/assignments?user_id=${userId}&schema_name=${dataMartId}`, {
        method: "DELETE",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments"] }),
  });
}

// ===== Analytics =====
export function useAnalytics() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const { data, error } = await apiFetch("/admin/analytics");
      if (error) throw error;
      const resultData = getData(data);
      return resultData;
    },
  });
}

// ===== Logs =====
export function useLogs(level?: string, source?: string, search?: string) {
  return useQuery({
    queryKey: ["logs", level, source, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (level && level !== 'all') params.append('level', level);
      if (source && source !== 'all') params.append('source', source);
      if (search) params.append('search', search);
      const query = params.toString() ? `?${params.toString()}` : '';
      const { data, error } = await apiFetch(`/admin/logs${query}`);
      if (error) throw error;
      const resultData = getData(data);
      return resultData;
    },
  });
}

// ===== Conversations =====
export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await apiFetch("/conversations");
      if (error) throw error;
      const resultData = getData(data);
      return resultData || [];
    },
  });
}

export function useConversationStats() {
  return useQuery({
    queryKey: ["conversation_stats"],
    queryFn: async () => {
      const { data, error } = await apiFetch("/admin/conversation-stats");
      if (error) throw error;
      return getData(data) || [];
    },
  });
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: ["conversation", id],
    enabled: !!id,
    retry: (failureCount, error: any) => failureCount < 2 && !error?.message?.includes("404"),
    queryFn: async () => {
      const { data, error } = await apiFetch(`/conversations/${id}`);
      if (error) throw error;
      return getData(data);
    },
  });
}

export function useConversationMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["conversation_messages", conversationId],
    enabled: !!conversationId,
    retry: (failureCount, error: any) => failureCount < 2 && !error?.message?.includes("404"),
    queryFn: async () => {
      const { data, error } = await apiFetch(`/conversations/${conversationId}/messages`);
      if (error) throw error;
      const resultData = getData(data);
      return resultData || [];
    },
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, dataMartId, title }: { userId?: string; dataMartId?: string; title?: string }) => {
      const { data, error } = await apiFetch("/conversations", {
        method: "POST",
        body: JSON.stringify({ 
          user_id: userId,
          data_mart_id: dataMartId,
          title: title || 'New Conversation'
        }),
      });
      if (error) throw error;
      return getData(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useSaveMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, role, content }: { conversationId: string; role: string; content: string }) => {
      const { data, error } = await apiFetch(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ role, content }),
      });
      if (error) throw error;
      return getData(data);
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["conversation_messages", variables.conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title, bookmarked }: { id: string; title?: string; bookmarked?: boolean }) => {
      const { data, error } = await apiFetch(`/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title, bookmarked }),
      });
      if (error) throw error;
      return getData(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiFetch(`/conversations/${id}`, {
        method: "DELETE",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Conversation deleted");
    },
  });
}

export function useToggleBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, bookmarked }: { id: string; bookmarked: boolean }) => {
      const { data, error } = await apiFetch(`/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ bookmarked }),
      });
      if (error) throw error;
      return getData(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useCreateDataMart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, description, icon, db_type, connection_config }: { 
      name: string; 
      description?: string; 
      icon?: string;
      db_type?: string;
      connection_config?: any;
    }) => {
      const { data, error } = await apiFetch("/admin/data-marts", {
        method: "POST",
        body: JSON.stringify({ 
          name: name.toLowerCase().replace(/\s+/g, '_'),
          description,
          icon: icon || '📊',
          db_type,
          connection_config,
        }),
      });
      if (error) throw error;
      return getData(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["data_marts"] });
      toast.success("Data mart created successfully");
    },
  });
}

// ===== Audit Logs =====
export interface AuditLog {
  id: string;
  level: string;
  source: string;
  message: string;
  status: 'success' | 'failed' | 'warning';
  userName: string;
  userEmail?: string;
  userId?: string;
  role?: string;
  ip?: string;
  userAgent?: string;
  location?: string;
  action: string;
  dataMartName?: string;
  details?: any;
  requestId?: string;
  sessionId?: string;
  createdAt: string;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  level?: string;
  source?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
}

export function useAuditLogs(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: ["audit_logs", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
      if (filters.level) params.append('level', filters.level);
      if (filters.source) params.append('source', filters.source);
      if (filters.search) params.append('search', filters.search);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.userId) params.append('userId', filters.userId);

      const { data, error } = await apiFetch(`/admin/audit-logs?${params.toString()}`);
      if (error) throw error;
      return data;
    },
  });
}

export function useAuditLogSources() {
  return useQuery({
    queryKey: ["audit_log_sources"],
    queryFn: async () => {
      const { data, error } = await apiFetch("/admin/audit-logs/sources");
      if (error) throw error;
      return getData(data) || [];
    },
  });
}

export function useAuditLogDetail(id: string) {
  return useQuery({
    queryKey: ["audit_log", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await apiFetch(`/admin/audit-logs/${id}`);
      if (error) throw error;
      return getData(data);
    },
  });
}

export function useAuditSecuritySummary() {
  return useQuery({
    queryKey: ["audit_security_summary"],
    queryFn: async () => {
      const { data, error } = await apiFetch("/admin/audit-logs/security/summary");
      if (error) throw error;
      return getData(data);
    },
  });
}

export function useExportAuditLogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (filters: Partial<AuditLogFilters> & { format?: 'csv' | 'json' }) => {
      const params = new URLSearchParams();
      if (filters.format) params.append('format', filters.format);
      if (filters.level) params.append('level', filters.level);
      if (filters.source) params.append('source', filters.source);
      if (filters.search) params.append('search', filters.search);

      const { data, error } = await apiFetch(`/admin/audit-logs/export?${params.toString()}`);
      if (error) throw error;
      return data;
    },
  });
}

export function useDeleteAuditLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiFetch(`/admin/audit-logs/${id}`, { method: "DELETE" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audit_logs"] });
      qc.invalidateQueries({ queryKey: ["audit_security_summary"] });
      toast.success("Audit log deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete log");
    },
  });
}
