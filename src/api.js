// En localhost se llama directo al backend. Desde otro dominio (p. ej. el teléfono por ngrok)
// se usa la misma dirección de la página y Vite reenvía /api al backend (ver vite.config.js).
const enLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname)
const API_URL = enLocal ? (import.meta.env.VITE_API_URL ?? 'http://localhost:5088') : ''

async function request(path, options = {}) {
  const resp = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // envía la cookie de sesión (HttpOnly)
    ...options,
  })
  const data = resp.status === 204 ? null : await resp.json().catch(() => null)
  if (!resp.ok) {
    // Sesión vencida o inexistente: avisa a la app para mostrar el login (excepto en login y /yo).
    if (resp.status === 401 && !path.startsWith('/api/auth/')) window.dispatchEvent(new Event('sesion-expirada'))
    if (resp.status === 429 && !data) throw Object.assign(new Error('Demasiados intentos. Espera un minuto e inténtalo de nuevo.'), { status: 429 })
    const errores = data?.errors && Object.values(data.errors).flat().join(' ')
    const detalle = errores || data?.detail || data?.title
    throw Object.assign(new Error(detalle || `Error ${resp.status}`), { status: resp.status })
  }
  return data
}

export const api = {
  productos: () => request('/api/productos'),
  pedidos: () => request('/api/pedidos'),
  crearPedido: (pedido) => request('/api/pedidos', { method: 'POST', body: JSON.stringify(pedido) }),
  verificarPedido: (id) => request(`/api/pedidos/${id}/verificar`, { method: 'POST' }),
  usuarios: () => request('/api/usuarios'),
  pedidosDeUsuario: (id) => request(`/api/usuarios/${id}/pedidos`),
  buscarReferencia: (valor) => request(`/api/usuarios/por-referencia/${encodeURIComponent(valor)}`),

  geocodificarPendientes: () => request('/api/admin/geocodificar-pendientes', { method: 'POST' }),
  capasMapa: (incluirPendientes) => request(`/api/admin/ventas-mapa/capas?incluirPendientes=${incluirPendientes}`),
  ventasMapa: (agrupar, incluirPendientes) => request(`/api/admin/ventas-mapa?agrupar=${agrupar}&incluirPendientes=${incluirPendientes}`),

  // Trabajador (teléfono de trabajo)
  turnoActual: () => request('/api/turno'),
  iniciarTurno: () => request('/api/turno/iniciar', { method: 'POST' }),
  terminarTurno: () => request('/api/turno/terminar', { method: 'POST' }),
  enviarUbicacion: (u) => request('/api/turno/ubicacion', { method: 'POST', body: JSON.stringify(u) }),
  // Admin: mapa de trabajadores
  trabajadores: () => request('/api/admin/trabajadores'),
  recorrido: (id, fecha) => request(`/api/admin/trabajadores/${id}/recorrido?fecha=${fecha}`),

  // Auth
  registro: (datos) => request('/api/auth/registro', { method: 'POST', body: JSON.stringify(datos) }),
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  yo: () => request('/api/auth/yo'),
}

export const moneda = (n) =>
  Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

export const fecha = (d) =>
  d ? new Date(d).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
