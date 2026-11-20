// Tiny API client
async function req(method, url, body, headers = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  health: () => req('GET', '/api/health'),
  children: () => req('GET', '/api/children'),
  child: (id) => req('GET', `/api/children/${id}`),
  createChild: (data) => req('POST', '/api/children', data),
  updateChild: (id, data, currentPin) => req('PATCH', `/api/children/${id}`, currentPin === undefined ? data : { ...data, currentPin }),
  verifyPin: (id, pin) => req('POST', `/api/children/${id}/verify-pin`, { pin }),
  deleteChild: (id, pin) => req('DELETE', `/api/children/${id}`, { pin }),
  deleteData: (id, pin) => req('DELETE', `/api/children/${id}/data`, { pin }),
  dashboard: (id, pin, range = 'all') => req('GET', `/api/children/${id}/dashboard?range=${encodeURIComponent(range)}`, null, { 'x-parent-pin': pin || '' }),
  startSession: (childId, lang) => req('POST', '/api/sessions', { childId, lang }),
  say: (sessionId, text, source) => req('POST', `/api/sessions/${sessionId}/say`, { text, source }),
  scene: (sessionId, scene) => req('POST', `/api/sessions/${sessionId}/scene`, { scene }),
  endSession: (sessionId) => req('POST', `/api/sessions/${sessionId}/end`),
  stickers: (id) => req('GET', `/api/children/${id}/stickers`),
  mlStatus: () => req('GET', '/api/ml/status'),
  unclear: (id, pin) => req('GET', `/api/children/${id}/unclear`, null, { 'x-parent-pin': pin || '' }),
  teach: (id, pin, text, intent) => req('POST', `/api/children/${id}/teach`, { pin, text, intent }),
  retrain: (id, pin) => req('POST', `/api/children/${id}/retrain`, { pin }),
};
