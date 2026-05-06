// ============================================================
// SGIAC-ISC | services/api.js
// Centraliza todas las llamadas al backend
// ============================================================

const API = (() => {

  // ── Obtener usuario desde sessionStorage (aislado por pestaña) ──
  function _getStoredUser() {
    try { return JSON.parse(sessionStorage.getItem("user")) || null; }
    catch { return null; }
  }

  // ── Helper de request con cabecera x-user-id automática ────
  async function request(url, options = {}) {
    const user = _getStoredUser();

    const baseHeaders = { "Content-Type": "application/json" };
    if (user?.id) baseHeaders["x-user-id"] = user.id;

    // Spread options primero, luego sobreescribir headers con los combinados
    const { headers: _h, ...restOptions } = options;
    const res = await fetch(url, {
      ...restOptions,
      headers: { ...baseHeaders, ...(_h || {}) },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw { status: res.status, message: err.error || err.message || "Error del servidor" };
    }
    return res.json();
  }

  // ── AUTH ──────────────────────────────────────────────────
  const auth = {
    login:    (email, password) => request("/api/auth/login",    { method: "POST", body: JSON.stringify({ email, password }) }),
    register: (data)            => request("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
    recover:  (email)           => request("/api/auth/recover",  { method: "POST", body: JSON.stringify({ email }) }),

    // Guarda la sesión en sessionStorage (una pestaña = una sesión)
    saveSession(user) {
      sessionStorage.setItem("user", JSON.stringify(user));
    },

    // Limpia solo esta pestaña
    clearSession() {
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("session");
    },

    // Verifica que el usuario almacenado siga siendo válido en el backend
    async revalidate() {
      const user = _getStoredUser();
      if (!user?.id) return null;
      try {
        // El middleware requireAuth leerá x-user-id y devolverá el usuario
        const result = await request("/api/auth/me");
        return result.user || null;
      } catch {
        // Si 401 → sesión inválida, limpiar
        auth.clearSession();
        return null;
      }
    }
  };

  // ── ASSETS ───────────────────────────────────────────────
  const assets = {
    getAll:   ()        => request("/api/assets"),
    getById:  (id)      => request(`/api/assets/${id}`),
    getSummary: ()      => request("/api/assets/summary"),
    getLogs:  (id)      => request(`/api/assets/${id}/logs`),
    create:   (data)    => request("/api/assets",     { method: "POST",   body: JSON.stringify(data) }),
    update:   (id, data)=> request(`/api/assets/${id}`,{ method: "PUT",   body: JSON.stringify(data) }),
    remove:   (id)      => request(`/api/assets/${id}`,{ method: "DELETE" }),
  };

  // ── CATEGORIES ───────────────────────────────────────────
  const categories = {
    getAll:        () => request("/api/categories"),
    getAssets:     () => request("/api/categories/assets"),
    getConsumables:() => request("/api/categories/consumables"),
  };

  // ── CONSUMIBLES ──────────────────────────────────────────
  const consumibles = {
    getAll:   ()         => request("/api/consumibles"),
    getById:  (id)       => request(`/api/consumibles/${id}`),
    create:   (data)     => request("/api/consumibles",      { method: "POST",   body: JSON.stringify(data) }),
    update:   (id, data) => request(`/api/consumibles/${id}`,{ method: "PUT",    body: JSON.stringify(data) }),
    remove:   (id)       => request(`/api/consumibles/${id}`,{ method: "DELETE" }),
  };

  // ── USERS ────────────────────────────────────────────────
  const users = {
    getAll:   ()         => request("/api/users"),
    getById:  (id)       => request(`/api/users/${id}`),
    create:   (data)     => request("/api/users",      { method: "POST",   body: JSON.stringify(data) }),
    update:   (id, data) => request(`/api/users/${id}`,{ method: "PUT",    body: JSON.stringify(data) }),
    remove:   (id)       => request(`/api/users/${id}`,{ method: "DELETE" }),
  };

  // ── REQUESTS (solicitudes) ────────────────────────────────
  const requests = {
    getAll:   (filters = {}) => request("/api/requests?" + new URLSearchParams(filters)),
    getById:  (id)           => request(`/api/requests/${id}`),
    create:   (data)         => request("/api/requests",              { method: "POST", body: JSON.stringify(data) }),
    approve:  (id, data)     => request(`/api/requests/${id}/approve`,{ method: "PUT",  body: JSON.stringify(data) }),
    reject:   (id, data)     => request(`/api/requests/${id}/reject`, { method: "PUT",  body: JSON.stringify(data) }),
    return:   (id, data)     => request(`/api/requests/${id}/return`, { method: "PUT",  body: JSON.stringify(data) }),
    update:   (id, data)     => request(`/api/requests/${id}`,        { method: "PUT",  body: JSON.stringify(data) }),
    remove:   (id)           => request(`/api/requests/${id}`,        { method: "DELETE" }),
  };

  // ── RESERVATIONS ─────────────────────────────────────────
  const reservations = {
    getAll:   (filters = {}) => request("/api/reservations?" + new URLSearchParams(filters)),
    getById:  (id)           => request(`/api/reservations/${id}`),
    create:   (data)         => request("/api/reservations",                { method: "POST", body: JSON.stringify(data) }),
    approve:  (id, data)     => request(`/api/reservations/${id}/approve`,  { method: "PUT",  body: JSON.stringify(data) }),
    occupy:   (id)           => request(`/api/reservations/${id}/occupy`,   { method: "PUT",  body: JSON.stringify({}) }),
    release:  (id, data)     => request(`/api/reservations/${id}/release`,  { method: "PUT",  body: JSON.stringify(data) }),
    cancel:   (id, data)     => request(`/api/reservations/${id}/cancel`,   { method: "PUT",  body: JSON.stringify(data) }),
    remove:   (id)           => request(`/api/reservations/${id}`,          { method: "DELETE" }),
  };

  // ── STATS ────────────────────────────────────────────────
  const stats = {
    getAll: () => request("/api/stats"),
  };

  // ── LABS ─────────────────────────────────────────────────
  const labs = {
    getAll: () => request("/api/labs"),
  };

  return { auth, assets, categories, consumibles, users, requests, reservations, stats, labs };

})();