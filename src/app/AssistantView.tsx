import { useMemo, useState, type FormEvent } from 'react'
import type { Bar, Collection, CollectionEntry, Incident, Machine } from '../types'

interface AssistantViewProps {
  bars: Bar[]
  machines: Machine[]
  incidents: Incident[]
  collections: Collection[]
  entries: CollectionEntry[]
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

type DateRange = {
  from?: string
  to?: string
  label: string
}

const euro = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value || 0)

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const toIso = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

const formatShortDate = (date: string) =>
  new Intl.DateTimeFormat('es-ES').format(new Date(`${date}T12:00:00`))

const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function getRange(question: string): DateRange {
  const q = normalize(question)
  const now = new Date()
  const today = toIso(now)

  if (q.includes('este mes')) {
    return {
      from: toIso(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: today,
      label: 'este mes',
    }
  }

  if (q.includes('mes pasado') || q.includes('ultimo mes')) {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const to = new Date(now.getFullYear(), now.getMonth(), 0)
    return { from: toIso(from), to: toIso(to), label: 'el mes pasado' }
  }

  const monthsMatch = q.match(/ultim(?:o|os|a|as)\s+(\d+)\s+mes/)
  if (monthsMatch) {
    const months = Math.max(1, Number(monthsMatch[1]))
    const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
    return { from: toIso(from), to: today, label: `los últimos ${months} meses` }
  }

  if (q.includes('este ano')) {
    return { from: `${now.getFullYear()}-01-01`, to: today, label: 'este año' }
  }

  if (q.includes('ano pasado')) {
    const year = now.getFullYear() - 1
    return { from: `${year}-01-01`, to: `${year}-12-31`, label: 'el año pasado' }
  }

  const daysMatch = q.match(/ultim(?:o|os|a|as)\s+(\d+)\s+dia/)
  if (daysMatch) {
    const days = Math.max(1, Number(daysMatch[1]))
    const from = new Date(now)
    from.setDate(from.getDate() - (days - 1))
    return { from: toIso(from), to: today, label: `los últimos ${days} días` }
  }

  return { label: 'todo el histórico' }
}

function inRange(date: string, range: DateRange) {
  if (range.from && date < range.from) return false
  if (range.to && date > range.to) return false
  return true
}

function cleanEntityName(value: string) {
  return normalize(value).replace(/^(bar|cafeteria|cafe|restaurante)\s+/, '').trim()
}

function findBar(question: string, bars: Bar[]) {
  const q = normalize(question)
  return [...bars]
    .sort((a, b) => b.name.length - a.name.length)
    .find((bar) => {
      const full = normalize(bar.name)
      const clean = cleanEntityName(bar.name)
      return q.includes(full) || (clean.length >= 3 && q.includes(clean))
    })
}

function findMachine(question: string, machines: Machine[]) {
  const q = normalize(question)
  return [...machines]
    .sort((a, b) => b.name.length - a.name.length)
    .find((machine) => {
      const name = normalize(machine.name)
      const model = normalize(machine.model || '')
      return (name.length >= 2 && q.includes(name)) || (model.length >= 4 && q.includes(model))
    })
}

function monthlyBreakdown(
  filteredCollections: Collection[],
  entries: CollectionEntry[],
  machineId?: string,
) {
  const collectionById = new Map(filteredCollections.map((collection) => [collection.id, collection]))
  const totals = new Map<string, number>()

  entries.forEach((entry) => {
    if (machineId && entry.machineId !== machineId) return
    const collection = collectionById.get(entry.collectionId)
    if (!collection) return
    const key = collection.date.slice(0, 7)
    totals.set(key, (totals.get(key) || 0) + entry.amount)
  })

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${monthLabel(key)}: ${euro(value)}`)
}

function answerQuestion(
  question: string,
  bars: Bar[],
  machines: Machine[],
  incidents: Incident[],
  collections: Collection[],
  entries: CollectionEntry[],
) {
  const q = normalize(question)
  const range = getRange(question)
  const bar = findBar(question, bars)
  const machine = findMachine(question, machines)

  if (q.includes('bar') && q.includes('inactiv')) {
    const inactive = bars.filter((item) => !item.active)
    if (!inactive.length) return 'No hay ningún bar marcado como inactivo.'
    return `Hay ${inactive.length} bar${inactive.length === 1 ? '' : 'es'} inactivo${inactive.length === 1 ? '' : 's'}:\n${inactive.map((item) => `• ${item.name}`).join('\n')}`
  }

  if (q.includes('bar') && q.includes('activ') && !q.includes('inactiv') && (q.includes('cuant') || q.includes('lista') || q.includes('cuales'))) {
    const active = bars.filter((item) => item.active)
    return `Hay ${active.length} bar${active.length === 1 ? '' : 'es'} activo${active.length === 1 ? '' : 's'}.\n${active.map((item) => `• ${item.name}`).join('\n')}`
  }

  if (q.includes('maquina') && (q.includes('cuant') || q.includes('tenemos') || q.includes('tiene'))) {
    let filtered = machines
    if (bar) filtered = filtered.filter((item) => item.barId === bar.id)
    if (q.includes('activ')) filtered = filtered.filter((item) => item.active)
    if (q.includes('inactiv')) filtered = filtered.filter((item) => !item.active)
    if (/tipo\s*b/.test(q)) filtered = filtered.filter((item) => item.category === 'B')
    if (/tipo\s*a/.test(q)) filtered = filtered.filter((item) => item.category === 'A')

    const context = bar ? ` en ${bar.name}` : ''
    const type = /tipo\s*b/.test(q) ? ' tipo B' : /tipo\s*a/.test(q) ? ' tipo A' : ''
    const status = q.includes('inactiv') ? ' inactivas' : q.includes('activ') ? ' activas' : ''
    return `Hay ${filtered.length} máquina${filtered.length === 1 ? '' : 's'}${type}${status}${context}.`
  }

  if (q.includes('tasa')) {
    const filteredCollections = collections.filter((collection) =>
      inRange(collection.date, range) && (!bar || collection.barId === bar.id),
    )
    const total = filteredCollections.reduce((sum, collection) => sum + (collection.taxesAmount || 0), 0)
    const context = bar ? ` de ${bar.name}` : ''
    return `Las tasas${context} en ${range.label} suman ${euro(total)}.\n${filteredCollections.length} recaudación${filteredCollections.length === 1 ? '' : 'es'} incluida${filteredCollections.length === 1 ? '' : 's'}.`
  }

  if (q.includes('averia') || q.includes('fallo') || q.includes('incidencia')) {
    let filtered = incidents.filter((incident) => inRange(incident.date, range))
    if (bar) filtered = filtered.filter((incident) => incident.barId === bar.id)
    if (machine) filtered = filtered.filter((incident) => incident.machineId === machine.id)

    const knownTypes = [...new Set(incidents.map((incident) => incident.type))]
      .sort((a, b) => b.length - a.length)
    const requestedType = knownTypes.find((type) => {
      const normalizedType = normalize(type)
      return normalizedType.length >= 4 && q.includes(normalizedType)
    })
    if (requestedType) filtered = filtered.filter((incident) => incident.type === requestedType)

    const context = machine ? ` de ${machine.name}` : bar ? ` de ${bar.name}` : ''
    const typeText = requestedType ? ` de tipo “${requestedType}”` : ''
    const header = `Hay ${filtered.length} avería${filtered.length === 1 ? '' : 's'}${typeText}${context} en ${range.label}.`
    if (!filtered.length) return header

    const byType = new Map<string, number>()
    filtered.forEach((incident) => byType.set(incident.type, (byType.get(incident.type) || 0) + 1))
    const breakdown = [...byType.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => `• ${type}: ${count}`)
      .join('\n')
    return `${header}\n${breakdown}`
  }

  const asksRevenue = q.includes('recaud') || q.includes('ingres') || q.includes('factur')
  if (asksRevenue) {
    const filteredCollections = collections.filter((collection) =>
      inRange(collection.date, range) && (!bar || collection.barId === bar.id),
    )
    const collectionIds = new Set(filteredCollections.map((collection) => collection.id))
    const filteredEntries = entries.filter((entry) =>
      collectionIds.has(entry.collectionId) && (!machine || entry.machineId === machine.id),
    )

    if ((q.includes('que bar') || q.includes('cual bar')) && q.includes('mas')) {
      const totals = new Map<string, number>()
      const byCollection = new Map(filteredCollections.map((collection) => [collection.id, collection]))
      filteredEntries.forEach((entry) => {
        const collection = byCollection.get(entry.collectionId)
        if (!collection) return
        totals.set(collection.barId, (totals.get(collection.barId) || 0) + entry.amount)
      })
      const ranking = [...totals.entries()].sort((a, b) => b[1] - a[1])
      if (!ranking.length) return `No hay recaudaciones registradas en ${range.label}.`
      const [barId, total] = ranking[0]
      const winner = bars.find((item) => item.id === barId)
      return `${winner?.name ?? 'El bar'} es el que más ha recaudado en ${range.label}: ${euro(total)}.\n\nTop 3:\n${ranking.slice(0, 3).map(([id, value], index) => `${index + 1}. ${bars.find((item) => item.id === id)?.name ?? 'Bar'} — ${euro(value)}`).join('\n')}`
    }

    if (q.includes('maquina') && q.includes('mas')) {
      const totals = new Map<string, number>()
      filteredEntries.forEach((entry) => totals.set(entry.machineId, (totals.get(entry.machineId) || 0) + entry.amount))
      const ranking = [...totals.entries()].sort((a, b) => b[1] - a[1])
      if (!ranking.length) return `No hay recaudaciones de máquinas registradas en ${range.label}.`
      const [machineId, total] = ranking[0]
      const winner = machines.find((item) => item.id === machineId)
      return `${winner?.name ?? 'La máquina'} es la que más ha recaudado${bar ? ` en ${bar.name}` : ''} en ${range.label}: ${euro(total)}.\n\nTop 3:\n${ranking.slice(0, 3).map(([id, value], index) => `${index + 1}. ${machines.find((item) => item.id === id)?.name ?? 'Máquina'} — ${euro(value)}`).join('\n')}`
    }

    if (!bar && !machine && q.includes('bar ') && bars.length) {
      return `No encuentro el bar que indicas. Prueba escribiendo el nombre tal como aparece en la app.\n\nBares disponibles:\n${bars.slice(0, 8).map((item) => `• ${item.name}`).join('\n')}`
    }

    const gross = filteredEntries.reduce((sum, entry) => sum + entry.amount, 0)
    const totalB = filteredEntries.reduce((sum, entry) => sum + (entry.bAmount || 0), 0)
    const taxes = machine ? 0 : filteredCollections.reduce((sum, collection) => sum + (collection.taxesAmount || 0), 0)
    const context = machine ? machine.name : bar ? bar.name : 'el conjunto de bares'

    if (!filteredEntries.length) return `No hay recaudaciones registradas para ${context} en ${range.label}.`

    const breakdown = monthlyBreakdown(filteredCollections, filteredEntries, machine?.id)
    const details = [
      `Recaudación bruta: ${euro(gross)}`,
      !machine ? `Tasas registradas: ${euro(taxes)}` : '',
      totalB ? `Valor B registrado: ${euro(totalB)}` : '',
      `${filteredCollections.length} recaudación${filteredCollections.length === 1 ? '' : 'es'} incluida${filteredCollections.length === 1 ? '' : 's'}`,
    ].filter(Boolean)

    return `${context} ha recaudado ${euro(gross)} en ${range.label}.\n\n${details.join('\n')}\n\nDesglose:\n${breakdown.join('\n')}\n\nLa cifra principal es la recaudación bruta registrada; no resto tasas ni B.`
  }

  return `No he entendido del todo la consulta. Prueba con preguntas como:\n• “¿Cuánto ha recaudado Bar Pepito los últimos 2 meses?”\n• “¿Qué bar ha recaudado más este mes?”\n• “¿Cuánto hemos pagado en tasas este año?”\n• “¿Cuántas averías de ordenador hemos tenido este año?”\n• “¿Cuántas máquinas tipo B tenemos activas?”\n• “¿Qué bares están inactivos?”`
}

export function AssistantView({ bars, machines, incidents, collections, entries }: AssistantViewProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Soy el asistente local de Recreativos Sur. Puedo consultar recaudaciones, tasas, averías, bares y máquinas usando únicamente los datos guardados en este dispositivo.',
    },
  ])

  const suggestions = useMemo(() => {
    const exampleBar = bars[0]?.name || 'Bar Pepito'
    return [
      `¿Cuánto ha recaudado ${exampleBar} los últimos 2 meses?`,
      '¿Qué bar ha recaudado más este mes?',
      '¿Cuánto hemos pagado en tasas este año?',
      '¿Cuántas averías de ordenador hemos tenido este año?',
      '¿Cuántas máquinas tipo B tenemos activas?',
    ]
  }, [bars])

  function ask(question: string) {
    const trimmed = question.trim()
    if (!trimmed) return

    const reply = answerQuestion(trimmed, bars, machines, incidents, collections, entries)
    const stamp = Date.now().toString()
    setMessages((current) => [
      ...current,
      { id: `${stamp}-user`, role: 'user', text: trimmed },
      { id: `${stamp}-assistant`, role: 'assistant', text: reply },
    ])
    setInput('')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    ask(input)
  }

  return (
    <section className="assistant-layout">
      <div className="panel assistant-main">
        <div className="panel-title assistant-heading">
          <div>
            <h2>Asistente local</h2>
            <p>Pregúntale por los datos de la empresa en lenguaje normal</p>
          </div>
          <span className="assistant-local-badge">100 % local</span>
        </div>

        <div className="assistant-messages" aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className={`assistant-message ${message.role}`}>
              <div className="assistant-message-label">{message.role === 'user' ? 'Tú' : 'Asistente Sur'}</div>
              <div className="assistant-bubble">{message.text}</div>
            </div>
          ))}
        </div>

        <form className="assistant-form" onSubmit={submit}>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ej. Dime cuánto ha recaudado Bar Pepito los últimos 2 meses"
            autoComplete="off"
          />
          <button className="primary" type="submit" disabled={!input.trim()}>Preguntar</button>
        </form>
      </div>

      <aside className="panel assistant-side">
        <div className="panel-title">
          <div><h2>Prueba estas consultas</h2><p>Pulsa una para ejecutarla</p></div>
        </div>
        <div className="assistant-suggestions">
          {suggestions.map((suggestion) => (
            <button key={suggestion} onClick={() => ask(suggestion)}>{suggestion}</button>
          ))}
        </div>

        <div className="assistant-privacy-note">
          <strong>Sin IA externa</strong>
          <p>Las preguntas se interpretan dentro de la aplicación y los cálculos se hacen con IndexedDB. No se envían bares, máquinas ni recaudaciones a ningún servidor.</p>
        </div>
      </aside>
    </section>
  )
}
