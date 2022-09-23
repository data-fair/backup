const fs = require('fs-extra')
const config = require('config')
const path = require('path')
const axios = require('axios')
const tmp = require('tmp-promise')
const { pipeline } = require('node:stream/promises')
const { Transform } = require('node:stream')
const { MongoClient } = require('mongodb')
const dumpUtils = require('../server/utils/dump')

async function main () {
  if (!config.ownerExports) throw new Error('Owner exports are not configured')
  const tmpDir = (await tmp.dir({ dir: config.tmpdir, unsafeCleanup: true })).path
  const ownerType = process.argv[2]
  const ownerId = process.argv[3]
  const ownerTmpl = (str) => str.replace(/\{ownerType\}/g, ownerType).replace(/\{ownerId\}/g, ownerId)

  console.log(`Export data for owner ${ownerType}/${ownerId}`)

  // use the public avatar route to check that ownerId and ownerType match an actual account
  await axios.get(`${config.directoryUrl}/api/avatars/${ownerType}/${ownerId}/avatar.png`).catch(err => {
    console.warn(err.message)
    throw new Error('Failed to check existence of owner using avatars link')
  })
  console.log('owner exists in simple directory')

  const outputDir = path.join(config.ownerExports.dir, ownerType, ownerId)
  await fs.ensureDir(outputDir)

  const client = await MongoClient.connect(`mongodb://${config.mongo.host}:${config.mongo.port}`, { useNewUrlParser: true })
  await fs.ensureDir(path.join(tmpDir, 'mongo'))
  const dynamicDirs = []
  for (const db of config.ownerExports.mongo.dbs) {
    const dynamicCollections = []
    const exportCollection = async (collection) => {
      console.log('\nexport from mongo', db.db, collection.collection)
      if (!collection.filter) throw new Error('no filter defined')
      if (!collection.ownerRestricted && !collection.filter.includes('{ownerId}')) throw new Error(`the filter does not include {ownerId} : ${collection.filter}`)
      if (!(await client.db(db.db).listCollections({ name: collection.collection }).toArray()).length) {
        if (collection.optional) {
          console.log('missing optional collection')
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
        client.db(db.db).collection(collection.collection).find(filter, project).stream(),
        new Transform({
          objectMode: true,
          transform (chunk, encoding, callback) {
            i++
            for (const linkedCollection of collection.linkedCollections || []) {
              let resolvedCollectionName = linkedCollection.collection
              for (const key in chunk) {
                resolvedCollectionName = resolvedCollectionName.replace(`{${key}}`, chunk[key])
              }
              dynamicCollections.push({ ...linkedCollection, collection: resolvedCollectionName })
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
      console.log(`exported collection (${i} docs) to file ${outFile}`)
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
    if (!dir.path.includes('{ownerId}')) throw new Error(`the path does not include {ownerId} : ${dir.path}`)
    console.log('\nexport from directory', dir.name)
    const p = ownerTmpl(dir.path)
    const outFile = path.join(tmpDir, 'dirs', dir.name + '.zip')
    await dumpUtils.exec(`zip ${outFile} -q -r -- *`, { cwd: p })
  }

  const outputFile = new Date().toISOString().slice(0, 10) + '.zip'
  const outputArchive = path.resolve(path.join(outputDir, outputFile))
  console.log('\nprepare final zip archive')
  await dumpUtils.exec(`zip ${outputArchive} -q -r -- *`, { cwd: tmpDir })

  console.log(`
archive is available here:
${config.publicUrl}/api/v1/owner-exports/${ownerType}/${ownerId}/${outputFile}
`)
}

main().then(() => {
  process.exit()
}, err => {
  console.error(err)
  process.exit(-1)
})
