import { Fragment, useCallback, useEffect, useState } from 'react'
import { api, moneda, fecha } from './api'
import Auth from './Auth'
import MapaVentas from './MapaVentas'
import MapaTrabajadores from './MapaTrabajadores'
import MiTurno from './MiTurno'
import './App.css'

function Catalogo({ onComprar }) {
  const [productos, setProductos] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    api.productos().then(setProductos).catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="alerta error">No se pudo cargar el catálogo: {error}</p>

  return (
    <section>
      <h2>Catálogo</h2>
      <div className="grid">
        {productos.map((p) => (
          <article key={p.id} className="card producto">
            <span className="sku">{p.sku}</span>
            <h3>{p.nombre}</h3>
            <p className="muted">{p.descripcion}</p>
            <div className="fila">
              <strong className="precio">{moneda(p.precio)}</strong>
              <button onClick={() => onComprar(p)}>Comprar</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Checkout({ producto, sesion, onCancelar, onPagado }) {
  const [form, setForm] = useState({ cantidad: 1, metodoPago: 'spei' })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const enviar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError('')
    try {
      const pedido = await api.crearPedido({ ...form, cantidad: Number(form.cantidad), productoId: producto.id })
      onPagado(pedido)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="card checkout">
      <h2>Checkout</h2>
      <p className="muted">
        {producto.nombre} · {moneda(producto.precio)} c/u
      </p>
      <form onSubmit={enviar}>
        <p className="comprador">Comprando como <strong>{sesion.nombre}</strong> <span className="muted">({sesion.email})</span></p>
        <label>
          Cantidad
          <input type="number" min={1} max={10} value={form.cantidad} onChange={set('cantidad')} />
        </label>

        <fieldset>
          <legend>¿Cómo quieres pagar?</legend>
          <label className={`opcion ${form.metodoPago === 'spei' ? 'activa' : ''}`}>
            <input type="radio" name="metodo" value="spei" checked={form.metodoPago === 'spei'} onChange={set('metodoPago')} />
            <span>
              <strong>Transferencia SPEI</strong>
              <small>Desde la app de tu banco a una CLABE</small>
            </span>
          </label>
          <label className={`opcion ${form.metodoPago === 'tienda' ? 'activa' : ''}`}>
            <input type="radio" name="metodo" value="tienda" checked={form.metodoPago === 'tienda'} onChange={set('metodoPago')} />
            <span>
              <strong>Pago en tienda</strong>
              <small>En efectivo con referencia y código de barras</small>
            </span>
          </label>
        </fieldset>

        <div className="total">
          Total: <strong>{moneda(producto.precio * (Number(form.cantidad) || 0))}</strong>
        </div>
        {error && <p className="alerta error">{error}</p>}
        <div className="fila">
          <button type="button" className="secundario" onClick={onCancelar}>Cancelar</button>
          <button type="submit" disabled={enviando}>{enviando ? 'Generando ficha…' : 'Generar ficha de pago'}</button>
        </div>
      </form>
    </section>
  )
}

function Copiable({ valor }) {
  const [ok, setOk] = useState(false)
  return (
    <span className="copiable">
      <code>{valor}</code>
      <button
        type="button"
        className="mini"
        onClick={() => navigator.clipboard.writeText(valor).then(() => { setOk(true); setTimeout(() => setOk(false), 1500) })}
      >
        {ok ? 'Copiado' : 'Copiar'}
      </button>
    </span>
  )
}

function FichaPago({ pedido, esAdmin, onCerrar }) {
  const f = pedido.ficha
  if (!f) return null
  const spei = f.metodo === 'spei'
  return (
    <section className="card ficha">
      <div className="fila">
        <h2>Ficha de pago {spei ? 'SPEI' : 'en tienda'}</h2>
        <Estado estado={pedido.estado} />
      </div>
      <p className="monto">{moneda(f.monto)}</p>
      <dl>
        <dt>Pedido</dt><dd>{pedido.folio}</dd>
        {spei ? (
          <>
            <dt>Banco</dt><dd>{f.banco || '—'}</dd>
            <dt>CLABE</dt><dd>{f.clabe ? <Copiable valor={f.clabe} /> : '—'}</dd>
            <dt>Concepto / ref.</dt><dd>{f.beneficiario ? <Copiable valor={f.beneficiario} /> : '—'}</dd>
          </>
        ) : (
          <>
            <dt>Referencia</dt><dd>{f.referencia ? <Copiable valor={f.referencia} /> : '—'}</dd>
          </>
        )}
        <dt>Vence</dt><dd>{fecha(f.fechaVencimiento)}</dd>
        <dt>Cargo Openpay</dt><dd className="muted">{f.openpayChargeId}</dd>
      </dl>
      {!spei && f.codigoBarrasUrl && (
        <div className="barcode">
          <img src={f.codigoBarrasUrl} alt={`Código de barras ${f.referencia}`} />
        </div>
      )}
      <p className="muted nota">
        {spei
          ? 'Transfiere el monto exacto a la CLABE desde tu banca en línea. El pedido se marcará como pagado cuando Openpay confirme el depósito.'
          : 'Presenta la referencia o el código de barras en una tienda participante y paga en efectivo el monto exacto.'}
      </p>
      <div className="fila">
        <button className="secundario" onClick={() => window.print()}>Imprimir</button>
        <button onClick={onCerrar}>{esAdmin ? 'Volver a pedidos' : 'Ver mis pedidos'}</button>
      </div>
    </section>
  )
}

function Estado({ estado }) {
  return <span className={`badge ${estado}`}>{estado === 'pagado' ? 'Pagado' : 'Pendiente'}</span>
}

function Pedidos({ onVerFicha, esAdmin }) {
  const [pedidos, setPedidos] = useState([])
  const [error, setError] = useState('')
  const [verificando, setVerificando] = useState(null)

  const cargar = useCallback(() => {
    api.pedidos().then((p) => { setPedidos(p); setError('') }).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 10000)
    return () => clearInterval(t)
  }, [cargar])

  const verificar = async (id) => {
    setVerificando(id)
    try {
      await api.verificarPedido(id)
      cargar()
    } catch (e) {
      setError(e.message)
    } finally {
      setVerificando(null)
    }
  }

  return (
    <section>
      <div className="fila">
        <h2>{esAdmin ? 'Todos los pedidos' : 'Mis pedidos'}</h2>
        <button className="secundario" onClick={cargar}>Actualizar</button>
      </div>
      {error && <p className="alerta error">{error}</p>}
      {pedidos.length === 0 ? (
        <p className="muted">{esAdmin ? 'Aún no hay pedidos.' : 'Aún no tienes pedidos. Elige un producto del catálogo.'}</p>
      ) : (
        <div className="tabla">
          <table>
            <thead>
              <tr>
                <th>Folio</th>{esAdmin && <th>Cliente</th>}<th>Producto</th><th>Método</th><th>Monto</th><th>Creado</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id}>
                  <td><code>{p.folio}</code></td>
                  {esAdmin && <td>{p.clienteNombre}<br /><small className="muted">{p.clienteEmail}</small></td>}
                  <td>{p.cantidad} × {p.producto}</td>
                  <td>{p.metodoPago === 'spei' ? 'SPEI' : 'Tienda'}</td>
                  <td>{moneda(p.monto)}</td>
                  <td>{fecha(p.fechaCreacion + (p.fechaCreacion.endsWith('Z') ? '' : 'Z'))}</td>
                  <td><Estado estado={p.estado} /></td>
                  <td className="acciones">
                    <button className="mini" onClick={() => onVerFicha(p)}>Ficha</button>
                    {p.estado !== 'pagado' && (
                      <button className="mini secundario" disabled={verificando === p.id} onClick={() => verificar(p.id)}>
                        {verificando === p.id ? '…' : 'Verificar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const referenciaDe = (p) =>
  p.ficha ? (p.ficha.metodo === 'spei' ? `CLABE ${p.ficha.clabe ?? '—'}` : `Ref. ${p.ficha.referencia ?? '—'}`) : '—'

function Usuarios({ onVerFicha }) {
  const [usuarios, setUsuarios] = useState([])
  const [abierto, setAbierto] = useState(null)
  const [pedidos, setPedidos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [hallazgo, setHallazgo] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.usuarios().then(setUsuarios).catch((e) => setError(e.message))
  }, [])

  const abrir = async (id) => {
    if (abierto === id) return setAbierto(null)
    setAbierto(id)
    setPedidos([])
    try { setPedidos(await api.pedidosDeUsuario(id)) } catch (e) { setError(e.message) }
  }

  const buscar = async (e) => {
    e.preventDefault()
    setHallazgo(null)
    setError('')
    if (!busqueda.trim()) return
    try { setHallazgo(await api.buscarReferencia(busqueda.trim())) }
    catch { setHallazgo({ noEncontrado: true }) }
  }

  return (
    <section>
      <h2>Clientes</h2>
      <form className="card buscador" onSubmit={buscar}>
        <label>
          ¿De quién es esta referencia?
          <div className="fila">
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Referencia de tienda, id de cargo Openpay o folio" />
            <button type="submit">Buscar</button>
          </div>
        </label>
        {hallazgo?.noEncontrado && <p className="alerta error">No se encontró ninguna referencia con ese valor.</p>}
        {hallazgo?.usuario && (
          <p className="alerta ok">
            Pertenece a <strong>{hallazgo.usuario.nombre}</strong> ({hallazgo.usuario.email}) · pedido{' '}
            <code>{hallazgo.pedido.folio}</code> · {moneda(hallazgo.pedido.monto)} · <Estado estado={hallazgo.pedido.estado} />
          </p>
        )}
      </form>

      {error && <p className="alerta error">{error}</p>}
      {usuarios.length === 0 ? (
        <p className="muted">Aún no hay clientes registrados.</p>
      ) : (
        <div className="tabla">
          <table>
            <thead>
              <tr><th>Usuario</th><th>Pedidos</th><th>Pagado</th><th>Pendiente</th><th>Alta</th><th></th></tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <Fragment key={u.id}>
                  <tr>
                    <td><strong>{u.nombre}</strong>{!u.tieneCuenta && <span className="badge sin-cuenta">sin cuenta</span>}<br /><small className="muted">{u.email}</small></td>
                    <td>{u.totalPedidos} <small className="muted">({u.pagados} pagados · {u.pendientes} pendientes)</small></td>
                    <td>{moneda(u.montoPagado)}</td>
                    <td>{moneda(u.montoPendiente)}</td>
                    <td>{fecha(u.fechaCreacion + (u.fechaCreacion.endsWith('Z') ? '' : 'Z'))}</td>
                    <td><button className="mini secundario" onClick={() => abrir(u.id)}>{abierto === u.id ? 'Ocultar' : 'Ver referencias'}</button></td>
                  </tr>
                  {abierto === u.id && (
                    <tr className="detalle">
                      <td colSpan={6}>
                        {pedidos.length === 0 ? <span className="muted">Cargando…</span> : (
                          <ul className="referencias">
                            {pedidos.map((p) => (
                              <li key={p.id}>
                                <code>{p.folio}</code> · {p.producto} · {moneda(p.monto)} · {referenciaDe(p)} · <Estado estado={p.estado} />{' '}
                                <button className="mini" onClick={() => onVerFicha(p)}>Ficha</button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function App() {
  // Permite abrir directo una vista: ?vista=pedidos o ?producto=1 (checkout)
  const params = new URLSearchParams(window.location.search)
  const [vista, setVista] = useState(['pedidos', 'usuarios', 'mapa', 'trabajadores', 'turno'].includes(params.get('vista')) ? params.get('vista') : 'catalogo')
  const [producto, setProducto] = useState(null)
  const [pedido, setPedido] = useState(null)
  const [sesion, setSesion] = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [modoAuth, setModoAuth] = useState(params.get('modo') === 'registro' ? 'registro' : 'login')

  const ir = (v) => { setVista(v); setProducto(null); setPedido(null) }
  const esAdmin = sesion?.rol === 'admin'
  const esTrabajador = sesion?.rol === 'trabajador'
  const inicio = (u) => (u?.rol === 'admin' ? 'pedidos' : u?.rol === 'trabajador' ? 'turno' : 'catalogo')

  useEffect(() => {
    // Recupera la sesión si ya existe la cookie (401 = sin sesión).
    api.yo().then((u) => { setSesion(u); if (u.rol !== 'cliente' && !params.get('vista')) setVista(inicio(u)) }).catch(() => setSesion(null)).finally(() => setCargandoSesion(false))
    // Si cualquier petición responde 401 (sesión vencida), se regresa al login.
    const expirada = () => { setSesion(null); setProducto(null); setPedido(null) }
    window.addEventListener('sesion-expirada', expirada)
    return () => window.removeEventListener('sesion-expirada', expirada)
  }, [])

  useEffect(() => {
    if (!sesion) return
    const id = Number(params.get('producto'))
    if (id) api.productos().then((ps) => setProducto(ps.find((p) => p.id === id) ?? null)).catch(() => {})
    const pedidoId = Number(params.get('pedido'))
    if (pedidoId) api.pedidos().then((ps) => setPedido(ps.find((p) => p.id === pedidoId) ?? null)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion])

  const cerrarSesion = async () => {
    await api.logout().catch(() => {})
    setSesion(null)
    ir('catalogo')
  }

  if (cargandoSesion) return <div className="app"><p className="muted">Cargando…</p></div>

  // Sin sesión no se muestra nada más que el login / registro.
  if (!sesion) {
    return (
      <div className="app">
        <header>
          <h1>Tienda de prueba <span className="tag">Openpay sandbox</span></h1>
        </header>
        <main>
          <Auth modo={modoAuth} setModo={setModoAuth} onSesion={(u) => { setSesion(u); ir(inicio(u)) }} />
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <h1>Tienda de prueba <span className="tag">Openpay sandbox</span></h1>
        <nav>
          {esAdmin ? (
            <>
              <button className={vista === 'pedidos' ? 'tab activa' : 'tab'} onClick={() => ir('pedidos')}>Pedidos</button>
              <button className={vista === 'usuarios' ? 'tab activa' : 'tab'} onClick={() => ir('usuarios')}>Clientes</button>
              <button className={vista === 'mapa' ? 'tab activa' : 'tab'} onClick={() => ir('mapa')}>Mapa de ventas</button>
              <button className={vista === 'trabajadores' ? 'tab activa' : 'tab'} onClick={() => ir('trabajadores')}>Trabajadores</button>
            </>
          ) : esTrabajador ? (
            <button className="tab activa" onClick={() => ir('turno')}>Mi turno</button>
          ) : (
            <>
              <button className={vista === 'catalogo' ? 'tab activa' : 'tab'} onClick={() => ir('catalogo')}>Catálogo</button>
              <button className={vista === 'pedidos' ? 'tab activa' : 'tab'} onClick={() => ir('pedidos')}>Mis pedidos</button>
            </>
          )}
        </nav>
        <div className="sesion">
          <span>Hola, <strong>{sesion.nombre.split(' ')[0]}</strong>{esAdmin && <span className="tag admin">Administrador</span>}{esTrabajador && <span className="tag admin">Trabajador</span>}</span>
          <button className="secundario mini" onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      </header>
      <main>
        {esTrabajador ? (
          <MiTurno />
        ) : pedido ? (
          <FichaPago pedido={pedido} esAdmin={esAdmin} onCerrar={() => ir('pedidos')} />
        ) : producto && !esAdmin ? (
          <Checkout producto={producto} sesion={sesion} onCancelar={() => setProducto(null)} onPagado={(p) => { setProducto(null); setPedido(p) }} />
        ) : vista === 'catalogo' && !esAdmin ? (
          <Catalogo onComprar={setProducto} />
        ) : vista === 'mapa' && esAdmin ? (
          <MapaVentas />
        ) : vista === 'trabajadores' && esAdmin ? (
          <MapaTrabajadores />
        ) : vista === 'usuarios' && esAdmin ? (
          <Usuarios onVerFicha={setPedido} />
        ) : (
          <Pedidos onVerFicha={setPedido} esAdmin={esAdmin} />
        )}
      </main>
    </div>
  )
}
