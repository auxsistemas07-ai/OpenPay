import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { api, fecha } from './api'
import { TILES_URL, ATRIBUCION } from './MapaVentas'

// Cada cuánto se manda la ubicación al servidor (el backend acepta máx. 6 por minuto).
const INTERVALO_MS = 30000
const utc = (d) => (d && !d.endsWith('Z') ? d + 'Z' : d)

function Seguir({ pos }) {
  const map = useMap()
  useEffect(() => { if (pos) map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 16)) }, [pos, map])
  return null
}

/** Pantalla del trabajador (teléfono de trabajo): iniciar / terminar turno y compartir ubicación mientras dure. */
export default function MiTurno() {
  const [turno, setTurno] = useState(undefined) // undefined = cargando, null = sin turno
  const [pos, setPos] = useState(null)
  const [enviadas, setEnviadas] = useState(0)
  const [ultimoEnvio, setUltimoEnvio] = useState(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const ultimaPos = useRef(null)

  const cargar = useCallback(() => api.turnoActual().then((t) => setTurno(t ?? null)).catch((e) => { setTurno(null); setError(e.message) }), [])
  useEffect(() => { cargar() }, [cargar])

  const activo = !!turno && !turno.fin

  // Mientras el turno está activo: escucha el GPS y manda la última lectura cada 30 s.
  useEffect(() => {
    if (!activo) return
    if (!('geolocation' in navigator) || !window.isSecureContext) {
      setError('Este navegador no permite usar el GPS. La página debe abrirse con https.')
      return
    }
    const enviar = async () => {
      const p = ultimaPos.current
      if (!p) return
      try {
        await api.enviarUbicacion({ latitud: p.lat, longitud: p.lng, precisionMetros: p.precision, fechaLectura: p.fecha })
        setEnviadas((n) => n + 1); setUltimoEnvio(new Date()); setError('')
      } catch (e) { setError(e.message) }
    }
    let primera = true
    const watch = navigator.geolocation.watchPosition(
      (g) => {
        const p = { lat: +g.coords.latitude.toFixed(6), lng: +g.coords.longitude.toFixed(6), precision: Math.round(g.coords.accuracy), fecha: new Date(g.timestamp).toISOString() }
        ultimaPos.current = p
        setPos(p)
        if (primera) { primera = false; enviar() }
      },
      (e) => setError(e.code === 1 ? 'Permiso de ubicación denegado. Actívalo en el navegador para este sitio.' : 'No se pudo obtener la ubicación del GPS.'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 })
    const t = setInterval(enviar, INTERVALO_MS)

    // Evita que la pantalla se apague: en la versión web, con pantalla bloqueada el navegador deja de enviar.
    let bloqueo = null
    const pedirPantalla = () => navigator.wakeLock?.request('screen').then((b) => { bloqueo = b }).catch(() => {})
    pedirPantalla()
    const alVolver = () => { if (document.visibilityState === 'visible') pedirPantalla() }
    document.addEventListener('visibilitychange', alVolver)

    return () => {
      navigator.geolocation.clearWatch(watch)
      clearInterval(t)
      document.removeEventListener('visibilitychange', alVolver)
      bloqueo?.release().catch(() => {})
    }
  }, [activo])

  const iniciar = async () => {
    setOcupado(true); setError('')
    try { setTurno(await api.iniciarTurno()); setEnviadas(0); setUltimoEnvio(null) } catch (e) { setError(e.message) } finally { setOcupado(false) }
  }
  const terminar = async () => {
    setOcupado(true); setError('')
    try { await api.terminarTurno(); setTurno(null); setPos(null); ultimaPos.current = null } catch (e) { setError(e.message) } finally { setOcupado(false) }
  }

  if (turno === undefined) return <p className="muted">Cargando…</p>

  return (
    <section className="mi-turno">
      <div className="fila">
        <h2>Mi turno</h2>
        <span className={`badge ${activo ? 'pagado' : 'pendiente'}`}>{activo ? 'En turno' : 'Fuera de turno'}</span>
      </div>

      {activo ? (
        <>
          <div className="kpis">
            <div className="card kpi"><small>Inicio</small><strong>{fecha(utc(turno.inicio))}</strong></div>
            <div className="card kpi"><small>Ubicaciones enviadas</small><strong>{(turno.ubicaciones ?? 0) + enviadas}</strong></div>
            <div className="card kpi"><small>Último envío</small><strong>{ultimoEnvio ? ultimoEnvio.toLocaleTimeString('es-MX') : '—'}</strong></div>
          </div>
          <MapContainer className="mapa mapa-turno" center={pos ? [pos.lat, pos.lng] : [23.6, -102.5]} zoom={pos ? 16 : 5}>
            <TileLayer url={TILES_URL} attribution={ATRIBUCION} maxZoom={19} />
            {pos && <Circle center={[pos.lat, pos.lng]} radius={pos.precision} pathOptions={{ color: '#16a34a', weight: 1, fillOpacity: 0.12 }} />}
            {pos && <CircleMarker center={[pos.lat, pos.lng]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#16a34a', fillOpacity: 1 }} />}
            <Seguir pos={pos} />
          </MapContainer>
          <p className="muted nota">
            {pos ? `GPS: ${pos.lat}, ${pos.lng} (± ${pos.precision} m). ` : 'Buscando señal de GPS… '}
            Tu ubicación se comparte cada 30 segundos solo mientras el turno está activo. Mantén esta pantalla abierta.
          </p>
          {error && <p className="alerta error">{error}</p>}
          <button className="peligro grande" disabled={ocupado} onClick={terminar}>{ocupado ? '…' : 'Terminar turno'}</button>
        </>
      ) : (
        <div className="card turno-inicio">
          <p>Al iniciar tu turno, este teléfono de trabajo compartirá su ubicación con el administrador cada 30 segundos. Al terminarlo deja de compartirla.</p>
          {error && <p className="alerta error">{error}</p>}
          <button className="grande" disabled={ocupado} onClick={iniciar}>{ocupado ? 'Iniciando…' : 'Iniciar turno'}</button>
        </div>
      )}
    </section>
  )
}
