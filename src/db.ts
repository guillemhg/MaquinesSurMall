import Dexie, { type Table } from 'dexie'
import type {
  Bar,
  Machine,
  Incident,
  Collection,
  CollectionEntry,
  BackupPayload,
} from './types'

class MaquinesDatabase extends Dexie {
  bars!: Table<Bar, string>
  machines!: Table<Machine, string>
  incidents!: Table<Incident, string>
  collections!: Table<Collection, string>
  collectionEntries!: Table<CollectionEntry, string>

  constructor() {
    super('MaquinesSurMallDB')

    this.version(1).stores({
      bars: 'id, name, active, createdAt',
      machines: 'id, barId, category, active, createdAt',
      incidents: 'id, machineId, barId, date, status, type, createdAt',
      collections: 'id, barId, date, createdAt',
      collectionEntries: 'id, collectionId, machineId',
    })
  }
}

export const db = new MaquinesDatabase()

export async function exportBackup(): Promise<BackupPayload> {
  const [bars, machines, incidents, collections, collectionEntries] =
    await Promise.all([
      db.bars.toArray(),
      db.machines.toArray(),
      db.incidents.toArray(),
      db.collections.toArray(),
      db.collectionEntries.toArray(),
    ])

  return {
    app: 'MaquinesSurMall',
    version: 1,
    exportedAt: new Date().toISOString(),
    bars,
    machines,
    incidents,
    collections,
    collectionEntries,
  }
}

export async function importBackup(payload: BackupPayload) {
  if (payload.app !== 'MaquinesSurMall' || payload.version !== 1) {
    throw new Error('El archivo no es una copia compatible de MaquinesSurMall.')
  }

  await db.transaction(
    'rw',
    db.bars,
    db.machines,
    db.incidents,
    db.collections,
    db.collectionEntries,
    async () => {
      await Promise.all([
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
    },
  )
}
