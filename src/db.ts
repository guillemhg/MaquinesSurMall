import Dexie, { type Table } from 'dexie'
import type {
  Bar,
  Machine,
  Incident,
  Collection,
  CollectionEntry,
  RouteGroup,
  RouteEntry,
  BackupPayload,
} from './types'

class MaquinesDatabase extends Dexie {
  bars!: Table<Bar, string>
  machines!: Table<Machine, string>
  incidents!: Table<Incident, string>
  collections!: Table<Collection, string>
  collectionEntries!: Table<CollectionEntry, string>
  routeGroups!: Table<RouteGroup, string>
  routeEntries!: Table<RouteEntry, string>

  constructor() {
    super('MaquinesSurMallDB')

    this.version(1).stores({
      bars: 'id, name, active, createdAt',
      machines: 'id, barId, category, active, createdAt',
      incidents: 'id, machineId, barId, date, status, type, createdAt',
      collections: 'id, barId, date, createdAt',
      collectionEntries: 'id, collectionId, machineId',
    })

    this.version(2).stores({
      bars: 'id, name, active, createdAt',
      machines: 'id, barId, category, active, createdAt',
      incidents: 'id, machineId, barId, date, status, type, createdAt',
      collections: 'id, barId, date, createdAt',
      collectionEntries: 'id, collectionId, machineId',
      routeGroups: 'id, name, active, createdAt',
      routeEntries: 'id, groupId, barId, week, dayOfWeek, [groupId+week+dayOfWeek], createdAt',
    })
  }
}

export const db = new MaquinesDatabase()

export async function exportBackup(): Promise<BackupPayload> {
  const [bars, machines, incidents, collections, collectionEntries, routeGroups, routeEntries] =
    await Promise.all([
      db.bars.toArray(),
      db.machines.toArray(),
      db.incidents.toArray(),
      db.collections.toArray(),
      db.collectionEntries.toArray(),
      db.routeGroups.toArray(),
      db.routeEntries.toArray(),
    ])

  return {
    app: 'MaquinesSurMall',
    version: 2,
    exportedAt: new Date().toISOString(),
    bars,
    machines,
    incidents,
    collections,
    collectionEntries,
    routeGroups,
    routeEntries,
  }
}

export async function importBackup(payload: BackupPayload) {
  if (payload.app !== 'MaquinesSurMall' || (payload.version !== 1 && payload.version !== 2)) {
    throw new Error('El archivo no es una copia compatible de MaquinesSurMall.')
  }

  await db.transaction(
    'rw',
    db.bars,
    db.machines,
    db.incidents,
    db.collections,
    db.collectionEntries,
    db.routeGroups,
    db.routeEntries,
    async () => {
      await Promise.all([
        db.routeEntries.clear(),
        db.routeGroups.clear(),
        db.collectionEntries.clear(),
        db.collections.clear(),
        db.incidents.clear(),
        db.machines.clear(),
        db.bars.clear(),
      ])

      await db.bars.bulkAdd(payload.bars ?? [])
      await db.machines.bulkAdd(payload.machines ?? [])
      await db.incidents.bulkAdd(payload.incidents ?? [])
      await db.collections.bulkAdd(payload.collections ?? [])
      await db.collectionEntries.bulkAdd(payload.collectionEntries ?? [])
      if (payload.routeGroups?.length) await db.routeGroups.bulkAdd(payload.routeGroups)
      if (payload.routeEntries?.length) await db.routeEntries.bulkAdd(payload.routeEntries)
    },
  )
}
