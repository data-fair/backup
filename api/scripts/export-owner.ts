import fs from 'fs-extra'
import config from '#config'
import path from 'path'
import tmp from 'tmp-promise'
import { nanoid } from 'nanoid'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import { MongoClient } from 'mongodb'
import * as dumpUtils from '../src/dump.ts'

type Dir = {
  name: string,
  path: string,
  ignorePathWarning?: boolean,
  optional?: boolean
}

type Collection = {
  collection: string,
  ownerType: string,
  filter?: string,
  project?: string
  ignoreFilterWarning?: boolean,
  optional?: boolean,
  linkedCollections?: LinkedCollection[],
  linkedDirs?: Dir[]
}
type LinkedCollection = {
  collection: string,
  filter?: string,
  project?: string
  ignoreFilterWarning?: boolean,
  optional?: boolean
}

async function main () {
  if (!config.ownerExports) throw new Error('Owner exports are not configured')
  const tmpDir = (await tmp.dir({ dir: config.tmpdir, unsafeCleanup: true })).path
  const ownerType = process.argv[2]
  const ownerId = process.argv[3]
  const ownerTmpl = (str: string) => str.replace(/\{ownerType\}/g, ownerType).replace(/\{ownerId\}/g, ownerId)

  console.log(`Export data for owner ${ownerType}/${ownerId}`)

  const outputDir = path.join(config.ownerExports.dir, ownerType, ownerId)
  await fs.ensureDir(outputDir)

  const client = await MongoClient.connect(`${config.mongo.url}?readPreference=${config.mongo.readPreference}`)
  await fs.ensureDir(path.join(tmpDir, 'mongo'))
  const dynamicDirs: Dir[] = []
  for (const db of config.ownerExports.mongo.dbs) {
    const dynamicCollections: Collection[] = []
    const exportCollection = async (collection: Collection) => {
      console.log('\nexport from mongo', db.db, collection.collection)
      if (!collection.filter) throw new Error('no filter defined')
      if (!collection.ignoreFilterWarning && !collection.filter.includes('{ownerId}')) {
        throw new Error(`the filter does not include {ownerId} : ${collection.filter}`)
      }
      if (!(await client.db(db.db).listCollections({ name: collection.collection }).toArray()).length) {
        if (collection.optional) {
          console.log('missing optional collection')
          return
        } else {
          throw new Error('collection not found')
        }
      }
      const filter = JSON.parse(ownerTmpl(collection.filter))
      console.log('filter', filter)
      const project = collection.project && JSON.parse(ownerTmpl(collection.project))
      if (project) console.log('project', project)
      const outFile = path.join(tmpDir, 'mongo', `${db.db}-${collection.collection}.ndjson`)
      let i = 0
      await pipeline(
        client.db(db.db).collection(collection.collection).find(filter).project(project).stream(),
        new Transform({
          objectMode: true,
          transform (chunk, encoding, callback) {
            i++
            for (const linkedCollection of collection.linkedCollections || []) {
              let resolvedCollectionName = linkedCollection.collection
              for (const key in chunk) {
                resolvedCollectionName = resolvedCollectionName.replace(`{${key}}`, chunk[key])
              }
              dynamicCollections.push({ ...linkedCollection, collection: resolvedCollectionName, ownerType: collection.ownerType })
            }
            for (const linkedDir of collection.linkedDirs || []) {
              let resolvedDirPath = linkedDir.path
              let resolvedDirName = linkedDir.name
              for (const key in chunk) {
                resolvedDirPath = resolvedDirPath.replace(`{${key}}`, chunk[key])
                resolvedDirName = resolvedDirName.replace(`{${key}}`, chunk[key])
              }
              dynamicDirs.push({ ...linkedDir, path: resolvedDirPath, name: resolvedDirName })
            }
            callback(null, JSON.stringify(chunk) + '\n')
          }
        }),
        fs.createWriteStream(outFile)
      )
      if (i === 0) {
        console.log('remove empty collection file', outFile)
        await fs.remove(outFile)
      } else {
        console.log(`exported collection (${i} docs) to file ${outFile}`)
      }
    }
    for (const collection of db.collections) {
      if (collection.ownerType && collection.ownerType !== ownerType) continue
      await exportCollection(collection)
    }
    if (dynamicCollections.length) {
      console.log('found additional dynamically named collections to export', dynamicCollections.length)
      for (const collection of dynamicCollections) {
        if (collection.ownerType && collection.ownerType !== ownerType) continue
        await exportCollection(collection)
      }
    }
  }

  await client.close()

  await fs.ensureDir(path.join(tmpDir, 'dirs'))
  if (dynamicDirs.length) {
    console.log('found additional dynamically named dirs to export', dynamicDirs.length)
  }
  for (const dir of [...config.ownerExports.dirs, ...dynamicDirs]) {
    if (!dir.path) throw new Error('no path defined')
    if (!dir.name) throw new Error('no name defined')
    if (!dir.ignorePathWarning && !dir.path.includes('{ownerId}')) {
      throw new Error(`the path does not include {ownerId} : ${dir.path}`)
    }
    console.log('\nexport from directory', dir.name)
    const p = ownerTmpl(dir.path)
    const outFile = path.join(tmpDir, 'dirs', dir.name + '.zip')
    if (!(await fs.pathExists(p))) {
      if (dir.optional) {
        console.log('missing optional dir')
        continue
      } else {
        throw new Error('collection not found')
      }
    }
    const nbChildren = (await fs.readdir(p)).length
    if (!nbChildren) {
      console.log('no children in folder, skip it')
      continue
    }
    await dumpUtils.exec(`zip ${outFile} -q -r -- *`, { cwd: p })
    console.log(`archived directory (${nbChildren} children) to file ${outFile}`)
  }

  const outputFile = `${new Date().toISOString().slice(0, 10)}-${nanoid()}.zip`
  const outputArchive = path.resolve(path.join(outputDir, outputFile))
  console.log('\nprepare final zip archive')
  await dumpUtils.exec(`zip ${outputArchive} -q -r -- *`, { cwd: tmpDir })

  console.log(`
archive is available here:
/backup/api/v1/owner-exports/${ownerType}/${ownerId}/${outputFile}
`)
}

main().then(() => {
  process.exit()
}, err => {
  console.error(err)
  process.exit(-1)
})
