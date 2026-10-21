import { useState, useCallback, useRef, useEffect } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const API_URL = `${API_BASE}/chat/stream`;

export function useStreamChat() {
  const [isStreaming, setIsStreaming] = useState(false);
  const activeControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
      activeControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }
    };
  }, []);

  const streamChat = useCallback(
    async ({
      messages,
      dataMartId,
      selectedMart,
      fileData,
      onDelta,
      onDone,
      onError,
    }: {
      messages: Msg[];
      dataMartId: string;
      selectedMart?: { id: string; name: string };
      fileData?: { name: string; data: any[]; headers: string[] };
      onDelta: (text: string) => void;
      onDone: () => void;
      onError: (err: string) => void;
    }) => {
      setIsStreaming(true);

      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }

      const controller = new AbortController();
      activeControllerRef.current = controller;

      const timeoutId = setTimeout(() => controller.abort(), 180000);

      try {
        const token = localStorage.getItem('token');

        const resp = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            messages,
            dataMartId,
            fileData: fileData ? {
              name: String(fileData.name),
              headers: fileData.headers || [],
              data: fileData.data || [],
              totalRows: fileData.data ? fileData.data.length : 0
            } : null
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (controller.signal.aborted) {
          throw new DOMException("Request aborted", "AbortError");
        }

        if (!resp.ok) {
          const errBody = await resp.json().catch(() => ({}));
          onError(errBody.error || `Error ${resp.status}`);
          setIsStreaming(false);
          return;
        }

        const reader = resp.body?.getReader();
        if (!reader) {
          onError("No response stream");
          setIsStreaming(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (controller.signal.aborted) {
            throw new DOMException("Request aborted", "AbortError");
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const payload = trimmed.slice(6);
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.token) {
                onDelta(parsed.token);
              } else if (parsed.error) {
                onError(parsed.error);
                setIsStreaming(false);
                return;
              } else if (parsed.done) {
                // stream complete
              }
            } catch {}
          }
        }

        onDone();
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          onError("Request cancelled");
        } else {
          onError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (activeControllerRef.current === controller) {
          activeControllerRef.current = null;
        }
        setIsStreaming(false);
      }
    },
    []
  );

  return { streamChat, isStreaming, abort };
}