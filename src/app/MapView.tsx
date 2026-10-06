import { useEffect, useMemo, useState } from 'react'
import type { Bar, Incident, Machine } from '../types'

export function MapView({ bars, machines, incidents }: { bars: Bar[]; machines: Machine[]; incidents: Incident[] }) {
  const mapBars = useMemo(() => bars.filter((bar) => bar.active && Boolean(bar.address?.trim())), [bars])
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    if (!mapBars.length) {
      setSelectedId('')
      return
    }
    if (!mapBars.some((bar) => bar.id === selectedId)) setSelectedId(mapBars[0].id)
  }, [mapBars, selectedId])

  const selected = mapBars.find((bar) => bar.id === selectedId) ?? mapBars[0]
  const selectedMachines = selected ? machines.filter((machine) => machine.barId === selected.id && machine.active) : []
  const query = selected?.address?.trim() || selected?.name || ''
  const embedUrl = query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : ''
  const externalUrl = query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : ''
  const withoutAddress = bars.filter((bar) => bar.active && !bar.address?.trim()).length

  return (
    <section className="map-layout">
      <div className="panel map-bars-panel">
        <div className="panel-title"><div><h2>Bares en el mapa</h2><p>{mapBars.length} con dirección</p></div></div>
        <div className="map-bar-list">
          {mapBars.map((bar) => {
            const count = machines.filter((m) => m.barId === bar.id && m.active).length
            return (
              <button key={bar.id} className={selected?.id === bar.id ? 'map-bar-button selected' : 'map-bar-button'} onClick={() => setSelectedId(bar.id)}>
                <strong>{bar.name}</strong><span>{bar.address}</span><small>{count} máquinas</small>
              </button>
            )
          })}
          {mapBars.length === 0 && <div className="empty">Añade una dirección a un bar para verlo en el mapa.</div>}
        </div>
        {withoutAddress > 0 && <p className="muted">{withoutAddress} bar{withoutAddress > 1 ? 'es' : ''} activo{withoutAddress > 1 ? 's' : ''} sin dirección no aparece{withoutAddress > 1 ? 'n' : ''} en el mapa.</p>}
      </div>

      <div className="panel map-main-panel">
        {selected && embedUrl ? <>
          <div className="panel-title">
            <div><h2>{selected.name}</h2><p>{selected.address}</p></div>
            <a className="secondary map-link" href={externalUrl} target="_blank" rel="noreferrer">Abrir en Google Maps</a>
          </div>
          <iframe className="google-map-frame" title={`Mapa de ${selected.name}`} src={embedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          <div className="map-machines-header"><h3>Máquinas en {selected.name}</h3><span className="pill">{selectedMachines.length} activas</span></div>
          <div className="machine-grid">
            {selectedMachines.map((machine) => {
              const historyCount = incidents.filter((incident) => incident.machineId === machine.id).length
              return (
                <div className="machine-card" key={machine.id}>
                  <div className="machine-head"><span className={machine.category === 'A' ? 'type-badge a' : 'type-badge b'}>Tipo {machine.category}</span><span className="pill">{historyCount} averías</span></div>
                  <h3>{machine.name}</h3><p>{machine.subtype}{machine.model ? ' · ' + machine.model : ''}</p>
                </div>
              )
            })}
            {selectedMachines.length === 0 && <div className="empty">Este bar no tiene máquinas activas.</div>}
          </div>
          <p className="muted map-privacy-note">El mapa se carga desde Google Maps. El resto de los datos de la aplicación continúa guardándose localmente en el dispositivo.</p>
        </> : <div className="empty">No hay bares con dirección para mostrar.</div>}
      </div>
    </section>
  )
}
