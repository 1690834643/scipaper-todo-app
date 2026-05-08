import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const modulePaths = [
  require.resolve('../electron/schema.cjs'),
  require.resolve('../electron/normalize.cjs'),
  require.resolve('../electron/db.cjs'),
]

let tempHomes: string[] = []

function loadDb(home: string) {
  process.env.HOME = home
  process.env.USERPROFILE = home
  const parsed = path.parse(home)
  process.env.HOMEDRIVE = parsed.root.replace(/[\\/]+$/, '')
  process.env.HOMEPATH = home.slice(process.env.HOMEDRIVE.length) || '\\'
  for (const modulePath of modulePaths) delete require.cache[modulePath]
  return {
    db: require('../electron/db.cjs') as typeof import('../electron/db.cjs'),
    schema: require('../electron/schema.cjs') as typeof import('../electron/schema.cjs'),
  }
}

function makeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'scipaper-db-cache-'))
  tempHomes.push(home)
  return home
}

afterEach(() => {
  for (const modulePath of modulePaths) delete require.cache[modulePath]
  delete process.env.HOME
  delete process.env.USERPROFILE
  delete process.env.HOMEDRIVE
  delete process.env.HOMEPATH
  for (const home of tempHomes) {
    fs.rmSync(home, { force: true, recursive: true })
  }
  tempHomes = []
})

describe('db read cache', () => {
  it('returns a mutable copy so unsaved caller mutations do not pollute the cache', () => {
    const { db } = loadDb(makeHome())

    db.writeDatabase({ version: 1, articles: [], theses: [] })
    const first = db.readDatabase()
    first.articles.push({ id: 'unsaved', sections: [] })

    const second = db.readDatabase()
    expect(second.articles.find((article) => article.id === 'unsaved')).toBeUndefined()
  })

  it('reloads when another process updates database.json', () => {
    const { db, schema } = loadDb(makeHome())

    db.writeDatabase({ version: 1, articles: [], theses: [] })
    expect(db.readDatabase().articles).toHaveLength(0)

    fs.writeFileSync(
      schema.DATABASE_PATH,
      JSON.stringify({
        version: 1,
        articles: [{ id: 'external', sections: [] }],
        theses: [],
      }),
      'utf-8',
    )
    const nextMtime = new Date(Date.now() + 2000)
    fs.utimesSync(schema.DATABASE_PATH, nextMtime, nextMtime)

    expect(db.readDatabase().articles.map((article) => article.id)).toContain('external')
  })
})
