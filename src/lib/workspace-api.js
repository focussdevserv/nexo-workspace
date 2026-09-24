import { useCallback, useEffect, useState } from 'react';

export async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('nexo:session-expired'));
  }
  if (!response.ok) throw new Error(payload.message || 'Não foi possível concluir a solicitação.');
  return payload;
}

export function useWorkspaceRecords(resource) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    try { const result = await apiRequest(`/api/workspace/${resource}`); setRecords(result.data || []); setError(''); }
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
