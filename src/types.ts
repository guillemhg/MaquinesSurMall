export type MachineCategory = 'A' | 'B'
export type SlotFormat = 'simple' | 'twin'
export type IncidentStatus = 'open' | 'resolved'

export interface Bar {
  id: string
  name: string
  address?: string
  contractExpiry?: string
  active: boolean
  createdAt: string
}

export interface Machine {
  id: string
  barId: string
  category: MachineCategory
  subtype: string
  name: string
  model?: string
  serialNumber?: string
  slotFormat?: SlotFormat
  active: boolean
  createdAt: string
}

export interface Incident {
  id: string
  machineId: string
  barId: string
  date: string
  type: string
  description: string
  status?: IncidentStatus
  resolution?: string
  createdAt: string
  resolvedAt?: string
}

export interface Collection {
  id: string
  barId: string
  date: string
  taxesAmount: number
  notes?: string
  createdAt: string
}

export interface CollectionEntry {
  id: string
  collectionId: string
  machineId: string
  amount: number
  hadB: boolean
  bAmount?: number
  notes?: string
}

export interface RouteGroup {
  id: string
  name: string
  active: boolean
  createdAt: string
}

export interface RouteEntry {
  id: string
  groupId: string
  barId: string
  week: number
  dayOfWeek: number
  createdAt: string
}

export interface BackupPayload {
  app: 'MaquinesSurMall'
  version: 1 | 2
  exportedAt: string
  bars: Bar[]
  machines: Machine[]
  incidents: Incident[]
  collections: Collection[]
  collectionEntries: CollectionEntry[]
  routeGroups?: RouteGroup[]
  routeEntries?: RouteEntry[]
}
