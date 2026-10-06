import { useState, type FormEvent } from 'react'
import { db } from '../db'
import type { Bar, CollectionEntry, Machine } from '../types'
import { formatDate, money, today, uuid } from './utils'

export function CollectionsView({ bars, machines, collections, entries, flash }: {
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
    setValues((current) => ({ ...current, [id]: { ...(current[id] ?? { amount: '', hadB: false, bAmount: '' }), ...patch } }))

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!barId || barMachines.length === 0) return
    const collectionId = uuid()
    const collectionEntries: CollectionEntry[] = barMachines.map((machine) => {
      const value = values[machine.id] ?? { amount: '', hadB: false, bAmount: '' }
      return { id: uuid(), collectionId, machineId: machine.id, amount: Number(value.amount.replace(',', '.')) || 0, hadB: value.hadB, bAmount: value.hadB ? Number(value.bAmount.replace(',', '.')) || 0 : undefined }
    })

    await db.transaction('rw', db.collections, db.collectionEntries, async () => {
      await db.collections.add({ id: collectionId, barId, date, taxesAmount: Number(taxes.replace(',', '.')) || 0, notes: notes.trim(), createdAt: new Date().toISOString() })
      await db.collectionEntries.bulkAdd(collectionEntries)
    })
    setValues({})
    setNotes('')
    flash('Recaudación guardada.')
  }

  return <section className="grid-two collection-layout">
    <div className="panel">
      <div className="panel-title"><div><h2>Nueva recaudación</h2><p>Las máquinas se cargan automáticamente según el bar</p></div></div>
      <form className="stack-form" onSubmit={save}>
        <label>Bar<select value={barId} onChange={(e) => { setBarId(e.target.value); setValues({}) }}><option value="">Selecciona un bar</option>{bars.filter((b) => b.active).map((bar) => <option key={bar.id} value={bar.id}>{bar.name}</option>)}</select></label>
        <div className="form-grid two"><label>Fecha<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><label>Tasas (€)<input inputMode="decimal" value={taxes} onChange={(e) => setTaxes(e.target.value)} /></label></div>
        {barId && barMachines.length === 0 && <div className="empty">Este bar no tiene máquinas activas.</div>}
        {barMachines.map((machine) => {
          const value = values[machine.id] ?? { amount: '', hadB: false, bAmount: '' }
          return <div className="collection-machine" key={machine.id}>
            <div><span className={machine.category === 'A' ? 'type-badge a' : 'type-badge b'}>Tipo {machine.category}</span><strong>{machine.name}</strong><small>{machine.subtype}</small></div>
            <label>Recaudación (€)<input inputMode="decimal" value={value.amount} onChange={(e) => changeValue(machine.id, { amount: e.target.value })} placeholder="0,00" /></label>
            {machine.category === 'B' && <div className="b-box"><label className="check"><input type="checkbox" checked={value.hadB} onChange={(e) => changeValue(machine.id, { hadB: e.target.checked })} /> Hubo B</label>{value.hadB && <label>Valor B (€)<input inputMode="decimal" value={value.bAmount} onChange={(e) => changeValue(machine.id, { bAmount: e.target.value })} placeholder="0,00" /></label>}</div>}
          </div>
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
          return <div className="collection-history" key={c.id}><div><strong>{bar?.name ?? 'Bar'}</strong><span>{formatDate(c.date)} · {currentEntries.length} máquinas</span></div><div className="amounts"><strong>{money(total)}</strong><small>Tasas: {money(c.taxesAmount)}{totalB ? ' · B: ' + money(totalB) : ''}</small></div></div>
        })}
        {collections.length === 0 && <div className="empty">Todavía no hay recaudaciones.</div>}
      </div>
    </div>
  </section>
}
