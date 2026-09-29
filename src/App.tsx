import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportBackup, importBackup } from './db'
import type {
  BackupPayload,
  Bar,
  CollectionEntry,
  Incident,
  Machine,
  MachineCategory,
} from './types'

type View = 'inicio' | 'bares' | 'averias' | 'recaudaciones' | 'calendario' | 'ajustes'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const today = () => new Date().toISOString().slice(0, 10)
const monthNow = () => new Date().toISOString().slice(0, 7)
const money = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value || 0)
const uuid = () => crypto.randomUUID()

const incidentTypes = [
  'Máquina vacía',
  'Hopper vacío',
  'Recicladora',
  'Monedero',
  'Billetero',
  'Pantalla',
  'Botonera',
  'Sin corriente',
  'Otra',
]

export default function App() {
  const [view, setView] = useState<View>('inicio')
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function installApp() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null)
      flash('Aplicación instalada.')
    }
  }
  const bars = useLiveQuery(() => db.bars.orderBy('name').toArray(), []) ?? []
  const machines = useLiveQuery(() => db.machines.toArray(), []) ?? []
  const incidents = useLiveQuery(() => db.incidents.orderBy('date').reverse().toArray(), []) ?? []
  const collections = useLiveQuery(() => db.collections.orderBy('date').reverse().toArray(), []) ?? []
  const entries = useLiveQuery(() => db.collectionEntries.toArray(), []) ?? []

  const selectedBar = bars.find((bar) => bar.id === selectedBarId)

  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">MS</div>
          <div>
            <strong>Maquines Sur</strong>
            <span>Mallorca · Local</span>
          </div>
        </div>

        <nav>
          <NavButton active={view === 'inicio'} onClick={() => setView('inicio')}>Inicio</NavButton>
          <NavButton active={view === 'bares'} onClick={() => setView('bares')}>Bares</NavButton>
          <NavButton active={view === 'averias'} onClick={() => setView('averias')}>Averías</NavButton>
          <NavButton active={view === 'recaudaciones'} onClick={() => setView('recaudaciones')}>Recaudaciones</NavButton>
          <NavButton active={view === 'calendario'} onClick={() => setView('calendario')}>Calendario</NavButton>
          <NavButton active={view === 'ajustes'} onClick={() => setView('ajustes')}>Ajustes</NavButton>
        </nav>

        <div className="privacy-badge">
          <span className="dot" />
          <div>
            <strong>Datos locales</strong>
            <small>Sin nube ni servidor</small>
          </div>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <h1>{titleFor(view)}</h1>
            <p>Gestión interna de máquinas recreativas</p>
          </div>
          <button className="secondary" onClick={() => setView('ajustes')}>Copia de seguridad</button>
        </header>

        {notice && <div className="notice">{notice}</div>}

        {view === 'inicio' && (
          <Dashboard
            bars={bars}
            machines={machines}
            incidents={incidents}
            collections={collections}
            entries={entries}
            openBars={() => setView('bares')}
          />
        )}

        {view === 'bares' && (
          <BarsView
            bars={bars}
            machines={machines}
            incidents={incidents}
            selectedBar={selectedBar}
            selectBar={setSelectedBarId}
            flash={flash}
          />
        )}

        {view === 'averias' && (
          <IncidentsView bars={bars} machines={machines} incidents={incidents} flash={flash} />
        )}

        {view === 'recaudaciones' && (
          <CollectionsView
            bars={bars}
            machines={machines}
            collections={collections}
            entries={entries}
            flash={flash}
          />
        )}

        {view === 'calendario' && (
          <CalendarView bars={bars} machines={machines} incidents={incidents} collections={collections} entries={entries} />
        )}

        {view === 'ajustes' && <SettingsView flash={flash} installApp={installPrompt ? installApp : undefined} />}
      </main>
    </div>
  )
}

function NavButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={props.active ? 'nav-button active' : 'nav-button'} onClick={props.onClick}>
      {props.children}
    </button>
  )
}

function Dashboard({
  bars,
  machines,
  incidents,
  collections,
  entries,
  openBars,
}: {
  bars: Bar[]
  machines: Machine[]
  incidents: Incident[]
  collections: { id: string; barId: string; date: string; taxesAmount: number }[]
  entries: CollectionEntry[]
  openBars: () => void
}) {
  const openIncidents = incidents.filter((i) => i.status === 'open')
  const lastCollection = collections[0]
  const lastTotal = lastCollection
    ? entries.filter((e) => e.collectionId === lastCollection.id).reduce((sum, e) => sum + e.amount, 0)
    : 0

  return (
    <>
      <section className="stats-grid">
        <Stat label="Bares activos" value={String(bars.filter((b) => b.active).length)} />
        <Stat label="Máquinas" value={String(machines.filter((m) => m.active).length)} />
        <Stat label="Averías abiertas" value={String(openIncidents.length)} danger={openIncidents.length > 0} />
        <Stat label="Última recaudación" value={lastCollection ? money(lastTotal) : '—'} />
      </section>

      <section className="grid-two">
        <div className="panel">
          <div className="panel-title">
            <div><h2>Averías pendientes</h2><p>Incidencias que todavía no constan como resueltas</p></div>
          </div>
          {openIncidents.length === 0 ? (
            <Empty text="No hay averías abiertas." />
          ) : (
            <div className="list">
              {openIncidents.slice(0, 6).map((incident) => (
                <div className="list-row" key={incident.id}>
                  <div>
                    <strong>{incident.type}</strong>
                    <span>{machines.find((m) => m.id === incident.machineId)?.name ?? 'Máquina'} · {bars.find((b) => b.id === incident.barId)?.name ?? 'Bar'}</span>
                  </div>
                  <span className="pill danger">{formatDate(incident.date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">
            <div><h2>Acceso rápido</h2><p>Empieza creando los bares y asignando sus máquinas</p></div>
          </div>
          <button className="primary wide" onClick={openBars}>Gestionar bares y máquinas</button>
          <div className="local-note">
            <strong>Privacidad por diseño</strong>
            <p>Los datos de explotación se guardan en IndexedDB dentro de este navegador. El repositorio contiene únicamente código.</p>
          </div>
        </div>
      </section>
    </>
  )
}

function Stat({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={danger ? 'stat-card danger-card' : 'stat-card'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function BarsView({
  bars,
  machines,
  incidents,
  selectedBar,
  selectBar,
  flash,
}: {
  bars: Bar[]
  machines: Machine[]
  incidents: Incident[]
  selectedBar?: Bar
  selectBar: (id: string | null) => void
  flash: (message: string) => void
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')

  async function addBar(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const bar: Bar = { id: uuid(), name: name.trim(), address: address.trim(), active: true, createdAt: new Date().toISOString() }
    await db.bars.add(bar)
    setName('')
    setAddress('')
    selectBar(bar.id)
    flash('Bar añadido.')
  }

  return (
    <section className="grid-bars">
      <div className="panel">
        <div className="panel-title"><div><h2>Bares</h2><p>{bars.length} registrados</p></div></div>
        <form className="stack-form" onSubmit={addBar}>
          <label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Bar Can Toni" /></label>
          <label>Dirección <span className="optional">opcional</span><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección" /></label>
          <button className="primary" type="submit">Añadir bar</button>
        </form>
        <div className="bar-list">
          {bars.map((bar) => {
            const count = machines.filter((m) => m.barId === bar.id && m.active).length
            const open = incidents.filter((i) => i.barId === bar.id && i.status === 'open').length
            return (
              <button key={bar.id} className={selectedBar?.id === bar.id ? 'bar-item selected' : 'bar-item'} onClick={() => selectBar(bar.id)}>
                <div><strong>{bar.name}</strong><span>{count} máquinas · {open} averías abiertas</span></div>
                <span>›</span>
              </button>
            )
          })}
          {bars.length === 0 && <Empty text="Añade el primer bar para empezar." />}
        </div>
      </div>

      <div className="panel">
        {selectedBar ? (
          <BarDetail bar={selectedBar} machines={machines.filter((m) => m.barId === selectedBar.id)} incidents={incidents} flash={flash} />
        ) : (
          <Empty text="Selecciona un bar para ver sus máquinas." />
        )}
      </div>
    </section>
  )
}

function BarDetail({ bar, machines, incidents, flash }: { bar: Bar; machines: Machine[]; incidents: Incident[]; flash: (m: string) => void }) {
  const [category, setCategory] = useState<MachineCategory>('B')
  const [subtype, setSubtype] = useState('Máquina recreativa')
  const [name, setName] = useState('')
  const [model, setModel] = useState('')

  async function addMachine(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const machine: Machine = {
      id: uuid(),
      barId: bar.id,
      category,
      subtype: subtype.trim() || (category === 'A' ? 'Otra' : 'Máquina recreativa'),
      name: name.trim(),
      model: model.trim(),
      active: true,
      createdAt: new Date().toISOString(),
    }
    await db.machines.add(machine)
    setName('')
    setModel('')
    flash('Máquina añadida.')
  }

  return (
    <>
      <div className="panel-title">
        <div><h2>{bar.name}</h2><p>{bar.address || 'Sin dirección'}</p></div>
        <span className="pill">{machines.filter((m) => m.active).length} máquinas</span>
      </div>

      <div className="machine-grid">
        {machines.map((machine) => {
          const open = incidents.filter((i) => i.machineId === machine.id && i.status === 'open').length
          return (
            <div className="machine-card" key={machine.id}>
              <div className="machine-head">
                <span className={machine.category === 'A' ? 'type-badge a' : 'type-badge b'}>Tipo {machine.category}</span>
                {open > 0 && <span className="pill danger">{open} avería{open > 1 ? 's' : ''}</span>}
              </div>
              <h3>{machine.name}</h3>
              <p>{machine.subtype}{machine.model ? ' · ' + machine.model : ''}</p>
              <button className="link-button" onClick={async () => {
                const type = window.prompt('Tipo de avería', 'Máquina vacía')
                if (!type) return
                const description = window.prompt('Descripción / observaciones', '') ?? ''
                await db.incidents.add({
                  id: uuid(), machineId: machine.id, barId: bar.id, date: today(), type,
                  description, status: 'open', createdAt: new Date().toISOString(),
                })
                flash('Avería registrada.')
              }}>+ Registrar avería</button>
            </div>
          )
        })}
        {machines.length === 0 && <Empty text="Este bar todavía no tiene máquinas." />}
      </div>

      <details className="details-box">
        <summary>Añadir máquina</summary>
        <form className="form-grid" onSubmit={addMachine}>
          <label>Tipo
            <select value={category} onChange={(e) => {
              const next = e.target.value as MachineCategory
              setCategory(next)
              setSubtype(next === 'A' ? 'Billar' : 'Máquina recreativa')
            }}>
              <option value="B">Tipo B · Tragaperras</option>
              <option value="A">Tipo A · Billar, futbolín, dardos…</option>
            </select>
          </label>
          <label>Clase
            {category === 'A' ? (
              <select value={subtype} onChange={(e) => setSubtype(e.target.value)}>
                <option>Billar</option><option>Futbolín</option><option>Dardos</option><option>Otra</option>
              </select>
            ) : (
              <input value={subtype} onChange={(e) => setSubtype(e.target.value)} />
            )}
          </label>
          <label>Identificador / nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. B-0347" /></label>
          <label>Modelo <span className="optional">opcional</span><input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ej. Manhattan" /></label>
          <button className="primary" type="submit">Guardar máquina</button>
        </form>
      </details>
    </>
  )
}

function IncidentsView({ bars, machines, incidents, flash }: { bars: Bar[]; machines: Machine[]; incidents: Incident[]; flash: (m: string) => void }) {
  const [machineId, setMachineId] = useState('')
  const [date, setDate] = useState(today())
  const [type, setType] = useState(incidentTypes[0])
  const [description, setDescription] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const machine = machines.find((m) => m.id === machineId)
    if (!machine) return
    await db.incidents.add({
      id: uuid(), machineId, barId: machine.barId, date, type,
      description: description.trim(), status: 'open', createdAt: new Date().toISOString(),
    })
    setDescription('')
    flash('Avería registrada.')
  }

  return (
    <section className="grid-two">
      <div className="panel">
        <div className="panel-title"><div><h2>Nueva avería</h2><p>Quedará asociada a la máquina y al bar</p></div></div>
        <form className="stack-form" onSubmit={save}>
          <label>Máquina<select value={machineId} onChange={(e) => setMachineId(e.target.value)}>
            <option value="">Selecciona una máquina</option>
            {machines.filter((m) => m.active).map((m) => <option key={m.id} value={m.id}>{bars.find((b) => b.id === m.barId)?.name} · {m.name}</option>)}
          </select></label>
          <label>Fecha<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Tipo<select value={type} onChange={(e) => setType(e.target.value)}>{incidentTypes.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Descripción<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Qué ocurre, síntomas, observaciones..." /></label>
          <button className="primary" type="submit" disabled={!machineId}>Guardar avería</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title"><div><h2>Historial</h2><p>{incidents.length} incidencias registradas</p></div></div>
        <div className="list">
          {incidents.map((incident) => {
            const machine = machines.find((m) => m.id === incident.machineId)
            const bar = bars.find((b) => b.id === incident.barId)
            return (
              <div className="incident-row" key={incident.id}>
                <div className="incident-main">
                  <div className="row-title"><strong>{incident.type}</strong><span className={incident.status === 'open' ? 'pill danger' : 'pill success'}>{incident.status === 'open' ? 'Abierta' : 'Resuelta'}</span></div>
                  <span>{bar?.name ?? 'Bar'} · {machine?.name ?? 'Máquina'} · {formatDate(incident.date)}</span>
                  {incident.description && <p>{incident.description}</p>}
                  {incident.resolution && <p className="resolution">Solución: {incident.resolution}</p>}
                </div>
                {incident.status === 'open' && (
                  <button className="secondary small" onClick={async () => {
                    const resolution = window.prompt('Solución aplicada', '') ?? ''
                    await db.incidents.update(incident.id, { status: 'resolved', resolution, resolvedAt: new Date().toISOString() })
                    flash('Avería marcada como resuelta.')
                  }}>Resolver</button>
                )}
              </div>
            )
          })}
          {incidents.length === 0 && <Empty text="Todavía no hay averías registradas." />}
        </div>
      </div>
    </section>
  )
}

function CollectionsView({
  bars,
  machines,
  collections,
  entries,
  flash,
}: {
  bars: Bar[]
  machines: Machine[]
  collections: { id: string; barId: string; date: string; taxesAmount: number; notes?: string }[]
  entries: CollectionEntry[]
  flash: (m: string) => void
}) {
  const [barId, setBarId] = useState('')
  const [date, setDate] = useState(today())
  const [taxes, setTaxes] = useState('180')
  const [notes, setNotes] = useState('')
  const [values, setValues] = useState<Record<string, { amount: string; hadB: boolean; bAmount: string }>>({})

  const barMachines = machines.filter((m) => m.barId === barId && m.active)

  const changeValue = (id: string, patch: Partial<{ amount: string; hadB: boolean; bAmount: string }>) =>
    setValues((current) => ({ ...current, [id]: { amount: '', hadB: false, bAmount: '', ...current[id], ...patch } }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!barId || barMachines.length === 0) return
    const collectionId = uuid()
    const collectionEntries: CollectionEntry[] = barMachines.map((machine) => {
      const value = values[machine.id] ?? { amount: '', hadB: false, bAmount: '' }
      return {
        id: uuid(),
        collectionId,
        machineId: machine.id,
        amount: Number(value.amount.replace(',', '.')) || 0,
        hadB: value.hadB,
        bAmount: value.hadB ? Number(value.bAmount.replace(',', '.')) || 0 : undefined,
      }
    })

    await db.transaction('rw', db.collections, db.collectionEntries, async () => {
      await db.collections.add({
        id: collectionId,
        barId,
        date,
        taxesAmount: Number(taxes.replace(',', '.')) || 0,
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      })
      await db.collectionEntries.bulkAdd(collectionEntries)
    })
    setValues({})
    setNotes('')
    flash('Recaudación guardada.')
  }

  return (
    <section className="grid-two collection-layout">
      <div className="panel">
        <div className="panel-title"><div><h2>Nueva recaudación</h2><p>Las máquinas se cargan automáticamente según el bar</p></div></div>
        <form className="stack-form" onSubmit={save}>
          <label>Bar<select value={barId} onChange={(e) => { setBarId(e.target.value); setValues({}) }}>
            <option value="">Selecciona un bar</option>
            {bars.filter((b) => b.active).map((bar) => <option key={bar.id} value={bar.id}>{bar.name}</option>)}
          </select></label>
          <div className="form-grid two">
            <label>Fecha<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label>Tasas (€)<input inputMode="decimal" value={taxes} onChange={(e) => setTaxes(e.target.value)} /></label>
          </div>

          {barId && barMachines.length === 0 && <Empty text="Este bar no tiene máquinas activas." />}
          {barMachines.map((machine) => {
            const value = values[machine.id] ?? { amount: '', hadB: false, bAmount: '' }
            return (
              <div className="collection-machine" key={machine.id}>
                <div><span className={machine.category === 'A' ? 'type-badge a' : 'type-badge b'}>Tipo {machine.category}</span><strong>{machine.name}</strong><small>{machine.subtype}</small></div>
                <label>Recaudación (€)<input inputMode="decimal" value={value.amount} onChange={(e) => changeValue(machine.id, { amount: e.target.value })} placeholder="0,00" /></label>
                {machine.category === 'B' && (
                  <div className="b-box">
                    <label className="check"><input type="checkbox" checked={value.hadB} onChange={(e) => changeValue(machine.id, { hadB: e.target.checked })} /> Hubo B</label>
                    {value.hadB && <label>Valor B (€)<input inputMode="decimal" value={value.bAmount} onChange={(e) => changeValue(machine.id, { bAmount: e.target.value })} placeholder="0,00" /></label>}
                  </div>
                )}
              </div>
            )
          })}

          <label>Notas <span className="optional">opcional</span><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <button className="primary" type="submit" disabled={!barId || barMachines.length === 0}>Guardar recaudación</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title"><div><h2>Histórico</h2><p>Recaudaciones guardadas</p></div></div>
        <div className="list">
          {collections.map((c) => {
            const bar = bars.find((b) => b.id === c.barId)
            const currentEntries = entries.filter((e) => e.collectionId === c.id)
            const total = currentEntries.reduce((sum, e) => sum + e.amount, 0)
            const totalB = currentEntries.reduce((sum, e) => sum + (e.bAmount || 0), 0)
            return (
              <div className="collection-history" key={c.id}>
                <div><strong>{bar?.name ?? 'Bar'}</strong><span>{formatDate(c.date)} · {currentEntries.length} máquinas</span></div>
                <div className="amounts"><strong>{money(total)}</strong><small>Tasas: {money(c.taxesAmount)}{totalB ? ' · B: ' + money(totalB) : ''}</small></div>
              </div>
            )
          })}
          {collections.length === 0 && <Empty text="Todavía no hay recaudaciones." />}
        </div>
      </div>
    </section>
  )
}

function CalendarView({
  bars,
  machines,
  incidents,
  collections,
  entries,
}: {
  bars: Bar[]
  machines: Machine[]
  incidents: Incident[]
  collections: { id: string; barId: string; date: string; taxesAmount: number }[]
  entries: CollectionEntry[]
}) {
  const [month, setMonth] = useState(monthNow())
  const events = useMemo(() => {
    const incidentEvents = incidents
      .filter((i) => i.date.startsWith(month))
      .map((i) => ({
        date: i.date,
        kind: 'Avería',
        title: i.type,
        detail: (bars.find((b) => b.id === i.barId)?.name ?? 'Bar') + ' · ' + (machines.find((m) => m.id === i.machineId)?.name ?? 'Máquina'),
      }))
    const collectionEvents = collections
      .filter((c) => c.date.startsWith(month))
      .map((c) => ({
        date: c.date,
        kind: 'Recaudación',
        title: bars.find((b) => b.id === c.barId)?.name ?? 'Bar',
        detail: money(entries.filter((e) => e.collectionId === c.id).reduce((sum, e) => sum + e.amount, 0)),
      }))
    return [...incidentEvents, ...collectionEvents].sort((a, b) => b.date.localeCompare(a.date))
  }, [month, incidents, collections, entries, bars, machines])

  return (
    <section className="panel">
      <div className="panel-title calendar-head">
        <div><h2>Actividad por fecha</h2><p>Averías y recaudaciones registradas</p></div>
        <input className="month-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      <div className="timeline">
        {events.map((event, index) => (
          <div className="timeline-row" key={event.kind + event.date + index}>
            <div className="timeline-date">{formatDate(event.date)}</div>
            <span className={event.kind === 'Avería' ? 'pill danger' : 'pill success'}>{event.kind}</span>
            <div><strong>{event.title}</strong><span>{event.detail}</span></div>
          </div>
        ))}
        {events.length === 0 && <Empty text="No hay actividad registrada en este mes." />}
      </div>
    </section>
  )
}

function SettingsView({ flash, installApp }: { flash: (m: string) => void; installApp?: () => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function downloadBackup() {
    const payload = await exportBackup()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'MaquinesSurMall_backup_' + today() + '.json'
    a.click()
    URL.revokeObjectURL(url)
    flash('Copia de seguridad exportada.')
  }

  async function restore(file?: File) {
    if (!file) return
    try {
      const payload = JSON.parse(await file.text()) as BackupPayload
      const ok = window.confirm('Restaurar esta copia sustituirá TODOS los datos locales actuales. ¿Continuar?')
      if (!ok) return
      await importBackup(payload)
      flash('Copia restaurada correctamente.')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo restaurar la copia.')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section className="grid-two">
      <div className="panel">
        <div className="panel-title"><div><h2>Datos y privacidad</h2><p>Configuración local-first</p></div></div>
        <div className="security-card">
          <span className="security-icon">✓</span>
          <div><strong>Sin base de datos en la nube</strong><p>Bares, máquinas, averías y recaudaciones se guardan en IndexedDB dentro del perfil de este navegador.</p></div>
        </div>
        <div className="warning-card">
          <strong>Importante</strong>
          <p>Si borras los datos del navegador, cambias de dispositivo o eliminas el perfil, puedes perder la base local. Exporta copias periódicamente.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title"><div><h2>Aplicación móvil</h2><p>Instálala en el teléfono como una app normal</p></div></div>
        {installApp ? (
          <button className="primary wide" onClick={installApp}>Instalar Maquines Sur</button>
        ) : (
          <div className="local-note">
            <strong>Instalación</strong>
            <p>Si todavía no está instalada, abre el menú del navegador y elige “Instalar aplicación” o “Añadir a pantalla de inicio”.</p>
          </div>
        )}
        <div className="panel-title backup-title"><div><h2>Copias de seguridad</h2><p>El archivo lo controlas tú</p></div></div>
        <button className="primary wide" onClick={downloadBackup}>Exportar copia JSON</button>
        <button className="secondary wide" onClick={() => inputRef.current?.click()}>Restaurar copia</button>
        <input ref={inputRef} className="hidden" type="file" accept="application/json,.json" onChange={(e) => restore(e.target.files?.[0])} />
        <p className="muted">No guardes las copias dentro de la carpeta del repositorio Git.</p>
      </div>
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>
}

function formatDate(date: string) {
  if (!date) return ''
  return new Intl.DateTimeFormat('es-ES').format(new Date(date + 'T12:00:00'))
}

function titleFor(view: View) {
  return {
    inicio: 'Panel de control',
    bares: 'Bares y máquinas',
    averias: 'Averías',
    recaudaciones: 'Recaudaciones',
    calendario: 'Calendario',
    ajustes: 'Ajustes',
  }[view]
}
