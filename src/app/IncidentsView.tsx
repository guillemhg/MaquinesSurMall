import { useState, type FormEvent } from 'react'
import { db } from '../db'
import type { Bar, Incident, Machine } from '../types'
import { formatDate, incidentTypes, today, uuid } from './utils'

export function IncidentsView({ bars, machines, incidents, flash }: { bars: Bar[]; machines: Machine[]; incidents: Incident[]; flash: (m: string) => void }) {
  const [machineId, setMachineId] = useState('')
  const [date, setDate] = useState(today())
  const [type, setType] = useState(incidentTypes[0])
  const [description, setDescription] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    const machine = machines.find((m) => m.id === machineId)
    if (!machine) return
    const now = new Date().toISOString()
    await db.incidents.add({
      id: uuid(), machineId, barId: machine.barId, date, type,
      description: description.trim(), status: 'resolved', createdAt: now, resolvedAt: now,
    })
    setDescription('')
    flash('Avería añadida al historial.')
  }

  return (
    <section className="grid-two">
      <div className="panel">
        <div className="panel-title"><div><h2>Registrar avería</h2><p>Se guarda directamente en el historial</p></div></div>
        <form className="stack-form" onSubmit={save}>
          <label>Máquina<select value={machineId} onChange={(e) => setMachineId(e.target.value)}>
            <option value="">Selecciona una máquina</option>
            {machines.filter((m) => m.active).map((m) => <option key={m.id} value={m.id}>{bars.find((b) => b.id === m.barId)?.name} · {m.name}</option>)}
          </select></label>
          <label>Fecha<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Tipo<select value={type} onChange={(e) => setType(e.target.value)}>{incidentTypes.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Descripción<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Qué ocurrió, pieza afectada, solución aplicada..." /></label>
          <button className="primary" type="submit" disabled={!machineId}>Guardar en historial</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title"><div><h2>Historial de averías</h2><p>{incidents.length} intervenciones registradas</p></div></div>
        <div className="list">
          {incidents.map((incident) => {
            const machine = machines.find((m) => m.id === incident.machineId)
            const bar = bars.find((b) => b.id === incident.barId)
            return (
              <div className="incident-row" key={incident.id}>
                <div className="incident-main">
                  <div className="row-title"><strong>{incident.type}</strong><span className="pill">{formatDate(incident.date)}</span></div>
                  <span>{bar?.name ?? 'Bar'} · {machine?.name ?? 'Máquina'}</span>
                  {incident.description && <p>{incident.description}</p>}
                  {incident.resolution && <p className="resolution">Solución: {incident.resolution}</p>}
                </div>
              </div>
            )
          })}
          {incidents.length === 0 && <div className="empty">Todavía no hay averías registradas.</div>}
        </div>
      </div>
    </section>
  )
}
