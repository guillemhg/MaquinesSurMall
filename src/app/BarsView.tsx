import { useState, type FormEvent } from 'react'
import { db } from '../db'
import type { Bar, Incident, Machine, MachineCategory } from '../types'
import { today, uuid } from './utils'

export function BarsView({ bars, machines, incidents, selectedBar, selectBar, flash }: { bars: Bar[]; machines: Machine[]; incidents: Incident[]; selectedBar?: Bar; selectBar: (id: string | null) => void; flash: (message: string) => void }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')

  async function addBar(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const bar: Bar = { id: uuid(), name: name.trim(), address: address.trim(), active: true, createdAt: new Date().toISOString() }
    await db.bars.add(bar)
    setName('')
    setAddress('')
    selectBar(bar.id)
    flash('Bar añadido.')
  }

  return <section className="grid-bars">
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
          const historyCount = incidents.filter((i) => i.barId === bar.id).length
          return <button key={bar.id} className={selectedBar?.id === bar.id ? 'bar-item selected' : 'bar-item'} onClick={() => selectBar(bar.id)}>
            <div><strong>{bar.name}</strong><span>{count} máquinas · {historyCount} averías registradas</span></div><span>›</span>
          </button>
        })}
        {bars.length === 0 && <Empty text="Añade el primer bar para empezar." />}
      </div>
    </div>
    <div className="panel">{selectedBar ? <BarDetail bar={selectedBar} machines={machines.filter((m) => m.barId === selectedBar.id)} incidents={incidents} flash={flash} /> : <Empty text="Selecciona un bar para ver sus máquinas." />}</div>
  </section>
}

function BarDetail({ bar, machines, incidents, flash }: { bar: Bar; machines: Machine[]; incidents: Incident[]; flash: (m: string) => void }) {
  const [category, setCategory] = useState<MachineCategory>('B')
  const [subtype, setSubtype] = useState('Máquina recreativa')
  const [name, setName] = useState('')
  const [model, setModel] = useState('')

  async function addMachine(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const machine: Machine = { id: uuid(), barId: bar.id, category, subtype: subtype.trim() || (category === 'A' ? 'Otra' : 'Máquina recreativa'), name: name.trim(), model: model.trim(), active: true, createdAt: new Date().toISOString() }
    await db.machines.add(machine)
    setName('')
    setModel('')
    flash('Máquina añadida.')
  }

  async function quickIncident(machine: Machine) {
    const type = window.prompt('Tipo de avería', 'Ordenador')
    if (!type) return
    const description = window.prompt('Descripción / observaciones', '') ?? ''
    const now = new Date().toISOString()
    await db.incidents.add({ id: uuid(), machineId: machine.id, barId: bar.id, date: today(), type, description, status: 'resolved', createdAt: now, resolvedAt: now })
    flash('Avería añadida al historial.')
  }

  return <>
    <div className="panel-title"><div><h2>{bar.name}</h2><p>{bar.address || 'Sin dirección'}</p></div><span className="pill">{machines.filter((m) => m.active).length} máquinas</span></div>
    <div className="machine-grid">
      {machines.map((machine) => {
        const historyCount = incidents.filter((i) => i.machineId === machine.id).length
        return <div className="machine-card" key={machine.id}>
          <div className="machine-head"><span className={machine.category === 'A' ? 'type-badge a' : 'type-badge b'}>Tipo {machine.category}</span><span className="pill">{historyCount} averías</span></div>
          <h3>{machine.name}</h3><p>{machine.subtype}{machine.model ? ' · ' + machine.model : ''}</p>
          <button className="link-button" onClick={() => quickIncident(machine)}>+ Añadir avería al historial</button>
        </div>
      })}
      {machines.length === 0 && <Empty text="Este bar todavía no tiene máquinas." />}
    </div>
    <details className="details-box"><summary>Añadir máquina</summary>
      <form className="form-grid" onSubmit={addMachine}>
        <label>Tipo<select value={category} onChange={(e) => { const next = e.target.value as MachineCategory; setCategory(next); setSubtype(next === 'A' ? 'Billar' : 'Máquina recreativa') }}><option value="B">Tipo B · Tragaperras</option><option value="A">Tipo A · Billar, futbolín, dardos…</option></select></label>
        <label>Clase{category === 'A' ? <select value={subtype} onChange={(e) => setSubtype(e.target.value)}><option>Billar</option><option>Futbolín</option><option>Dardos</option><option>Otra</option></select> : <input value={subtype} onChange={(e) => setSubtype(e.target.value)} />}</label>
        <label>Identificador / nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. B-0347" /></label>
        <label>Modelo <span className="optional">opcional</span><input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ej. Manhattan" /></label>
        <button className="primary" type="submit">Guardar máquina</button>
      </form>
    </details>
  </>
}

function Empty({ text }: { text: string }) { return <div className="empty">{text}</div> }
