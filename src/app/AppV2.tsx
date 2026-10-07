import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { Dashboard } from './Dashboard'
import { BarsView } from './BarsView'
import { IncidentsView } from './IncidentsView'
import { CollectionsView } from './CollectionsView'
import { MapView } from './MapView'
import { CalendarView } from './CalendarView'
import { AssistantView } from './AssistantView'
import { SettingsView } from './SettingsView'

type View = 'inicio' | 'bares' | 'averias' | 'recaudaciones' | 'asistente' | 'mapa' | 'calendario' | 'ajustes'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export default function AppV2() {
  const [view, setView] = useState<View>('inicio')
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

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

  const go = (next: View) => {
    setView(next)
    setMoreOpen(false)
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

  const moreActive = view === 'asistente' || view === 'mapa' || view === 'calendario' || view === 'ajustes'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}logo-recreativos-sur.webp`} alt="Recreativos Sur Mallorca" />
          <div><strong>Recreativos Sur</strong><span>Mallorca · Gestión</span></div>
        </div>

        <nav className="desktop-nav">
          <NavButton active={view === 'inicio'} onClick={() => go('inicio')}>Inicio</NavButton>
          <NavButton active={view === 'bares'} onClick={() => go('bares')}>Bares</NavButton>
          <NavButton active={view === 'averias'} onClick={() => go('averias')}>Averías</NavButton>
          <NavButton active={view === 'recaudaciones'} onClick={() => go('recaudaciones')}>Recaud.</NavButton>
          <NavButton active={view === 'asistente'} onClick={() => go('asistente')}>Asistente</NavButton>
          <NavButton active={view === 'mapa'} onClick={() => go('mapa')}>Mapa</NavButton>
          <NavButton active={view === 'calendario'} onClick={() => go('calendario')}>Calend.</NavButton>
          <NavButton active={view === 'ajustes'} onClick={() => go('ajustes')}>Ajustes</NavButton>
        </nav>

        <nav className="mobile-nav" aria-label="Navegación principal">
          <NavButton active={view === 'inicio'} onClick={() => go('inicio')}>Inicio</NavButton>
          <NavButton active={view === 'bares'} onClick={() => go('bares')}>Bares</NavButton>
          <NavButton active={view === 'averias'} onClick={() => go('averias')}>Averías</NavButton>
          <NavButton active={view === 'recaudaciones'} onClick={() => go('recaudaciones')}>Recaud.</NavButton>
          <button className={moreActive ? 'nav-button active' : 'nav-button'} onClick={() => setMoreOpen((current) => !current)} aria-expanded={moreOpen} aria-haspopup="menu">Más {moreOpen ? '▾' : '▴'}</button>
        </nav>

        {moreOpen && <div className="mobile-more-menu" role="menu">
          <button className={view === 'asistente' ? 'active' : ''} onClick={() => go('asistente')}>Asistente local</button>
          <button className={view === 'mapa' ? 'active' : ''} onClick={() => go('mapa')}>Mapa de bares</button>
          <button className={view === 'calendario' ? 'active' : ''} onClick={() => go('calendario')}>Calendario</button>
          <button className={view === 'ajustes' ? 'active' : ''} onClick={() => go('ajustes')}>Ajustes y copias de seguridad</button>
        </div>}

        <div className="privacy-badge"><span className="dot" /><div><strong>Datos locales</strong><small>Sin nube ni servidor</small></div></div>
      </aside>

      <main className="content">
        <header className="topbar"><div><h1>{titleFor(view)}</h1><p>Gestión interna de máquinas recreativas</p></div><button className="secondary" onClick={() => go('ajustes')}>Copia de seguridad</button></header>
        {notice && <div className="notice">{notice}</div>}
        {view === 'inicio' && <Dashboard bars={bars} machines={machines} incidents={incidents} collections={collections} entries={entries} openBars={() => go('bares')} />}
        {view === 'bares' && <BarsView bars={bars} machines={machines} incidents={incidents} selectedBar={selectedBar} selectBar={setSelectedBarId} flash={flash} />}
        {view === 'averias' && <IncidentsView bars={bars} machines={machines} incidents={incidents} flash={flash} />}
        {view === 'recaudaciones' && <CollectionsView bars={bars} machines={machines} collections={collections} entries={entries} flash={flash} />}
        {view === 'asistente' && <AssistantView bars={bars} machines={machines} incidents={incidents} collections={collections} entries={entries} />}
        {view === 'mapa' && <MapView bars={bars} machines={machines} incidents={incidents} />}
        {view === 'calendario' && <CalendarView bars={bars} machines={machines} incidents={incidents} collections={collections} entries={entries} />}
        {view === 'ajustes' && <SettingsView flash={flash} installApp={installPrompt ? installApp : undefined} />}
      </main>
    </div>
  )
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button className={active ? 'nav-button active' : 'nav-button'} onClick={onClick}>{children}</button>
}

function titleFor(view: View) {
  return {
    inicio: 'Panel de control',
    bares: 'Bares y máquinas',
    averias: 'Historial de averías',
    recaudaciones: 'Recaudaciones',
    asistente: 'Asistente local',
    mapa: 'Mapa de bares',
    calendario: 'Calendario',
    ajustes: 'Ajustes',
  }[view]
}
