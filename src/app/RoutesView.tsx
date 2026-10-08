import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { db } from '../db'
import type { Bar, RouteEntry, RouteGroup } from '../types'
import { uuid } from './utils'

const DAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
]

const WEEKS = [1, 2]

export function RoutesView({
  bars,
  groups,
  routeEntries,
  flash,
}: {
  bars: Bar[]
  groups: RouteGroup[]
  routeEntries: RouteEntry[]
  flash: (message: string) => void
}) {
  const [groupName, setGroupName] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [barId, setBarId] = useState('')
  const [week, setWeek] = useState('1')
  const [dayOfWeek, setDayOfWeek] = useState('1')

  useEffect(() => {
    if (selectedGroupId && groups.some((group) => group.id === selectedGroupId)) return
    setSelectedGroupId(groups[0]?.id ?? '')
  }, [groups, selectedGroupId])

  const selectedGroup = groups.find((group) => group.id === selectedGroupId)
  const selectedEntries = useMemo(
    () => routeEntries.filter((entry) => entry.groupId === selectedGroupId && entry.week <= 2),
    [routeEntries, selectedGroupId],
  )
  const uniqueBars = new Set(selectedEntries.map((entry) => entry.barId)).size

  async function addGroup(e: FormEvent) {
    e.preventDefault()
    if (!groupName.trim()) return
    const group: RouteGroup = {
      id: uuid(),
      name: groupName.trim(),
      active: true,
      createdAt: new Date().toISOString(),
    }
    await db.routeGroups.add(group)
    setGroupName('')
    setSelectedGroupId(group.id)
    flash('Grupo de ruta creado.')
  }

  async function renameGroup() {
    if (!selectedGroup) return
    const next = window.prompt('Nuevo nombre del grupo', selectedGroup.name)
    if (!next?.trim()) return
    await db.routeGroups.update(selectedGroup.id, { name: next.trim() })
    flash('Grupo actualizado.')
  }

  async function deleteGroup() {
    if (!selectedGroup) return
    const ok = window.confirm(`¿Eliminar “${selectedGroup.name}” y toda su planificación del ciclo de 2 semanas?`)
    if (!ok) return
    await db.transaction('rw', db.routeGroups, db.routeEntries, async () => {
      await db.routeEntries.where('groupId').equals(selectedGroup.id).delete()
      await db.routeGroups.delete(selectedGroup.id)
    })
    setSelectedGroupId('')
    flash('Grupo de ruta eliminado.')
  }

  async function addRouteEntry(e: FormEvent) {
    e.preventDefault()
    if (!selectedGroupId || !barId) return
    const weekNumber = Number(week)
    const dayNumber = Number(dayOfWeek)
    const duplicate = routeEntries.some(
      (entry) => entry.groupId === selectedGroupId && entry.barId === barId && entry.week === weekNumber && entry.dayOfWeek === dayNumber,
    )
    if (duplicate) {
      window.alert('Este bar ya está añadido en ese día de esa semana.')
      return
    }
    await db.routeEntries.add({
      id: uuid(),
      groupId: selectedGroupId,
      barId,
      week: weekNumber,
      dayOfWeek: dayNumber,
      createdAt: new Date().toISOString(),
    })
    setBarId('')
    flash('Bar añadido a la ruta.')
  }

  async function removeEntry(id: string) {
    await db.routeEntries.delete(id)
    flash('Bar quitado de esa jornada.')
  }

  return (
    <section className="route-layout">
      <div className="panel route-groups-panel">
        <div className="panel-title"><div><h2>Grupos de recaudación</h2><p>Crea zonas o rutas para encontrar los bares rápidamente.</p></div></div>
        <form className="stack-form" onSubmit={addGroup}>
          <label>Nombre del grupo<input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ej. Recaudaciones Campos" /></label>
          <button className="primary" type="submit">Crear grupo</button>
        </form>

        <div className="route-group-list">
          {groups.map((group) => {
            const groupEntries = routeEntries.filter((entry) => entry.groupId === group.id && entry.week <= 2)
            const barCount = new Set(groupEntries.map((entry) => entry.barId)).size
            return <button key={group.id} className={group.id === selectedGroupId ? 'route-group-button selected' : 'route-group-button'} onClick={() => setSelectedGroupId(group.id)}>
              <strong>{group.name}</strong>
              <span>{barCount} bares · {groupEntries.length} visitas por ciclo</span>
            </button>
          })}
          {groups.length === 0 && <div className="empty">Crea el primer grupo, por ejemplo “Recaudaciones Campos”.</div>}
        </div>
      </div>

      <div className="panel route-calendar-panel">
        {!selectedGroup ? <div className="empty">Selecciona o crea un grupo para planificar su ciclo de 2 semanas.</div> : <>
          <div className="route-calendar-header">
            <div>
              <span className="route-kicker">Ciclo repetitivo de 2 semanas</span>
              <h2>{selectedGroup.name}</h2>
              <p>{uniqueBars} bares distintos · {selectedEntries.length} visitas por ciclo</p>
            </div>
            <div className="route-header-actions">
              <button className="secondary" onClick={renameGroup}>Renombrar</button>
              <button className="danger-button" onClick={deleteGroup}>Eliminar grupo</button>
            </div>
          </div>

          <div className="route-help-note">
            La planificación funciona en ciclo: <strong>Semana 1 → Semana 2 → Semana 1 → Semana 2…</strong>. Está pensada especialmente para las recaudaciones quincenales de máquinas Tipo B.
          </div>

          <form className="route-entry-form" onSubmit={addRouteEntry}>
            <label>Bar
              <select value={barId} onChange={(e) => setBarId(e.target.value)}>
                <option value="">Selecciona un bar</option>
                {bars.filter((bar) => bar.active).map((bar) => <option key={bar.id} value={bar.id}>{bar.name}</option>)}
              </select>
            </label>
            <label>Semana del ciclo
              <select value={week} onChange={(e) => setWeek(e.target.value)}>{WEEKS.map((value) => <option key={value} value={value}>Semana {value}</option>)}</select>
            </label>
            <label>Día
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>{DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select>
            </label>
            <button className="primary" type="submit" disabled={!barId}>Añadir a la ruta</button>
          </form>

          <div className="route-help-note">
            Los bares que añadas a este grupo aparecerán filtrados cuando elijas <strong>{selectedGroup.name}</strong> al crear una recaudación.
          </div>

          <div className="route-weeks-grid">
            {WEEKS.map((weekNumber) => <div className="route-week-card" key={weekNumber}>
              <div className="route-week-title">Semana {weekNumber}</div>
              {DAYS.map((day) => {
                const dayEntries = selectedEntries.filter((entry) => entry.week === weekNumber && entry.dayOfWeek === day.value)
                return <div className="route-day-row" key={day.value}>
                  <span className="route-day-name">{day.label}</span>
                  <div className="route-day-bars">
                    {dayEntries.map((entry) => {
                      const bar = bars.find((item) => item.id === entry.barId)
                      return <span className={bar?.active === false ? 'route-bar-chip inactive' : 'route-bar-chip'} key={entry.id}>
                        {bar?.name ?? 'Bar eliminado'}
                        <button type="button" aria-label="Quitar de la ruta" onClick={() => removeEntry(entry.id)}>×</button>
                      </span>
                    })}
                    {dayEntries.length === 0 && <span className="route-day-empty">—</span>}
                  </div>
                </div>
              })}
            </div>)}
          </div>
        </>}
      </div>
    </section>
  )
}
