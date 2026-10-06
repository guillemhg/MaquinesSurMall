export const today = () => new Date().toISOString().slice(0, 10)
export const monthNow = () => new Date().toISOString().slice(0, 7)
export const money = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value || 0)
export const uuid = () => crypto.randomUUID()

export const incidentTypes = [
  'Máquina vacía',
  'Hopper vacío',
  'Recicladora',
  'Monedero',
  'Billetero',
  'Ordenador',
  'Fuente de alimentación',
  'Pantalla',
  'Botonera',
  'Cableado / conexiones',
  'Sin corriente',
  'Otra',
]

export function formatDate(date: string) {
  if (!date) return ''
  return new Intl.DateTimeFormat('es-ES').format(new Date(date + 'T12:00:00'))
}
