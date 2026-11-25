import { useState } from 'react'
import { api } from './api'

const ESTADOS_MX = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua',
  'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero',
  'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla',
  'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas',
  'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
]

const PAISES = [
  { codigo: 'MX', nombre: 'México' },
  { codigo: 'US', nombre: 'Estados Unidos' },
  { codigo: 'CO', nombre: 'Colombia' },
  { codigo: 'PE', nombre: 'Perú' },
]

const reglasPassword = (p, email) => [
  { ok: p.length >= 8, texto: 'Mínimo 8 caracteres' },
  { ok: /[A-Z]/.test(p), texto: 'Una mayúscula' },
  { ok: /[a-z]/.test(p), texto: 'Una minúscula' },
  { ok: /\d/.test(p), texto: 'Un número' },
  {
    ok: (() => { const u = email.split('@')[0]; return !(u.length >= 4 && p.toLowerCase().includes(u.toLowerCase())) })(),
    texto: 'Que no contenga tu correo',
  },
]

function Login({ onSesion, irARegistro }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError('')
    try {
      onSesion(await api.login(email, password))
    } catch (err) {
      setError(err.message)
      setPassword('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="card auth">
      <h2>Iniciar sesión</h2>
      <form onSubmit={enviar}>
        <label>
          Correo
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Contraseña
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="alerta error">{error}</p>}
        <button type="submit" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <p className="muted cambio">
        ¿No tienes cuenta? <button type="button" className="link" onClick={irARegistro}>Regístrate</button>
      </p>
    </section>
  )
}

function Registro({ onSesion, irALogin }) {
  const [f, setF] = useState({
    nombre: '', email: '', telefono: '', password: '', confirmar: '',
    pais: 'MX', estado: '', ciudad: '', colonia: '', calle: '', numeroExterior: '', numeroInterior: '', codigoPostal: '', referencias: '',
  })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const reglas = reglasPassword(f.password, f.email)
  const passwordOk = reglas.every((r) => r.ok)
  const coinciden = f.password && f.password === f.confirmar

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    if (!passwordOk) return setError('La contraseña no cumple los requisitos.')
    if (!coinciden) return setError('Las contraseñas no coinciden.')
    if (f.pais === 'MX' && !/^\d{5}$/.test(f.codigoPostal)) return setError('El código postal debe tener 5 dígitos.')
    setEnviando(true)
    try {
      const usuario = await api.registro({
        nombre: f.nombre,
        email: f.email,
        telefono: f.telefono || null,
        password: f.password,
        direccion: {
          pais: f.pais, estado: f.estado, ciudad: f.ciudad, colonia: f.colonia, calle: f.calle,
          numeroExterior: f.numeroExterior, numeroInterior: f.numeroInterior || null,
          codigoPostal: f.codigoPostal, referencias: f.referencias || null,
        },
      })
      onSesion(usuario)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="card auth registro">
      <h2>Crear cuenta</h2>
      <form onSubmit={enviar}>
        <h3>Datos de la cuenta</h3>
        <div className="campos">
          <label className="doble">
            Nombre completo
            <input required minLength={2} maxLength={120} autoComplete="name" value={f.nombre} onChange={set('nombre')} />
          </label>
          <label>
            Correo
            <input type="email" required maxLength={160} autoComplete="email" value={f.email} onChange={set('email')} />
          </label>
          <label>
            Teléfono <small className="muted">(opcional)</small>
            <input type="tel" inputMode="tel" pattern="[0-9+ ()-]{10,20}" maxLength={20} autoComplete="tel" value={f.telefono} onChange={set('telefono')} placeholder="10 dígitos" />
          </label>
          <label>
            Contraseña
            <input type="password" required maxLength={128} autoComplete="new-password" value={f.password} onChange={set('password')} />
          </label>
          <label>
            Confirmar contraseña
            <input type="password" required maxLength={128} autoComplete="new-password" value={f.confirmar} onChange={set('confirmar')} />
          </label>
        </div>
        {f.password && (
          <ul className="reglas">
            {reglas.map((r) => <li key={r.texto} className={r.ok ? 'ok' : ''}>{r.ok ? '✓' : '•'} {r.texto}</li>)}
            {f.confirmar && <li className={coinciden ? 'ok' : ''}>{coinciden ? '✓' : '•'} Las contraseñas coinciden</li>}
          </ul>
        )}

        <h3>Dirección</h3>
        <div className="campos">
          <label>
            País
            <select value={f.pais} onChange={(e) => setF({ ...f, pais: e.target.value, estado: '' })} autoComplete="country">
              {PAISES.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
            </select>
          </label>
          <label>
            Estado
            {f.pais === 'MX' ? (
              <select required value={f.estado} onChange={set('estado')}>
                <option value="">Selecciona…</option>
                {ESTADOS_MX.map((e) => <option key={e}>{e}</option>)}
              </select>
            ) : (
              <input required minLength={2} maxLength={80} autoComplete="address-level1" value={f.estado} onChange={set('estado')} />
            )}
          </label>
          <label>
            Ciudad / municipio
            <input required minLength={2} maxLength={80} autoComplete="address-level2" value={f.ciudad} onChange={set('ciudad')} />
          </label>
          <label>
            Código postal
            <input required inputMode="numeric" maxLength={10} autoComplete="postal-code" value={f.codigoPostal} onChange={set('codigoPostal')} />
          </label>
          <label className="doble">
            Colonia
            <input required minLength={2} maxLength={100} value={f.colonia} onChange={set('colonia')} />
          </label>
          <label className="doble">
            Calle
            <input required minLength={2} maxLength={150} autoComplete="address-line1" value={f.calle} onChange={set('calle')} />
          </label>
          <label>
            Número exterior
            <input required maxLength={20} value={f.numeroExterior} onChange={set('numeroExterior')} />
          </label>
          <label>
            Número interior <small className="muted">(opcional)</small>
            <input maxLength={20} value={f.numeroInterior} onChange={set('numeroInterior')} />
          </label>
          <label className="doble">
            Referencias <small className="muted">(opcional)</small>
            <textarea rows={2} maxLength={250} value={f.referencias} onChange={set('referencias')} placeholder="Entre calles, color de fachada…" />
          </label>
        </div>

        {error && <p className="alerta error">{error}</p>}
        <button type="submit" disabled={enviando}>{enviando ? 'Creando cuenta…' : 'Crear cuenta'}</button>
      </form>
      <p className="muted cambio">
        ¿Ya tienes cuenta? <button type="button" className="link" onClick={irALogin}>Inicia sesión</button>
      </p>
    </section>
  )
}

export default function Auth({ modo, setModo, onSesion }) {
  return modo === 'registro'
    ? <Registro onSesion={onSesion} irALogin={() => setModo('login')} />
    : <Login onSesion={onSesion} irARegistro={() => setModo('registro')} />
}
