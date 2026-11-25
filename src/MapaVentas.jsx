import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api, moneda } from './api'

// Fuente de las imágenes del mapa. Por defecto, los servidores públicos de OpenStreetMap
// (solo para desarrollo/bajo tráfico). En producción se cambia por un proveedor o servidor propio
// con VITE_MAPA_TILES_URL y VITE_MAPA_ATRIBUCION, sin tocar código.
export const TILES_URL = import.meta.env.VITE_MAPA_TILES_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const ATRIBUCION = import.meta.env.VITE_MAPA_ATRIBUCION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const CENTRO_MX = [23.6, -102.5]

const nombreZona = (z) => (z.ciudad ? `${z.ciudad}, ${z.estado}` : z.estado)

// ---- Íconos (SVG propio, sin servicios externos) ----
const PIN = 'M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z'
const GLIFOS = {
  // estrella = estado
  estado: '<path d="M16 7.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L16 20.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="COLOR"/>',
  // edificios = ciudad
  ciudad: '<path d="M9 23V12h6v11zm8 0V8.5h6V23z" fill="COLOR"/><path d="M11 14h2v2h-2zm0 4h2v2h-2zm8-7h2v2h-2zm0 4h2v2h-2zm0 4h2v2h-2z" fill="#fff"/>',
  // casa = domicilio
  domicilio: '<path d="M16 7.5l-8.5 7.2h2.4V23h4.6v-5.2h3V23h4.6v-8.3h2.4z" fill="COLOR"/>',
}
export const CAPAS = {
  estado: { nombre: 'Estado', color: '#1d4ed8', ancho: 38 },
  ciudad: { nombre: 'Ciudad', color: '#059669', ancho: 31 },
  domicilio: { nombre: 'Domicilio (cliente)', color: '#ea580c', ancho: 25 },
}
const svgIcono = (tipo) => {
  const { color } = CAPAS[tipo]
  return `<svg viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg"><path d="${PIN}" fill="${color}" stroke="#fff" stroke-width="1.5"/>` +
    `<circle cx="16" cy="16" r="11" fill="#fff"/>${GLIFOS[tipo].replaceAll('COLOR', color)}</svg>`
}
const ICONOS = Object.fromEntries(Object.keys(CAPAS).map((tipo) => {
  const w = CAPAS[tipo].ancho
  const h = Math.round(w * 42 / 32)
  return [tipo, L.divIcon({ html: svgIcono(tipo), className: 'icono-mapa', iconSize: [w, h], iconAnchor: [w / 2, h], popupAnchor: [0, -h + 4] })]
}))

export function IconoLeyenda({ tipo }) {
  // SVG estático definido arriba (no viene del usuario).
  return <span className="icono-leyenda" dangerouslySetInnerHTML={{ __html: svgIcono(tipo) }} />
}

/** Centra el mapa en la zona elegida desde el ranking. */
function Enfocar({ zona }) {
  const map = useMap()
  useEffect(() => {
    if (zona?.lat != null) map.flyTo([zona.lat, zona.lng], Math.max(map.getZoom(), 7), { duration: 0.6 })
  }, [zona, map])
  return null
}

function Punto({ p }) {
  return (
    <Marker position={[p.lat, p.lng]} icon={ICONOS[p.tipo]} zIndexOffset={{ estado: 0, ciudad: 500, domicilio: 1000 }[p.tipo]}>
      <Tooltip direction="top" offset={[0, -CAPAS[p.tipo].ancho]}>{p.titulo}: {moneda(p.monto)}</Tooltip>
      <Popup>
        <div className="info-zona">
          <small className="muted">{CAPAS[p.tipo].nombre}</small>
          <strong>{p.titulo}</strong>
          {p.subtitulo && <small>{p.subtitulo}</small>}
          <div>{moneda(p.monto)} · {p.pedidos} pedido(s)</div>
          <small>{p.pagados} pagado(s) · {moneda(p.montoPagado)}</small>
        </div>
      </Popup>
    </Marker>
  )
}

function Mapa({ capas, visibles, seleccion }) {
  return (
    <MapContainer className="mapa" center={CENTRO_MX} zoom={5} scrollWheelZoom>
      <TileLayer url={TILES_URL} attribution={ATRIBUCION} maxZoom={19} />
      {visibles.estado && capas?.estados.map((p) => <Punto key={`e-${p.titulo}-${p.subtitulo}`} p={p} />)}
      {visibles.ciudad && capas?.ciudades.map((p) => <Punto key={`c-${p.titulo}-${p.subtitulo}`} p={p} />)}
      {visibles.domicilio && capas?.domicilios.map((p, i) => <Punto key={`d-${i}-${p.titulo}`} p={p} />)}
      <Enfocar zona={seleccion} />
    </MapContainer>
  )
}

export default function MapaVentas() {
  const [agrupar, setAgrupar] = useState('estado')
  const [incluirPendientes, setIncluirPendientes] = useState(false)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [seleccion, setSeleccion] = useState(null)
  const [capas, setCapas] = useState(null)
  const [visibles, setVisibles] = useState({ estado: true, ciudad: true, domicilio: true })
  const [ubicando, setUbicando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [recarga, setRecarga] = useState(0)

  // Ubica (máx. 20 por clic, 1 por segundo) las direcciones que aún no tienen coordenadas exactas.
  const ubicarPendientes = async () => {
    setUbicando(true); setAviso('')
    try {
      const r = await api.geocodificarPendientes()
      setAviso(`Se revisaron ${r.revisadas} dirección(es); ${r.geocodificadas} quedaron ubicadas.`)
      setRecarga((n) => n + 1)
    } catch (e) { setError(e.message) } finally { setUbicando(false) }
  }

  useEffect(() => {
    setSeleccion(null)
    api.ventasMapa(agrupar, incluirPendientes).then(setDatos).catch((e) => setError(e.message))
  }, [agrupar, incluirPendientes, recarga])

  useEffect(() => {
    api.capasMapa(incluirPendientes).then(setCapas).catch((e) => setError(e.message))
  }, [incluirPendientes, recarga])

  const zonas = datos?.zonas ?? []
  const top = zonas[0]
  const max = Math.max(...zonas.map((z) => z.monto), 1)

  return (
    <section>
      <div className="fila">
        <h2>Mapa de ventas</h2>
        <div className="controles">
          <div className="segmentado">
            <button className={agrupar === 'estado' ? 'activa' : ''} onClick={() => setAgrupar('estado')}>Por estado</button>
            <button className={agrupar === 'ciudad' ? 'activa' : ''} onClick={() => setAgrupar('ciudad')}>Por ciudad</button>
          </div>
          <label className="check">
            <input type="checkbox" checked={incluirPendientes} onChange={(e) => setIncluirPendientes(e.target.checked)} />
            Incluir pendientes
          </label>
        </div>
      </div>

      {error && <p className="alerta error">{error}</p>}

      <div className="kpis">
        <div className="card kpi"><small>{incluirPendientes ? 'Monto (pagado + pendiente)' : 'Vendido (pagado)'}</small><strong>{moneda(datos?.totalMonto ?? 0)}</strong></div>
        <div className="card kpi"><small>Pedidos</small><strong>{datos?.totalPedidos ?? 0}</strong></div>
        <div className="card kpi"><small>Zona con más ventas</small><strong>{top ? nombreZona(top) : '—'}</strong></div>
      </div>

      <div className="capas">
        <span className="muted">Capas:</span>
        {Object.entries(CAPAS).map(([tipo, c]) => (
          <label key={tipo} className="check">
            <input type="checkbox" checked={visibles[tipo]} onChange={(e) => setVisibles({ ...visibles, [tipo]: e.target.checked })} />
            <IconoLeyenda tipo={tipo} /> {c.nombre}
            <small className="muted">({{ estado: capas?.estados, ciudad: capas?.ciudades, domicilio: capas?.domicilios }[tipo]?.length ?? 0})</small>
          </label>
        ))}
      </div>
      <Mapa capas={capas} visibles={visibles} seleccion={seleccion} />
      {capas?.clientesSinDomicilioExacto > 0 && visibles.domicilio && (
        <p className="muted nota fila">
          <span>{capas.clientesSinDomicilioExacto} cliente(s) no aparecen en la capa Domicilio porque su dirección aún no se ubica con exactitud (sí cuentan en Estado y Ciudad).</span>
          <button className="mini secundario" disabled={ubicando} onClick={ubicarPendientes}>{ubicando ? 'Ubicando… (1 por segundo)' : 'Ubicar direcciones pendientes'}</button>
        </p>
      )}
      {aviso && <p className="alerta ok">{aviso}</p>}

      <h3 className="subtitulo">Ranking {agrupar === 'ciudad' ? 'por ciudad' : 'por estado'}</h3>
      {zonas.length === 0 ? (
        <p className="muted">
          {incluirPendientes ? 'Aún no hay pedidos con dirección.' : 'Aún no hay ventas pagadas. Activa “Incluir pendientes” para ver todos los pedidos.'}
        </p>
      ) : (
        <div className="tabla">
          <table>
            <thead>
              <tr><th>#</th><th>{agrupar === 'ciudad' ? 'Ciudad' : 'Estado'}</th><th>Pedidos</th><th>Monto</th><th className="barra-col"></th></tr>
            </thead>
            <tbody>
              {zonas.map((z, i) => (
                <tr key={nombreZona(z)} className={seleccion && nombreZona(seleccion) === nombreZona(z) ? 'sel' : ''} onClick={() => setSeleccion(z)}>
                  <td>{i + 1}</td>
                  <td>{nombreZona(z)} <small className="muted">{z.pais}</small></td>
                  <td>{z.pedidos} <small className="muted">({z.pagados} pagados)</small></td>
                  <td>{moneda(z.monto)}</td>
                  <td className="barra-col"><div className="barra" style={{ width: `${(100 * z.monto) / max}%` }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {datos?.pedidosSinUbicacion > 0 && (
        <p className="muted nota">{datos.pedidosSinUbicacion} pedido(s) de clientes sin dirección registrada no aparecen en el mapa.</p>
      )}
      {zonas.some((z) => z.precision === 'estado') && (
        <p className="muted nota">Algunas zonas están ubicadas de forma aproximada en la capital de su estado (la dirección no se pudo ubicar con exactitud).</p>
      )}
    </section>
  )
}
