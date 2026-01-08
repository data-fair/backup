import path from 'node:path'
import fs from 'fs-extra'
import dayjs, { type ManipulateType } from 'dayjs'
import config from '#config'
import quarterOfYear from 'dayjs/plugin/quarterOfYear.js'
import utc from 'dayjs/plugin/utc.js'
import { MongoClient } from 'mongodb'
import tmp from 'tmp-promise'
import debugModule from 'debug'
import { exec } from './utils/exec.ts'

const debug = debugModule('dump')

dayjs.extend(quarterOfYear)
dayjs.extend(utc)

const absoluteBackupDir = path.resolve(process.cwd(), config.backupDir)

if (config.cloudArchive.tenant) {
  await fs.writeFile('/tmp/ca-password.txt', `${config.cloudArchive.tenant}.${config.cloudArchive.user}.${config.cloudArchive.password}`)
}

if (config.rsync.password) {
  await fs.writeFile('/tmp/rsync-password.txt', config.rsync.password)
  await fs.chmod('/tmp/rsync-password.txt', '0600')
}
if (config.rsync.sshKey) {
  await fs.writeFile('/tmp/rsync-ssh-key', config.rsync.sshKey)
  await fs.chmod('/tmp/rsync-ssh-key', '0600')
}

type Archive = {
  name: String,
  tmpPath: String
}

async function splitArchive (archive: Archive, backupName: string) {
  await exec(`split -b ${config.splitSize} ${archive.tmpPath} ${archive.name}-`, { cwd: `${absoluteBackupDir}/${backupName}` })
}

export const dump = async (dumpKey: string, _name?: string) => {
  const name = _name || dateStr(dayjs())
  debug(`ensure backup dir ${config.backupDir}/${name}`)
  await fs.ensureDir(`${config.backupDir}/${name}`)
  debug(`empty tmpdir ${config.tmpdir}`)
  await fs.emptyDir(config.tmpdir)

  if (dumpKey === 'mongo') {
    debug('connect to mongodb', config.mongo.url)
    const client = await MongoClient.connect(config.mongo.url)
    const dbs = await client.db('admin').admin().listDatabases()
    await client.close()
    for (const db of dbs.databases.map(db => db.name).filter(db => !config.mongo.ignoreDBs.includes(db))) {
      debug(`work on db ${db}`)
      debug(`create tmp file ${config.tmpdir}`)
      const tmpFile = await tmp.file({ dir: config.tmpdir })
      debug(`created tmp file ${tmpFile.path}`)
      const tmpPath = tmpFile.path
      let cmd = `mongodump --uri ${config.mongo.url}/${db}?readPreference=${config.mongo.readPreference} --gzip --archive=${tmpPath}`
      if (config.mongo.dumpParams && config.mongo.dumpParams[db]) {
        cmd += ` ${config.mongo.dumpParams[db]}`
      }
      await exec(config.mongo.cmdTmpl.replace('CMD', cmd))
      await splitArchive({ tmpPath, name: `mongo-${db}.gz` }, name)
      await tmpFile.cleanup()
    }
    await client.close()
  } else if (dumpKey.startsWith('dir:')) {
    debug(`work on directory archive ${dumpKey}`)
    const [archiveName, dirPath] = dumpKey.split(':').slice(1)
    const tmpDir = await tmp.dir({ unsafeCleanup: true, dir: config.tmpdir })
    const tmpPath = `${tmpDir.path}/archive.zip`
    await exec(`zip ${tmpPath} -q -r -- *`, { cwd: dirPath })
    await splitArchive({ tmpPath, name: `${archiveName}.zip` }, name)
    await tmpDir.cleanup()
  } else {
    throw new Error(`Unknown dump key "${dumpKey}"`)
  }
}

export const cloudArchive = async (name: string) => {
  name = name || dateStr(dayjs())
  const files = await fs.readdir(`${absoluteBackupDir}/${name}`)
  for (const file of files) {
    // await exec(`sshpass -f /tmp/ca-password.txt rsync -e "ssh -o StrictHostKeyChecking=no" -av ${absoluteBackupDir}/${name}/* ${config.cloudArchive.url}/${name}/`)
    await exec(`sshpass -f /tmp/ca-password.txt scp -o StrictHostKeyChecking=no ${absoluteBackupDir}/${name}/${file} ${config.cloudArchive.url}/${name}-${file}`)
  }
}

export const rsyncArchive = async (rsyncKey: string) => {
  let source, target
  debug('rsync archive', rsyncKey)
  if (rsyncKey === 'latest-dump') {
    source = `${absoluteBackupDir}/${dateStr(dayjs())}/`
    target = 'dump'
  } else if (rsyncKey.startsWith('dir:')) {
    const [archiveName, dirPath] = rsyncKey.split(':').slice(1)
    source = `${dirPath}/`
    target = archiveName
  } else {
    throw new Error(`Unknown rsync key "${rsyncKey}"`)
  }
  let sshCommand = 'ssh -o StrictHostKeyChecking=no'
  if (config.rsync.sshKey) sshCommand += ' -i /tmp/rsync-ssh-key'
  if (config.rsync.port) sshCommand += ' -p ' + config.rsync.port
  let sshPass = ''
  if (config.rsync.password) sshPass = 'sshpass -f /tmp/rsync-password.txt'
  await exec(`${sshPass} rsync -e "${sshCommand}" -av --delete-after ${source} ${config.rsync.url}/latest/${target}`)
  if (dayjs().day() === 0) {
    await exec(`${sshPass} rsync -e "${sshCommand}" -av --delete-after ${source} ${config.rsync.url}/weekly/${target}`)
  }
}

export const restore = async (dumpKey: string, name: string) => {
  name = name || dateStr(dayjs())
  if (dumpKey.startsWith('mongo/')) {
    // for mongo the db is passed as mongo/simple-directory-production
    const db = dumpKey.replace('mongo/', '')
    const tmpFile = await tmp.file({ dir: config.tmpdir })
    await exec(`cat mongo-${db}.gz-* > ${tmpFile.path}`, { cwd: `${absoluteBackupDir}/${name}` })
    const mongoUrl = new URL(config.mongo.url)
    await exec(config.mongo.cmdTmpl.replace('CMD', `mongorestore --drop --host ${mongoUrl.hostname} --port ${mongoUrl.port} --db ${db} --gzip --archive=${tmpFile.path}`))
    tmpFile.cleanup()
  } else if (dumpKey.startsWith('dir:')) {
    const [archiveName, dirPath] = dumpKey.split(':').slice(1)
    const tmpFile = await tmp.dir({ unsafeCleanup: true, dir: config.tmpdir })
    await exec(`cat ${archiveName}.zip-* > ${tmpFile.path}/archive.zip`, { cwd: `${absoluteBackupDir}/${name}` })
    await fs.ensureDir(dirPath)
    await exec(`unzip -o ${tmpFile.path}/archive.zip -d ${dirPath}`)
    tmpFile.cleanup()
  } else {
    throw new Error(`Unknown dump key "${dumpKey}"`)
  }
}

export function dateStr (d: dayjs.Dayjs) {
  return d.format().slice(0, 10)
}

// manage and remove deprecated daily/weekly/monthly dumps
export const rotate = async () => {
  const now = dayjs.utc()

  const keepDirs = [dateStr(now)]
  for (const unit of ['day' as const, 'week' as const, 'month' as const, 'quarter' as const, 'year' as const]) {
    for (let i = 0; i < config.rotation[unit]; i++) {
      const dir = dateStr(now.startOf(unit).subtract(i, unit as ManipulateType))
      console.log(`rotation ${unit}/-${i}, keep directory ${dir}`)
      keepDirs.push(dir)
    }
  }

  const dirs = await fs.readdir(config.backupDir)
  for (const dir of dirs) {
    if (isNaN(new Date(dir).getTime())) continue
    if (keepDirs.includes(dir)) continue
    console.log('remove deprecated backup directory', dir)
    await fs.remove(`${config.backupDir}/${dir}`)
  }
}
