import { useCallback, useEffect, useState } from 'react';

export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch {
    throw new Error('Não foi possível conectar à API do Nexo. Confira se o servidor está em execução.');
  }
  const payload = await parseApiResponse(response);
  if (response.status === 401 && path !== '/api/auth/me') {
    window.dispatchEvent(new CustomEvent('nexo:session-expired'));
  }
  if (!response.ok) throw new Error(payload.message || 'Não foi possível concluir a solicitação.');
  return payload;
}

export async function parseApiResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('A API do Nexo não respondeu corretamente. Verifique a conexão com o servidor.');
  }
  try {
    return await response.json();
  } catch {
    throw new Error('A API do Nexo retornou uma resposta inválida. Tente novamente.');
  }
}

export async function fetchAllRecords(path, request = apiRequest, pageSize = 200) {
  const safePageSize = Math.max(1, Math.min(200, Math.floor(Number(pageSize) || 200)));
  const queryPage = (offset) => `${path}${path.includes('?') ? '&' : '?'}limit=${safePageSize}&offset=${offset}`;
  const firstPage = await request(queryPage(0));
  // Treat malformed or stale API payloads as an empty list. A bad row should
  // never take down an entire workspace screen inside React's error boundary.
  const rawFirstRecords = Array.isArray(firstPage.data) ? firstPage.data : [];
  const firstRecords = rawFirstRecords.filter(isWorkspaceRecord);
  const total = Number(firstPage.pagination?.total);
  if (!Number.isFinite(total) || total <= rawFirstRecords.length) return firstRecords;
  const records = [...firstRecords];
  const actualPageSize = Math.max(1, Number(firstPage.pagination?.limit) || safePageSize);
  const firstOffset = Math.max(0, Number(firstPage.pagination?.offset) || 0);
  for (let offset = firstOffset + rawFirstRecords.length; offset < total; offset += actualPageSize) {
    const page = await request(queryPage(offset));
    if (Array.isArray(page.data)) records.push(...page.data.filter(isWorkspaceRecord));
  }
  return records.slice(0, total);
}

function isWorkspaceRecord(record) {
  return record !== null && typeof record === 'object' && !Array.isArray(record);
}

export function useWorkspaceRecords(resource) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    try { const result = await fetchAllRecords(`/api/workspace/${resource}`); setRecords(result); setError(''); }
    catch (err) { setError(err.message || 'Falha ao carregar os dados.'); }
    finally { setLoading(false); }
  }, [resource]);
  useEffect(() => { refresh(); }, [refresh]);
  const create = useCallback(async (data) => {
    const result = await apiRequest(`/api/workspace/${resource}`, { method: 'POST', body: JSON.stringify({ data }) });
    setRecords((current) => [result.data, ...current]);
    return result.data;
  }, [resource]);
  const update = useCallback(async (id, data) => {
    const result = await apiRequest(`/api/workspace/${resource}/${id}`, { method: 'PATCH', body: JSON.stringify({ data }) });
    setRecords((current) => current.map((item) => item.id === id ? result.data : item));
    return result.data;
  }, [resource]);
  const remove = useCallback(async (id) => {
    await apiRequest(`/api/workspace/${resource}/${id}`, { method: 'DELETE' });
    setRecords((current) => current.filter((item) => item.id !== id));
  }, [resource]);
  return { records, loading, error, refresh, create, update, remove, setRecords };
}
