import { useMemo, useState } from 'react'
import type { Bar, CollectionEntry, Incident, Machine } from '../types'
import { formatDate, money, monthNow } from './utils'

export function CalendarView({ bars, machines, incidents, collections, entries }: {
  bars: Bar[]
  machines: Machine[]
  incidents: Incident[]
  collections: { id: string; barId: string; date: string; taxesAmount: number }[]
  entries: CollectionEntry[]
}) {
  const [month, setMonth] = useState(monthNow())
  const events = useMemo(() => {
    const incidentEvents = incidents.filter((i) => i.date.startsWith(month)).map((i) => ({
      date: i.date, kind: 'Avería', title: i.type,
      detail: (bars.find((b) => b.id === i.barId)?.name ?? 'Bar') + ' · ' + (machines.find((m) => m.id === i.machineId)?.name ?? 'Máquina'),
    }))
    const collectionEvents = collections.filter((c) => c.date.startsWith(month)).map((c) => ({
      date: c.date, kind: 'Recaudación', title: bars.find((b) => b.id === c.barId)?.name ?? 'Bar',
      detail: money(entries.filter((e) => e.collectionId === c.id).reduce((sum, e) => sum + e.amount, 0)),
    }))
    return [...incidentEvents, ...collectionEvents].sort((a, b) => b.date.localeCompare(a.date))
  }, [month, incidents, collections, entries, bars, machines])

  return (
    <section className="panel">
      <div className="panel-title calendar-head"><div><h2>Actividad por fecha</h2><p>Averías y recaudaciones registradas</p></div><input className="month-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
      <div className="timeline">
        {events.map((event, index) => (
          <div className="timeline-row" key={event.kind + event.date + index}>
            <div className="timeline-date">{formatDate(event.date)}</div>
            <span className={event.kind === 'Avería' ? 'pill danger' : 'pill success'}>{event.kind}</span>
            <div><strong>{event.title}</strong><span>{event.detail}</span></div>
          </div>
        ))}
        {events.length === 0 && <div className="empty">No hay actividad registrada en este mes.</div>}
      </div>
    </section>
  )
}
