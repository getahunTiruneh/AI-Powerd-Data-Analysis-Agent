const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getToken() {
  return localStorage.getItem('token');
}

export async function apiFetch(path: string, options: RequestInit & { timeout?: number } = {}) {
  const token = getToken();
  const timeoutMs = options.timeout ?? 120000; // default 120s
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  
  // Handle custom signal if provided
  const signal = controller.signal;
  if (options.signal) {
    const customSignal = options.signal;
    if (customSignal.aborted) {
      controller.abort();
    } else {
      customSignal.addEventListener('abort', () => {
        controller.abort();
      });
    }
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      signal,
    });
    clearTimeout(id);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return { data, error: null };
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      if (options.signal?.aborted) {
        return { data: null, error: 'Request aborted' };
      }
      return { data: null, error: `Request timed out after ${timeoutMs / 1000}s` };
    }
    return { data: null, error: err.message || 'An error occurred' };
  }
}
