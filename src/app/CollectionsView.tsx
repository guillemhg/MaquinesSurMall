import { useMemo, useState, type FormEvent } from 'react'
import { db } from '../db'
import type { Bar, CollectionEntry, Machine, RouteEntry, RouteGroup } from '../types'
import { formatDate, money, today, uuid } from './utils'

export function CollectionsView({ bars, machines, collections, entries, routeGroups, routeEntries, flash }: {
  bars: Bar[]
  machines: Machine[]
  collections: { id: string; barId: string; date: string; taxesAmount: number; notes?: string }[]
  entries: CollectionEntry[]
  routeGroups: RouteGroup[]
  routeEntries: RouteEntry[]
  flash: (m: string) => void
}) {
  const [routeGroupId, setRouteGroupId] = useState('')
  const [barId, setBarId] = useState('')
  const [date, setDate] = useState(today())
  const [taxes, setTaxes] = useState('0')
  const [notes, setNotes] = useState('')
  const [values, setValues] = useState<Record<string, { amount: string; hadB: boolean; bAmount: string }>>({})

  const allowedRouteBarIds = useMemo(() => {
    if (!routeGroupId) return null
    return new Set(routeEntries.filter((entry) => entry.groupId === routeGroupId).map((entry) => entry.barId))
  }, [routeGroupId, routeEntries])

  const visibleBars = bars.filter((bar) => bar.active && (!allowedRouteBarIds || allowedRouteBarIds.has(bar.id)))
  const barMachines = machines.filter((m) => m.barId === barId && m.active)
  const typeBMachines = barMachines.filter((m) => m.category === 'B')
  const selectedHasTwin = typeBMachines.some((m) => m.slotFormat === 'twin')
  const selectedHasTypeB = typeBMachines.length > 0

  const defaultTaxesForBar = (nextBarId: string) => {
    const activeTypeB = machines.filter((m) => m.barId === nextBarId && m.active && m.category === 'B')
    if (activeTypeB.length === 0) return '0'
    const hasTwin = activeTypeB.some((m) => m.slotFormat === 'twin')
    return hasTwin ? '290' : '180'
  }

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

  const selectedRouteGroup = routeGroups.find((group) => group.id === routeGroupId)

  return <section className="grid-two collection-layout">
    <div className="panel">
      <div className="panel-title"><div><h2>Nueva recaudación</h2><p>Filtra por ruta y después elige el bar.</p></div></div>
      <form className="stack-form" onSubmit={save}>
        <label>Ruta / grupo <span className="optional">opcional</span>
          <select value={routeGroupId} onChange={(e) => { setRouteGroupId(e.target.value); setBarId(''); setValues({}); setTaxes('0') }}>
            <option value="">Todos los bares</option>
            {routeGroups.filter((group) => group.active).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </label>
        {routeGroupId && <div className="route-filter-note">Mostrando únicamente bares incluidos en <strong>{selectedRouteGroup?.name ?? 'esta ruta'}</strong>.</div>}
        <label>Bar
          <select value={barId} onChange={(e) => { const nextBarId = e.target.value; setBarId(nextBarId); setValues({}); setTaxes(nextBarId ? defaultTaxesForBar(nextBarId) : '0') }}>
            <option value="">Selecciona un bar</option>
            {visibleBars.map((bar) => <option key={bar.id} value={bar.id}>{bar.name}</option>)}
          </select>
        </label>
        {routeGroupId && visibleBars.length === 0 && <div className="empty">Este grupo todavía no tiene bares planificados en Rutas.</div>}
        <div className="form-grid two">
          <label>Fecha<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Tasas (€)<input inputMode="decimal" value={taxes} onChange={(e) => setTaxes(e.target.value)} /><span className="tax-hint">{barId ? (!selectedHasTypeB ? 'Este bar solo tiene máquinas Tipo A: 0 € de tasa.' : selectedHasTwin ? 'Hay una Tipo B Twin: 290 € por defecto. Puedes modificarlo.' : 'Tipo B Simple: 180 € por defecto. Puedes modificarlo.') : 'Solo las máquinas Tipo B tienen tasa. Tipo A: 0 €.'}</span></label>
        </div>
        {barId && barMachines.length === 0 && <div className="empty">Este bar no tiene máquinas activas.</div>}
        {barMachines.map((machine) => {
          const value = values[machine.id] ?? { amount: '', hadB: false, bAmount: '' }
          const slotFormat = machine.category === 'B' ? (machine.slotFormat ?? 'simple') : undefined
          return <div className="collection-machine" key={machine.id}>
            <div>
              <div className="machine-badges"><span className={machine.category === 'A' ? 'type-badge a' : 'type-badge b'}>Tipo {machine.category}</span>{slotFormat && <span className={slotFormat === 'twin' ? 'slot-badge twin' : 'slot-badge simple'}>{slotFormat === 'twin' ? 'Twin' : 'Simple'}</span>}</div>
              <strong>{machine.name}</strong><small>{machine.subtype}</small>
            </div>
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
