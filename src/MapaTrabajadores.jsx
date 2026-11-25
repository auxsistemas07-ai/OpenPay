import { useCallback, useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Tooltip, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from './api'
import { TILES_URL, ATRIBUCION } from './MapaVentas'

const ACTUALIZAR_MS = 15000
const utc = (d) => (d && !d.endsWith('Z') ? d + 'Z' : d)
const hora = (d) => (d ? new Date(utc(d)).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—')
const hoyMx = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

export const ESTADOS = {
  activo: { nombre: 'En turno', color: '#16a34a' },
  'sin-senal': { nombre: 'Sin señal', color: '#d97706' },
  'fuera-de-turno': { nombre: 'Fuera de turno', color: '#9ca3af' },
}

// Ícono propio (SVG): pin con silueta de persona, del color del estado.
const svgTrabajador = (color) =>
  '<svg viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">' +
  `<path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>` +
  `<circle cx="16" cy="16" r="11" fill="#fff"/><circle cx="16" cy="12.5" r="3.6" fill="${color}"/>` +
  `<path d="M9.5 23.5c0-4 2.9-6.6 6.5-6.6s6.5 2.6 6.5 6.6z" fill="${color}"/></svg>`
const ICONOS = Object.fromEntries(Object.entries(ESTADOS).map(([k, v]) =>
  [k, L.divIcon({ html: svgTrabajador(v.color), className: 'icono-mapa', iconSize: [30, 39], iconAnchor: [15, 39], popupAnchor: [0, -35] })]))

export function IconoTrabajador({ estado }) {
  // SVG estático definido arriba (no viene del usuario).
  return <span className="icono-leyenda" dangerouslySetInnerHTML={{ __html: svgTrabajador(ESTADOS[estado].color) }} />
}

/** Ajusta la vista a los trabajadores o al recorrido elegido. */
function Encuadre({ puntos, clave }) {
  const map = useMap()
  useEffect(() => {
    if (puntos.length === 1) map.setView(puntos[0], 15)
    else if (puntos.length > 1) map.fitBounds(puntos, { padding: [40, 40], maxZoom: 16 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, map])
  return null
}

const COLORES_TURNO = ['#2563eb', '#7c3aed', '#db2777']

export default function MapaTrabajadores() {
  const [lista, setLista] = useState([])
  const [error, setError] = useState('')
  const [elegido, setElegido] = useState(null)
  const [dia, setDia] = useState(hoyMx())
  const [recorrido, setRecorrido] = useState(null)

  const cargar = useCallback(() => api.trabajadores().then((l) => { setLista(l); setError('') }).catch((e) => setError(e.message)), [])
  useEffect(() => {
    cargar()
    const t = setInterval(cargar, ACTUALIZAR_MS)
    return () => clearInterval(t)
  }, [cargar])

  useEffect(() => {
    if (!elegido) { setRecorrido(null); return }
    api.recorrido(elegido, dia).then(setRecorrido).catch((e) => setError(e.message))
  }, [elegido, dia])

  const conUbicacion = lista.filter((t) => t.lat != null)
  const cuenta = (e) => lista.filter((t) => t.estado === e).length
  const puntosRecorrido = recorrido?.turnos.flatMap((t) => t.puntos.map((p) => [p.lat, p.lng])) ?? []
  const encuadre = elegido ? puntosRecorrido : conUbicacion.map((t) => [t.lat, t.lng])

  return (
    <section>
      <div className="fila">
        <h2>Mapa de trabajadores</h2>
        <button className="secundario" onClick={cargar}>Actualizar</button>
      </div>
      {error && <p className="alerta error">{error}</p>}

      <div className="kpis">
        {Object.entries(ESTADOS).map(([k, v]) => (
          <div key={k} className="card kpi"><small><IconoTrabajador estado={k} /> {v.nombre}</small><strong>{cuenta(k)}</strong></div>
        ))}
      </div>

      {elegido && recorrido && (
        <div className="capas">
          <span>Recorrido de <strong>{recorrido.nombre}</strong></span>
          <label className="check">Día <input type="date" value={dia} max={hoyMx()} onChange={(e) => setDia(e.target.value)} /></label>
          <span className="muted">{puntosRecorrido.length} punto(s) en {recorrido.turnos.length} turno(s)</span>
          <button className="mini secundario" onClick={() => setElegido(null)}>Ver todos</button>
        </div>
      )}

      <MapContainer className="mapa" center={[23.6, -102.5]} zoom={5} scrollWheelZoom>
        <TileLayer url={TILES_URL} attribution={ATRIBUCION} maxZoom={19} />
        {!elegido && conUbicacion.map((t) => (
          <Marker key={t.id} position={[t.lat, t.lng]} icon={ICONOS[t.estado]}>
            <Tooltip direction="top" offset={[0, -34]}>{t.nombre}</Tooltip>
            <Popup>
              <div className="info-zona">
                <small className="muted">{ESTADOS[t.estado].nombre}</small>
                <strong>{t.nombre}</strong>
                <small>Turno desde {hora(t.inicioTurno)} · última señal {hora(t.ultimaUbicacion)}</small>
                {t.precisionMetros != null && <small>Precisión ± {t.precisionMetros} m</small>}
                <button className="mini" onClick={() => setElegido(t.id)}>Ver recorrido</button>
              </div>
            </Popup>
          </Marker>
        ))}
        {elegido && recorrido?.turnos.map((tu, i) => {
          const linea = tu.puntos.map((p) => [p.lat, p.lng])
          const color = COLORES_TURNO[i % COLORES_TURNO.length]
          return (
            <Polyline key={tu.id} positions={linea} pathOptions={{ color, weight: 4, opacity: 0.85 }}>
              <Tooltip sticky>Turno {hora(tu.inicio)} – {tu.fin ? hora(tu.fin) : 'en curso'}</Tooltip>
            </Polyline>
          )
        })}
        {elegido && recorrido?.turnos.map((tu) => tu.puntos.length > 0 && (
          [tu.puntos[0], tu.puntos[tu.puntos.length - 1]].map((p, j) => (
            <CircleMarker key={`${tu.id}-${j}`} center={[p.lat, p.lng]} radius={7}
              pathOptions={{ color: '#fff', weight: 2, fillColor: j === 0 ? '#16a34a' : '#dc2626', fillOpacity: 1 }}>
              <Tooltip>{j === 0 ? 'Inicio' : 'Último punto'} · {hora(p.fecha)}</Tooltip>
            </CircleMarker>
          ))
        ))}
        <Encuadre puntos={encuadre} clave={`${elegido}-${dia}-${encuadre.length > 0}`} />
      </MapContainer>
      {elegido && puntosRecorrido.length === 0 && <p className="muted nota">Sin ubicaciones registradas ese día.</p>}

      <h3 className="subtitulo">Trabajadores</h3>
      {lista.length === 0 ? (
        <p className="muted">Aún no hay usuarios con rol trabajador.</p>
      ) : (
        <div className="tabla">
          <table>
            <thead><tr><th>Trabajador</th><th>Estado</th><th>Turno desde</th><th>Última señal</th><th>Precisión</th><th></th></tr></thead>
            <tbody>
              {lista.map((t) => (
                <tr key={t.id} className={elegido === t.id ? 'sel' : ''}>
                  <td><strong>{t.nombre}</strong></td>
                  <td><span className="estado-trabajador"><IconoTrabajador estado={t.estado} /> {ESTADOS[t.estado].nombre}</span></td>
                  <td>{hora(t.inicioTurno)}</td>
                  <td>{hora(t.ultimaUbicacion)}</td>
                  <td>{t.precisionMetros != null ? `± ${t.precisionMetros} m` : '—'}</td>
                  <td><button className="mini secundario" onClick={() => setElegido(t.id)}>Ver recorrido</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted nota">Solo se ve la ubicación de quien tiene su turno abierto. Se actualiza cada 15 segundos.</p>
    </section>
  )
}
