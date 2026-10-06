import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportBackup, importBackup } from './db'
import type {
  BackupPayload,
  Bar,
  Collection,
  CollectionEntry,
  Incident,
  Machine,
  MachineCategory,
} from './types'

type View = 'inicio' | 'bares' | 'averias' | 'recaudaciones' | 'calendario' | 'mapa' | 'ajustes'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type CollectionDraft = {
  amount: string
  hadB: boolean
  bAmount: string
}

const incidentTypes = [
  'Máquina vacía',
  'Hopper vacío',
  'Recicladora',
  'Monedero',
  'Billetero',
  'Pantalla',
  'Botonera',
  'Ordenador',
  'Fuente de alimentación',
  'Sin corriente',
  'Otra',
]

const uuid = () => crypto.randomUUID()

const localDate = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

const monthNow = () => localDate().slice(0, 7)

const money = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value || 0)

const parseAmount = (value: string) => Number(value.replace(',', '.')) || 0

const formatDate = (date: string) => {
  if (!date) return ''
  return new Intl.DateTimeFormat('es-ES').format(new Date(`${date}T12:00:00`))
}

export default function App() {
  const [view, setView] = useState<View>('inicio')
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  const bars = useLiveQuery(() => db.bars.orderBy('name').toArray(), []) ?? []
  const machines = useLiveQuery(() => db.machines.toArray(), []) ?? []
  const incidents = useLiveQuery(() => db.incidents.orderBy('date').reverse().toArray(), []) ?? []
  const collections = useLiveQuery(() => db.collections.orderBy('date').reverse().toArray(), []) ?? []
  const entries = useLiveQuery(() => db.collectionEntries.toArray(), []) ?? []

  const selectedBar = bars.find((bar) => bar.id === selectedBarId)

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  async function installApp() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null)
      flash('Aplicación instalada.')
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img
            className="brand-logo"
            src={`${import.meta.env.BASE_URL}logo-recreativos-sur.webp`}
            alt="Recreativos Sur Mallorca"
          />
          <div>
            <strong>Recreativos Sur</strong>
            <span>Mallorca · Gestión</span>
          </div>
        </div>

        <nav>
          <NavButton active={view === 'inicio'} onClick={() => setView('inicio')}>Inicio</NavButton>
          <NavButton active={view === 'bares'} onClick={() => setView('bares')}>Bares</NavButton>
          <NavButton active={view === 'averias'} onClick={() => setView('averias')}>Averías</NavButton>
          <NavButton active={view === 'recaudaciones'} onClick={() => setView('recaudaciones')}>Recaud.</NavButton>
          <NavButton active={view === 'calendario'} onClick={() => setView('calendario')}>Calendario</NavButton>
          <NavButton active={view === 'mapa'} onClick={() => setView('mapa')}>Mapa</NavButton>
          <NavButton active={view === 'ajustes'} onClick={() => setView('ajustes')}>Ajustes</NavButton>
        </nav>

        <div className="privacy-badge">
          <span className="dot" />
          <div>
            <strong>Datos locales</strong>
            <small>Sin base de datos en la nube</small>
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
            openMap={() => setView('mapa')}
          />
        )}

        {view === 'bares' && (
          <BarsView
            bars={bars}
            machines={machines}
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
          <CalendarView
            bars={bars}
            machines={machines}
            incidents={incidents}
            collections={collections}
            entries={entries}
          />
        )}

        {view === 'mapa' && <MapView bars={bars} machines={machines} />}

        {view === 'ajustes' && (
          <SettingsView flash={flash} installApp={installPrompt ? installApp : undefined} />
        )}
      </main>
    </div>
  )
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className={active ? 'nav-button active' : 'nav-button'} onClick={onClick}>
      {children}
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
  openMap,
}: {
  bars: Bar[]
  machines: Machine[]
  incidents: Incident[]
  collections: Collection[]
  entries: CollectionEntry[]
  openBars: () => void
  openMap: () => void
}) {
  const lastCollection = collections[0]
  const lastTotal = lastCollection
    ? entries.filter((entry) => entry.collectionId === lastCollection.id).reduce((sum, entry) => sum + entry.amount, 0)
    : 0

  return (
    <>
      <section className="stats-grid">
        <Stat label="Bares activos" value={String(bars.filter((bar) => bar.active).length)} />
        <Stat label="Máquinas" value={String(machines.filter((machine) => machine.active).length)} />
        <Stat label="Averías registradas" value={String(incidents.length)} />
        <Stat label="Última recaudación" value={lastCollection ? money(lastTotal) : '—'} />
      </section>

      <section className="grid-two">
        <div className="panel">
          <div className="panel-title">
            <div>
              <h2>Últimas averías</h2>
              <p>Historial reciente de intervenciones</p>
            </div>
          </div>
          {incidents.length === 0 ? (
            <Empty text="Todavía no hay averías registradas." />
          ) : (
            <div className="list">
              {incidents.slice(0, 6).map((incident) => (
                <div className="list-row" key={incident.id}>
                  <div>
                    <strong>{incident.type}</strong>
                    <span>
                      {machines.find((machine) => machine.id === incident.machineId)?.name ?? 'Máquina'} ·{' '}
                      {bars.find((bar) => bar.id === incident.barId)?.name ?? 'Bar'}
                    </span>
                  </div>
                  <span className="pill">{formatDate(incident.date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">
            <div>
              <h2>Acceso rápido</h2>
              <p>Gestión diaria de la ruta</p>
            </div>
          </div>
          <div className="quick-actions">
            <button className="primary wide" onClick={openBars}>Gestionar bares y máquinas</button>
            <button className="secondary wide" onClick={openMap}>Ver mapa de bares</button>
          </div>
          <div className="local-note">
            <strong>Privacidad por diseño</strong>
            <p>Los datos de explotación se guardan en este dispositivo. GitHub contiene únicamente el código de la aplicación.</p>
          </div>
        </div>
      </section>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function BarsView({
  bars,
  machines,
  selectedBar,
  selectBar,
  flash,
}: {
  bars: Bar[]
  machines: Machine[]
  selectedBar?: Bar
  selectBar: (id: string | null) => void
  flash: (message: string) => void
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')

  async function addBar(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return

    const bar: Bar = {
      id: uuid(),
      name: name.trim(),
      address: address.trim(),
      active: true,
      createdAt: new Date().toISOString(),
    }

    await db.bars.add(bar)
    setName('')
    setAddress('')
    selectBar(bar.id)
    flash('Bar añadido.')
  }

  return (
    <section className="grid-bars">
      <div className="panel">
        <div className="panel-title">
          <div><h2>Bares</h2><p>{bars.length} registrados</p></div>
        </div>

        <form className="stack-form" onSubmit={addBar}>
          <label>
            Nombre
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Bar Can Toni" />
          </label>
          <label>
            Dirección <span className="optional">opcional</span>
            <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Calle, número, municipio" />
          </label>
          <button className="primary" type="submit">Añadir bar</button>
        </form>

        <div className="bar-list">
          {bars.map((bar) => {
            const count = machines.filter((machine) => machine.barId === bar.id && machine.active).length
            return (
              <button
                key={bar.id}
                className={selectedBar?.id === bar.id ? 'bar-item selected' : 'bar-item'}
                onClick={() => selectBar(bar.id)}
              >
                <div>
                  <strong>{bar.name}</strong>
                  <span>{count} máquina{count === 1 ? '' : 's'}{bar.address ? ` · ${bar.address}` : ''}</span>
                </div>
                <span>›</span>
              </button>
            )
          })}
          {bars.length === 0 && <Empty text="Añade el primer bar para empezar." />}
        </div>
      </div>

      <div className="panel">
        {selectedBar ? (
          <BarDetail
            bar={selectedBar}
            machines={machines.filter((machine) => machine.barId === selectedBar.id)}
            flash={flash}
          />
        ) : (
          <Empty text="Selecciona un bar para ver sus máquinas." />
        )}
      </div>
    </section>
  )
}

function BarDetail({ bar, machines, flash }: { bar: Bar; machines: Machine[]; flash: (message: string) => void }) {
  const [category, setCategory] = useState<MachineCategory>('B')
  const [subtype, setSubtype] = useState('Máquina recreativa')
  const [name, setName] = useState('')
  const [model, setModel] = useState('')

  async function addMachine(event: FormEvent) {
    event.preventDefault()
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
        <span className="pill">{machines.filter((machine) => machine.active).length} máquinas</span>
      </div>

      <div className="machine-grid">
        {machines.map((machine) => (
          <div className="machine-card" key={machine.id}>
            <div className="machine-head">
              <span className={machine.category === 'A' ? 'type-badge a' : 'type-badge b'}>Tipo {machine.category}</span>
              {!machine.active && <span className="pill">Inactiva</span>}
            </div>
            <h3>{machine.name}</h3>
            <p>{machine.subtype}{machine.model ? ` · ${machine.model}` : ''}</p>
          </div>
        ))}
        {machines.length === 0 && <Empty text="Este bar todavía no tiene máquinas." />}
      </div>

      <details className="details-box">
        <summary>Añadir máquina</summary>
        <form className="form-grid" onSubmit={addMachine}>
          <label>
            Tipo
            <select
              value={category}
              onChange={(event) => {
                const next = event.target.value as MachineCategory
                setCategory(next)
                setSubtype(next === 'A' ? 'Billar' : 'Máquina recreativa')
              }}
            >
              <option value="B">Tipo B · Tragaperras</option>
              <option value="A">Tipo A · Billar, futbolín, dardos…</option>
            </select>
          </label>
          <label>
            Clase
            {category === 'A' ? (
              <select value={subtype} onChange={(event) => setSubtype(event.target.value)}>
                <option>Billar</option>
                <option>Futbolín</option>
                <option>Dardos</option>
                <option>Otra</option>
              </select>
            ) : (
              <input value={subtype} onChange={(event) => setSubtype(event.target.value)} />
            )}
          </label>
          <label>
            Identificador / nombre
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. B-0347" />
          </label>
          <label>
            Modelo <span className="optional">opcional</span>
            <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="Ej. Manhattan" />
          </label>
          <button className="primary" type="submit">Guardar máquina</button>
        </form>
      </details>
    </>
  )
}

function IncidentsView({
  bars,
  machines,
  incidents,
  flash,
}: {
  bars: Bar[]
  machines: Machine[]
  incidents: Incident[]
  flash: (message: string) => void
}) {
  const [machineId, setMachineId] = useState('')
  const [date, setDate] = useState(localDate())
  const [type, setType] = useState(incidentTypes[0])
  const [customType, setCustomType] = useState('')
  const [description, setDescription] = useState('')

  async function save(event: FormEvent) {
    event.preventDefault()
    const machine = machines.find((item) => item.id === machineId)
    if (!machine) return

    const finalType = type === 'Otra' ? customType.trim() || 'Otra' : type

    await db.incidents.add({
      id: uuid(),
      machineId,
      barId: machine.barId,
      date,
      type: finalType,
      description: description.trim(),
      createdAt: new Date().toISOString(),
    })

    setDescription('')
    setCustomType('')
    flash('Avería añadida al historial.')
  }

  return (
    <section className="grid-two">
      <div className="panel">
        <div className="panel-title">
          <div><h2>Registrar avería</h2><p>Se guarda directamente en el historial</p></div>
        </div>

        <form className="stack-form" onSubmit={save}>
          <label>
            Máquina
            <select value={machineId} onChange={(event) => setMachineId(event.target.value)}>
              <option value="">Selecciona una máquina</option>
              {machines.filter((machine) => machine.active).map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {bars.find((bar) => bar.id === machine.barId)?.name ?? 'Bar'} · {machine.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label>
            Tipo de avería
            <select value={type} onChange={(event) => setType(event.target.value)}>
              {incidentTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          {type === 'Otra' && (
            <label>
              Tipo personalizado
              <input value={customType} onChange={(event) => setCustomType(event.target.value)} placeholder="Ej. Ventilador, cableado…" />
            </label>
          )}
          <label>
            Descripción <span className="optional">opcional</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Qué fallaba, qué se encontró, pieza cambiada…"
            />
          </label>
          <button className="primary" type="submit" disabled={!machineId}>Guardar en historial</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title">
          <div><h2>Historial de averías</h2><p>{incidents.length} intervenciones registradas</p></div>
        </div>

        <div className="list">
          {incidents.map((incident) => {
            const machine = machines.find((item) => item.id === incident.machineId)
            const bar = bars.find((item) => item.id === incident.barId)
            return (
              <div className="incident-row" key={incident.id}>
                <div className="incident-main">
                  <div className="row-title">
                    <strong>{incident.type}</strong>
                    <span className="pill">{formatDate(incident.date)}</span>
                  </div>
                  <span>{bar?.name ?? 'Bar'} · {machine?.name ?? 'Máquina'}</span>
                  {incident.description && <p>{incident.description}</p>}
                  {incident.resolution && <p className="legacy-resolution">Intervención: {incident.resolution}</p>}
                </div>
              </div>
            )
          })}
          {incidents.length === 0 && <Empty text="Todavía no hay averías en el historial." />}
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
  collections: Collection[]
  entries: CollectionEntry[]
  flash: (message: string) => void
}) {
  const [barId, setBarId] = useState('')
  const [date, setDate] = useState(localDate())
  const [taxes, setTaxes] = useState('180')
  const [notes, setNotes] = useState('')
  const [values, setValues] = useState<Record<string, CollectionDraft>>({})

  const barMachines = machines.filter((machine) => machine.barId === barId && machine.active)

  const getDraft = (machineId: string): CollectionDraft =>
    values[machineId] ?? { amount: '', hadB: false, bAmount: '' }

  const changeDraft = (machineId: string, patch: Partial<CollectionDraft>) => {
    setValues((current) => {
      const previous = current[machineId] ?? { amount: '', hadB: false, bAmount: '' }
      return { ...current, [machineId]: { ...previous, ...patch } }
    })
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!barId || barMachines.length === 0) return

    const collectionId = uuid()
    const newEntries: CollectionEntry[] = barMachines.map((machine) => {
      const draft = getDraft(machine.id)
      return {
        id: uuid(),
        collectionId,
        machineId: machine.id,
        amount: parseAmount(draft.amount),
        hadB: machine.category === 'B' && draft.hadB,
        bAmount: machine.category === 'B' && draft.hadB ? parseAmount(draft.bAmount) : undefined,
      }
    })

    await db.transaction('rw', db.collections, db.collectionEntries, async () => {
      await db.collections.add({
        id: collectionId,
        barId,
        date,
        taxesAmount: parseAmount(taxes),
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      })
      await db.collectionEntries.bulkAdd(newEntries)
    })

    setValues({})
    setNotes('')
    flash('Recaudación guardada.')
  }

  return (
    <section className="grid-two collection-layout">
      <div className="panel">
        <div className="panel-title">
          <div><h2>Nueva recaudación</h2><p>Las máquinas se cargan según el bar</p></div>
        </div>

        <form className="stack-form" onSubmit={save}>
          <label>
            Bar
            <select value={barId} onChange={(event) => { setBarId(event.target.value); setValues({}) }}>
              <option value="">Selecciona un bar</option>
              {bars.filter((bar) => bar.active).map((bar) => <option key={bar.id} value={bar.id}>{bar.name}</option>)}
            </select>
          </label>

          <div className="form-grid two">
            <label>
              Fecha
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label>
              Tasas (€)
              <input inputMode="decimal" value={taxes} onChange={(event) => setTaxes(event.target.value)} />
            </label>
          </div>

          {barId && barMachines.length === 0 && <Empty text="Este bar no tiene máquinas activas." />}

          {barMachines.map((machine) => {
            const draft = getDraft(machine.id)
            return (
              <div className="collection-machine" key={machine.id}>
                <div>
                  <span className={machine.category === 'A' ? 'type-badge a' : 'type-badge b'}>Tipo {machine.category}</span>
                  <strong>{machine.name}</strong>
                  <small>{machine.subtype}</small>
                </div>
                <label>
                  Recaudación (€)
                  <input
                    inputMode="decimal"
                    value={draft.amount}
                    onChange={(event) => changeDraft(machine.id, { amount: event.target.value })}
                    placeholder="0,00"
                  />
                </label>
                {machine.category === 'B' && (
                  <div className="b-box">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={draft.hadB}
                        onChange={(event) => changeDraft(machine.id, { hadB: event.target.checked })}
                      />
                      Hubo B
                    </label>
                    {draft.hadB && (
                      <label>
                        Valor B (€)
                        <input
                          inputMode="decimal"
                          value={draft.bAmount}
                          onChange={(event) => changeDraft(machine.id, { bAmount: event.target.value })}
                          placeholder="0,00"
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <label>
            Notas <span className="optional">opcional</span>
            <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <button className="primary" type="submit" disabled={!barId || barMachines.length === 0}>Guardar recaudación</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title">
          <div><h2>Histórico</h2><p>{collections.length} recaudaciones guardadas</p></div>
        </div>

        <div className="list">
          {collections.map((collection) => {
            const bar = bars.find((item) => item.id === collection.barId)
            const collectionEntries = entries.filter((entry) => entry.collectionId === collection.id)
            const total = collectionEntries.reduce((sum, entry) => sum + entry.amount, 0)
            const totalB = collectionEntries.reduce((sum, entry) => sum + (entry.bAmount || 0), 0)

            return (
              <div className="collection-history" key={collection.id}>
                <div>
                  <strong>{bar?.name ?? 'Bar'}</strong>
                  <span>{formatDate(collection.date)} · {collectionEntries.length} máquinas</span>
                </div>
                <div className="amounts">
                  <strong>{money(total)}</strong>
                  <small>Tasas: {money(collection.taxesAmount)}{totalB ? ` · B: ${money(totalB)}` : ''}</small>
                </div>
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
  collections: Collection[]
  entries: CollectionEntry[]
}) {
  const [month, setMonth] = useState(monthNow())

  const events = useMemo(() => {
    const incidentEvents = incidents
      .filter((incident) => incident.date.startsWith(month))
      .map((incident) => ({
        date: incident.date,
        kind: 'Avería' as const,
        title: incident.type,
        detail: `${bars.find((bar) => bar.id === incident.barId)?.name ?? 'Bar'} · ${machines.find((machine) => machine.id === incident.machineId)?.name ?? 'Máquina'}`,
      }))

    const collectionEvents = collections
      .filter((collection) => collection.date.startsWith(month))
      .map((collection) => ({
        date: collection.date,
        kind: 'Recaudación' as const,
        title: bars.find((bar) => bar.id === collection.barId)?.name ?? 'Bar',
        detail: money(entries.filter((entry) => entry.collectionId === collection.id).reduce((sum, entry) => sum + entry.amount, 0)),
      }))

    return [...incidentEvents, ...collectionEvents].sort((a, b) => b.date.localeCompare(a.date))
  }, [month, incidents, collections, entries, bars, machines])

  return (
    <section className="panel">
      <div className="panel-title calendar-head">
        <div><h2>Actividad por fecha</h2><p>Averías y recaudaciones registradas</p></div>
        <input className="month-input" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </div>

      <div className="timeline">
        {events.map((event, index) => (
          <div className="timeline-row" key={`${event.kind}-${event.date}-${index}`}>
            <div className="timeline-date">{formatDate(event.date)}</div>
            <span className={event.kind === 'Avería' ? 'pill incident-pill' : 'pill success'}>{event.kind}</span>
            <div><strong>{event.title}</strong><span>{event.detail}</span></div>
          </div>
        ))}
        {events.length === 0 && <Empty text="No hay actividad registrada en este mes." />}
      </div>
    </section>
  )
}

function MapView({ bars, machines }: { bars: Bar[]; machines: Machine[] }) {
  const mappableBars = useMemo(() => bars.filter((bar) => Boolean(bar.address?.trim())), [bars])
  const [mapBarId, setMapBarId] = useState('')

  useEffect(() => {
    if (mappableBars.length === 0) {
      if (mapBarId) setMapBarId('')
      return
    }
    if (!mappableBars.some((bar) => bar.id === mapBarId)) {
      setMapBarId(mappableBars[0].id)
    }
  }, [mappableBars, mapBarId])

  const selected = mappableBars.find((bar) => bar.id === mapBarId)
  const selectedMachines = selected ? machines.filter((machine) => machine.barId === selected.id && machine.active) : []
  const mapQuery = selected?.address ? `${selected.address}, Mallorca, España` : ''
  const encoded = encodeURIComponent(mapQuery)

  if (mappableBars.length === 0) {
    return (
      <section className="panel">
        <div className="panel-title"><div><h2>Mapa de bares</h2><p>Ubicaciones guardadas</p></div></div>
        <Empty text="Todavía no hay bares con dirección. Añade la dirección desde la pestaña Bares para verlos aquí." />
      </section>
    )
  }

  return (
    <section className="map-layout">
      <div className="panel map-list-panel">
        <div className="panel-title">
          <div><h2>Bares</h2><p>{mappableBars.length} con ubicación</p></div>
        </div>
        <div className="map-bar-list">
          {mappableBars.map((bar) => {
            const count = machines.filter((machine) => machine.barId === bar.id && machine.active).length
            return (
              <button
                key={bar.id}
                className={mapBarId === bar.id ? 'map-bar-button selected' : 'map-bar-button'}
                onClick={() => setMapBarId(bar.id)}
              >
                <strong>{bar.name}</strong>
                <span>{bar.address}</span>
                <small>{count} máquina{count === 1 ? '' : 's'}</small>
              </button>
            )
          })}
        </div>
      </div>

      <div className="panel map-panel">
        {selected && (
          <>
            <div className="panel-title map-title">
              <div><h2>{selected.name}</h2><p>{selected.address}</p></div>
              <span className="pill">{selectedMachines.length} máquinas</span>
            </div>

            <iframe
              className="map-frame"
              title={`Mapa de ${selected.name}`}
              src={`https://www.google.com/maps?q=${encoded}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />

            <div className="map-actions">
              <a
                className="primary map-link"
                href={`https://www.google.com/maps/search/?api=1&query=${encoded}`}
                target="_blank"
                rel="noreferrer"
              >
                Abrir en Google Maps
              </a>
              <a
                className="secondary map-link"
                href={`https://www.google.com/maps/dir/?api=1&destination=${encoded}`}
                target="_blank"
                rel="noreferrer"
              >
                Cómo llegar
              </a>
            </div>

            <div className="map-machines">
              <h3>Máquinas en este bar</h3>
              {selectedMachines.length ? (
                <div className="machine-mini-list">
                  {selectedMachines.map((machine) => (
                    <div className="machine-mini" key={machine.id}>
                      <span className={machine.category === 'A' ? 'type-badge a' : 'type-badge b'}>Tipo {machine.category}</span>
                      <div><strong>{machine.name}</strong><small>{machine.subtype}{machine.model ? ` · ${machine.model}` : ''}</small></div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="Este bar no tiene máquinas activas." />
              )}
            </div>

            <p className="map-privacy">El mapa necesita conexión a internet. Al mostrarlo, la dirección seleccionada se envía a Google Maps; el resto de datos de la aplicación continúa guardado localmente.</p>
          </>
        )}
      </div>
    </section>
  )
}

function SettingsView({ flash, installApp }: { flash: (message: string) => void; installApp?: () => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function downloadBackup() {
    const payload = await exportBackup()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `MaquinesSurMall_backup_${localDate()}.json`
    anchor.click()
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
          <div><strong>Datos en este dispositivo</strong><p>Bares, máquinas, averías y recaudaciones se guardan en IndexedDB. No existe una base de datos remota.</p></div>
        </div>
        <div className="warning-card">
          <strong>Haz copias periódicas</strong>
          <p>Si borras los datos de la aplicación o cambias de móvil, necesitarás un backup JSON para recuperar la información.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title"><div><h2>Aplicación móvil</h2><p>Instalación y copias</p></div></div>
        {installApp ? (
          <button className="primary wide" onClick={installApp}>Instalar Recreativos Sur</button>
        ) : (
          <div className="local-note">
            <strong>Instalación</strong>
            <p>Si todavía no está instalada, abre el menú del navegador y elige “Instalar aplicación” o “Añadir a pantalla de inicio”.</p>
          </div>
        )}

        <div className="panel-title backup-title"><div><h2>Copias de seguridad</h2><p>El archivo lo controlas tú</p></div></div>
        <button className="primary wide" onClick={downloadBackup}>Exportar copia JSON</button>
        <button className="secondary wide" onClick={() => inputRef.current?.click()}>Restaurar copia</button>
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept="application/json,.json"
          onChange={(event) => restore(event.target.files?.[0])}
        />
        <p className="muted">Guarda las copias fuera del repositorio de GitHub.</p>
      </div>
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>
}

function titleFor(view: View) {
  return {
    inicio: 'Panel de control',
    bares: 'Bares y máquinas',
    averias: 'Historial de averías',
    recaudaciones: 'Recaudaciones',
    calendario: 'Calendario',
    mapa: 'Mapa de bares',
    ajustes: 'Ajustes',
  }[view]
}
