import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const storageSource = readFileSync('electron/storage.cjs', 'utf8')
const dbSource = readFileSync('electron/db.cjs', 'utf8')
const normalizeSource = readFileSync('electron/normalize.cjs', 'utf8')
const schemaSource = readFileSync('electron/schema.cjs', 'utf8')

describe('storage architecture boundary', () => {
  it('keeps storage.cjs as the business-operation facade', () => {
    expect(storageSource.split('\n').length).toBeLessThan(3300)
    expect(storageSource).toContain("require('./schema.cjs')")
    expect(storageSource).toContain("require('./db.cjs')")
    expect(storageSource).toContain("require('./normalize.cjs')")
    expect(storageSource).not.toContain('function normalizeStoredDatabase')
    expect(storageSource).not.toContain('function acquireWriteLock')
  })

  it('keeps schema, normalization, and database I/O in separate modules', () => {
    expect(schemaSource).toContain('SECTION_TYPES')
    expect(schemaSource).toContain('DATABASE_PATH')
    expect(normalizeSource).toContain('function normalizeStoredDatabase')
    expect(normalizeSource).toContain('function normalizeText')
    expect(dbSource).toContain('function readDatabase')
    expect(dbSource).toContain('function writeDatabase')
    expect(dbSource).toContain('function acquireWriteLock')
    expect(dbSource).toContain('databaseCache')
    expect(dbSource).toContain('cloneDatabase')
    expect(dbSource).toContain('getDatabaseMtimeMs')
  })
})
