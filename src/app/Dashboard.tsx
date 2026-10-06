import type { Bar, CollectionEntry, Incident, Machine } from '../types'
import { formatDate, money } from './utils'

export function Dashboard({
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
  const lastCollection = collections[0]
  const lastTotal = lastCollection
    ? entries.filter((e) => e.collectionId === lastCollection.id).reduce((sum, e) => sum + e.amount, 0)
    : 0

  return (
    <>
      <section className="stats-grid">
        <Stat label="Bares activos" value={String(bars.filter((b) => b.active).length)} />
        <Stat label="Máquinas" value={String(machines.filter((m) => m.active).length)} />
        <Stat label="Averías registradas" value={String(incidents.length)} />
        <Stat label="Última recaudación" value={lastCollection ? money(lastTotal) : '—'} />
      </section>

      <section className="grid-two">
        <div className="panel">
          <div className="panel-title">
            <div><h2>Últimas averías</h2><p>Historial reciente de intervenciones</p></div>
          </div>
          {incidents.length === 0 ? (
            <Empty text="Todavía no hay averías registradas." />
          ) : (
            <div className="list">
              {incidents.slice(0, 6).map((incident) => (
                <div className="list-row" key={incident.id}>
                  <div>
                    <strong>{incident.type}</strong>
                    <span>{machines.find((m) => m.id === incident.machineId)?.name ?? 'Máquina'} · {bars.find((b) => b.id === incident.barId)?.name ?? 'Bar'}</span>
                  </div>
                  <span className="pill">{formatDate(incident.date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">
            <div><h2>Acceso rápido</h2><p>Gestiona los bares y las máquinas instaladas</p></div>
          </div>
          <button className="primary wide" onClick={openBars}>Gestionar bares y máquinas</button>
          <div className="local-note">
            <strong>Privacidad por diseño</strong>
            <p>Los datos de explotación se guardan en IndexedDB dentro de este dispositivo. El repositorio contiene únicamente código.</p>
          </div>
        </div>
      </section>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat-card"><span>{label}</span><strong>{value}</strong></div>
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>
}
