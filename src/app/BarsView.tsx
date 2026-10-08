import { useEffect, useState, type FormEvent } from 'react'
import { db } from '../db'
import type { Bar, Incident, Machine, MachineCategory, SlotFormat } from '../types'
import { formatDate, today, uuid } from './utils'

export function BarsView({ bars, machines, incidents, selectedBar, selectBar, flash }: { bars: Bar[]; machines: Machine[]; incidents: Incident[]; selectedBar?: Bar; selectBar: (id: string | null) => void; flash: (message: string) => void }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [contractExpiry, setContractExpiry] = useState('')

  async function addBar(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !contractExpiry) return
    const bar: Bar = {
      id: uuid(),
      name: name.trim(),
      address: address.trim(),
      contractExpiry,
      active: true,
      createdAt: new Date().toISOString(),
    }
    await db.bars.add(bar)
    setName('')
    setAddress('')
    setContractExpiry('')
    selectBar(bar.id)
    flash('Bar añadido.')
  }

  const activeBars = bars.filter((bar) => bar.active).length

  return <section className="grid-bars">
    <div className="panel">
      <div className="panel-title"><div><h2>Bares</h2><p>{activeBars} activos · {bars.length - activeBars} inactivos</p></div></div>
      <form className="stack-form" onSubmit={addBar}>
        <label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Bar Can Toni" /></label>
        <label>Dirección <span className="optional">opcional</span><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección" /></label>
        <label>Fecha de caducidad del contrato<input type="date" required value={contractExpiry} onChange={(e) => setContractExpiry(e.target.value)} /></label>
        <button className="primary" type="submit">Añadir bar</button>
      </form>
      <div className="bar-list">
        {bars.map((bar) => {
          const count = machines.filter((m) => m.barId === bar.id && m.active).length
          const historyCount = incidents.filter((i) => i.barId === bar.id).length
          return <button key={bar.id} className={selectedBar?.id === bar.id ? 'bar-item selected' : 'bar-item'} onClick={() => selectBar(bar.id)}>
            <div>
              <strong>{bar.name}</strong>
              <span>{count} máquinas · {historyCount} averías registradas</span>
              <span className={bar.contractExpiry ? 'contract-info' : 'contract-info missing'}>{bar.contractExpiry ? `Contrato hasta ${formatDate(bar.contractExpiry)}` : 'Caducidad de contrato pendiente'}</span>
              <span className="bar-item-status"><span className={bar.active ? 'status-pill active' : 'status-pill inactive'}>{bar.active ? 'Activo' : 'Inactivo'}</span></span>
            </div>
            <span>›</span>
          </button>
        })}
        {bars.length === 0 && <Empty text="Añade el primer bar para empezar." />}
      </div>
    </div>
    <div className="panel">{selectedBar ? <BarDetail bar={selectedBar} machines={machines.filter((m) => m.barId === selectedBar.id)} incidents={incidents} selectBar={selectBar} flash={flash} /> : <Empty text="Selecciona un bar para ver sus máquinas." />}</div>
  </section>
}

function BarDetail({ bar, machines, incidents, selectBar, flash }: { bar: Bar; machines: Machine[]; incidents: Incident[]; selectBar: (id: string | null) => void; flash: (m: string) => void }) {
  const [category, setCategory] = useState<MachineCategory>('B')
  const [subtype, setSubtype] = useState('Máquina recreativa')
  const [name, setName] = useState('')
  const [model, setModel] = useState('')
  const [slotFormat, setSlotFormat] = useState<SlotFormat>('simple')
  const [editingBar, setEditingBar] = useState(false)
  const [editName, setEditName] = useState(bar.name)
  const [editAddress, setEditAddress] = useState(bar.address ?? '')
  const [editContractExpiry, setEditContractExpiry] = useState(bar.contractExpiry ?? '')

  useEffect(() => {
    setEditName(bar.name)
    setEditAddress(bar.address ?? '')
    setEditContractExpiry(bar.contractExpiry ?? '')
    setEditingBar(false)
  }, [bar.id, bar.name, bar.address, bar.contractExpiry])

  async function addMachine(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const machine: Machine = {
      id: uuid(),
      barId: bar.id,
      category,
      subtype: subtype.trim() || (category === 'A' ? 'Otra' : 'Máquina recreativa'),
      name: name.trim(),
      model: model.trim(),
      slotFormat: category === 'B' ? slotFormat : undefined,
      active: true,
      createdAt: new Date().toISOString(),
    }
    await db.machines.add(machine)
    setName('')
    setModel('')
    setSlotFormat('simple')
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

  async function saveBar(e: FormEvent) {
    e.preventDefault()
    if (!editName.trim()) return
    await db.bars.update(bar.id, {
      name: editName.trim(),
      address: editAddress.trim(),
      contractExpiry: editContractExpiry || undefined,
    })
    setEditingBar(false)
    flash('Bar actualizado.')
  }

  async function toggleBarActive() {
    await db.bars.update(bar.id, { active: !bar.active })
    flash(bar.active ? 'Bar marcado como inactivo.' : 'Bar marcado como activo.')
  }

  async function changeSlotFormat(machine: Machine, next: SlotFormat) {
    await db.machines.update(machine.id, { slotFormat: next })
    flash(next === 'twin' ? 'Máquina marcada como Twin.' : 'Máquina marcada como Simple.')
  }

  async function deleteBar() {
    const collectionCount = await db.collections.where('barId').equals(bar.id).count()
    const incidentCount = incidents.filter((incident) => incident.barId === bar.id).length
    const routeCount = await db.routeEntries.where('barId').equals(bar.id).count()

    if (machines.length > 0 || collectionCount > 0 || incidentCount > 0 || routeCount > 0) {
      window.alert('Este bar tiene máquinas, historial o una ruta asociada. Para no perder datos, márcalo como Inactivo en lugar de eliminarlo.')
      return
    }

    const ok = window.confirm(`¿Eliminar definitivamente “${bar.name}”? Esta acción no se puede deshacer.`)
    if (!ok) return

    await db.bars.delete(bar.id)
    selectBar(null)
    flash('Bar eliminado.')
  }

  return <>
    <div className="panel-title bar-detail-header">
      <div>
        <h2>{bar.name}</h2>
        <p>{bar.address || 'Sin dirección'}</p>
        <p className={bar.contractExpiry ? 'contract-detail' : 'contract-detail missing'}>{bar.contractExpiry ? `Contrato hasta ${formatDate(bar.contractExpiry)}` : 'Fecha de caducidad del contrato pendiente'}</p>
      </div>
      <div className="bar-header-actions">
        <span className={bar.active ? 'status-pill active' : 'status-pill inactive'}>{bar.active ? 'Activo' : 'Inactivo'}</span>
        <span className="pill">{machines.filter((m) => m.active).length} máquinas</span>
      </div>
    </div>

    <div className="bar-admin-card">
      <div className="bar-admin-row">
        <div className="bar-admin-copy">
          <strong>Estado del bar</strong>
          <span>Los bares inactivos se conservan en el historial, pero no aparecen al crear nuevas recaudaciones.</span>
        </div>
        <div className="bar-action-buttons">
          <button className={bar.active ? 'status-toggle active' : 'status-toggle inactive'} onClick={toggleBarActive}>{bar.active ? 'Activo' : 'Inactivo'}</button>
          <button className="secondary" onClick={() => setEditingBar((current) => !current)}>{editingBar ? 'Cancelar edición' : 'Editar bar'}</button>
          <button className="danger-button" onClick={deleteBar}>Eliminar</button>
        </div>
      </div>

      {editingBar && <form className="edit-bar-form" onSubmit={saveBar}>
        <label>Nombre<input value={editName} onChange={(e) => setEditName(e.target.value)} /></label>
        <label>Dirección<input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Dirección" /></label>
        <label>Fecha de caducidad del contrato<input type="date" value={editContractExpiry} onChange={(e) => setEditContractExpiry(e.target.value)} /></label>
        <div className="edit-bar-actions">
          <button className="secondary" type="button" onClick={() => { setEditName(bar.name); setEditAddress(bar.address ?? ''); setEditContractExpiry(bar.contractExpiry ?? ''); setEditingBar(false) }}>Cancelar</button>
          <button className="primary" type="submit">Guardar cambios</button>
        </div>
      </form>}
    </div>

    <div className="machine-grid">
      {machines.map((machine) => {
        const historyCount = incidents.filter((i) => i.machineId === machine.id).length
        const effectiveSlotFormat: SlotFormat = machine.slotFormat ?? 'simple'
        return <div className="machine-card" key={machine.id}>
          <div className="machine-head">
            <div className="machine-badges">
              <span className={machine.category === 'A' ? 'type-badge a' : 'type-badge b'}>Tipo {machine.category}</span>
              {machine.category === 'B' && <span className={effectiveSlotFormat === 'twin' ? 'slot-badge twin' : 'slot-badge simple'}>{effectiveSlotFormat === 'twin' ? 'Twin' : 'Simple'}</span>}
            </div>
            <span className="pill">{historyCount} averías</span>
          </div>
          <h3>{machine.name}</h3><p>{machine.subtype}{machine.model ? ' · ' + machine.model : ''}</p>
          {machine.category === 'B' && <label className="machine-slot-config">Configuración de tragaperras
            <select value={effectiveSlotFormat} onChange={(e) => changeSlotFormat(machine, e.target.value as SlotFormat)}>
              <option value="simple">Simple · tasa predeterminada 180 €</option>
              <option value="twin">Twin · tasa predeterminada 290 €</option>
            </select>
          </label>}
          <button className="link-button" onClick={() => quickIncident(machine)}>+ Añadir avería al historial</button>
        </div>
      })}
      {machines.length === 0 && <Empty text="Este bar todavía no tiene máquinas." />}
    </div>
    <details className="details-box"><summary>Añadir máquina</summary>
      <form className="form-grid" onSubmit={addMachine}>
        <label>Tipo<select value={category} onChange={(e) => { const next = e.target.value as MachineCategory; setCategory(next); setSubtype(next === 'A' ? 'Billar' : 'Máquina recreativa'); setSlotFormat('simple') }}><option value="B">Tipo B · Tragaperras</option><option value="A">Tipo A · Billar, futbolín, dardos, pinball…</option></select></label>
        <label>Clase{category === 'A' ? <select value={subtype} onChange={(e) => setSubtype(e.target.value)}><option>Billar</option><option>Futbolín</option><option>Dardos</option><option>Pinball</option><option>Otra</option></select> : <input value={subtype} onChange={(e) => setSubtype(e.target.value)} />}</label>
        {category === 'B' && <label>Configuración<select value={slotFormat} onChange={(e) => setSlotFormat(e.target.value as SlotFormat)}><option value="simple">Simple</option><option value="twin">Twin</option></select></label>}
        <label>Identificador / nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. B-0347" /></label>
        <label>Modelo <span className="optional">opcional</span><input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ej. Manhattan" /></label>
        <button className="primary" type="submit">Guardar máquina</button>
      </form>
    </details>
  </>
}

function Empty({ text }: { text: string }) { return <div className="empty">{text}</div> }
