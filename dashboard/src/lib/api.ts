const API_BASE = 'http://localhost:4001/api';

export interface Module {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  created_at: string;
}

export interface Url {
  id: string;
  module_id: string | null;
  url: string;
  name: string | null;
  is_active: boolean;
  credential_id: string | null;
  auth_url: string | null;
  auth_username: string | null;
  auth_password: string | null;
  auth_username_selector: string | null;
  auth_password_selector: string | null;
  auth_submit_selector: string | null;
  created_at: string;
}

export interface Credential {
  id: string;
  name: string;
  auth_url: string | null;
  username: string;
  password: string;
  username_selector: string | null;
  password_selector: string | null;
  submit_selector: string | null;
  created_at: string;
}

export interface Audit {
  id: string;
  url_id: string;
  performance_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  seo_score: number | null;
  pwa_score: number | null;
  screenshot_path: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface Suggestion {
  id: string;
  audit_id: string;
  category: string;
  audit_ref: string | null;
  title: string;
  description: string | null;
  score: number | null;
  savings_ms: number;
  savings_bytes: number;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  
  return res.json();
}

// Modules
export async function getModules(): Promise<Module[]> {
  return fetchApi<Module[]>('/modules');
}

export async function addModule(name: string, description?: string, color?: string): Promise<Module> {
  return fetchApi<Module>('/modules', {
    method: 'POST',
    body: JSON.stringify({ name, description, color }),
  });
}

export async function updateModule(id: string, updates: Partial<Module>): Promise<Module> {
  return fetchApi<Module>(`/modules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteModule(id: string): Promise<void> {
  await fetchApi(`/modules/${id}`, { method: 'DELETE' });
}

// Credentials
export async function getCredentials(): Promise<Credential[]> {
  return fetchApi<Credential[]>('/credentials');
}

export interface AddCredentialParams {
  name: string;
  auth_url?: string;
  username: string;
  password: string;
  username_selector?: string;
  password_selector?: string;
  submit_selector?: string;
}

export async function addCredential(params: AddCredentialParams): Promise<Credential> {
  return fetchApi<Credential>('/credentials', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateCredential(id: string, updates: Partial<AddCredentialParams>): Promise<Credential> {
  return fetchApi<Credential>(`/credentials/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteCredential(id: string): Promise<void> {
  await fetchApi(`/credentials/${id}`, { method: 'DELETE' });
}

// URLs
export async function getUrls(): Promise<Url[]> {
  return fetchApi<Url[]>('/urls');
}

export interface AddUrlParams {
  url: string;
  module_id: string;
  name?: string;
  credential_id?: string;
  auth_url?: string;
  auth_username?: string;
  auth_password?: string;
  auth_username_selector?: string;
  auth_password_selector?: string;
  auth_submit_selector?: string;
}

export async function addUrl(params: AddUrlParams): Promise<Url> {
  return fetchApi<Url>('/urls', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateUrl(id: string, updates: Partial<Url>): Promise<Url> {
  return fetchApi<Url>(`/urls/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteUrl(id: string): Promise<void> {
  await fetchApi(`/urls/${id}`, { method: 'DELETE' });
}

// Audits
export async function getAudits(urlId?: string): Promise<Audit[]> {
  const query = urlId ? `?url_id=${urlId}` : '';
  return fetchApi<Audit[]>(`/audits${query}`);
}

export async function getLatestAudits(): Promise<(Audit & { url: Url })[]> {
  return fetchApi<(Audit & { url: Url })[]>('/audits/latest');
}

export async function getAuditHistory(urlId: string): Promise<Audit[]> {
  return fetchApi<Audit[]>(`/audits/${urlId}/history`);
}

export async function getSuggestions(auditId: string): Promise<Suggestion[]> {
  return fetchApi<Suggestion[]>(`/suggestions/${auditId}`);
}

// Run Audit
export async function runAudit(urlId?: string, moduleId?: string): Promise<{ message: string; urls: string[] }> {
  return fetchApi('/audit/run', {
    method: 'POST',
    body: JSON.stringify({ url_id: urlId, module_id: moduleId }),
  });
}

export interface UrlProgress {
  id: string;
  url: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  scores?: {
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
    pwa: number | null;
  };
  error?: string;
}

export interface AuditStatus {
  inProgress: boolean;
  total: number;
  completed: number;
  currentUrl: string;
  urls: UrlProgress[];
}

export async function getAuditStatus(): Promise<AuditStatus> {
  return fetchApi<AuditStatus>('/audit/status');
}

// Get full Lighthouse report
export async function getFullReport(auditId: string): Promise<object> {
  return fetchApi<object>(`/audits/${auditId}/report`);
}

// Screenshot URL helper
export function getScreenshotUrl(path: string | null): string | null {
  if (!path) return null;
  return `http://localhost:4001${path}`;
}
