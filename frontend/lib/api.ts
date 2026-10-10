type NoticeKind = 'error' | 'success' | 'info';

export function notify(message: string, kind: NoticeKind = 'info') {
  if (!message) message = 'The action could not be completed. Please try again.';
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('poms-notice', { detail: { message, kind } }));
  }
}

export function clearSession() {
  for (const key of ['token', 'role_id', 'reset_token']) localStorage.removeItem(key);
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const pendingWrites = new Set<string>();

// Keep the Response interface so existing page-specific validation stays intact.
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const isWrite = !['GET', 'HEAD'].includes(method);
  const key = `${method}:${url}`;
  if (isWrite && pendingWrites.has(key)) throw new Error('This action is still being processed. Please wait.');
  if (isWrite) pendingWrites.add(key);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30000);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (response.ok) return response; // Excel downloads return binary data.
      throw new Error('The server is unavailable or returned an unexpected response. Please try again.');
    }
    let data;
    try { data = await response.clone().json(); }
    catch { throw new Error('The server returned an unreadable response. Please try again.'); }
    if (!response.ok) {
      const message = data.error || 'The request failed. Please try again.';
      if (response.status === 401 && new Headers(options.headers).has('Authorization') && !url.includes('/auth/setup-password')) {
        clearSession();
        window.location.replace('/login?expired=1');
      } else if (!isWrite) {
        notify(message, 'error');
      }
    }
    return response;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    const message = controller.signal.aborted
      ? 'The request timed out. Please try again.'
      : error instanceof TypeError
        ? 'Cannot connect to the server. Please check your connection and try again.'
        : errorMessage(error, 'The request failed. Please try again.');
    notify(message, 'error');
    throw new Error(message);
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
    if (isWrite) pendingWrites.delete(key);
  }
}
