const fs = require('fs-extra')
const path = require('path')
const config = require('config')
const dayjs = require('dayjs')
const quarterOfYear = require('dayjs/plugin/quarterOfYear')
dayjs.extend(quarterOfYear)
const utc = require('dayjs/plugin/utc')
dayjs.extend(utc)
const { spawn } = require('child-process-promise')
const { MongoClient } = require('mongodb')
const tmp = require('tmp-promise')

const absoluteBackupDir = path.resolve(process.cwd(), config.backupDir)

if (config.cloudArchive.tenant) {
  fs.writeFileSync('/tmp/ca-password.txt', `${config.cloudArchive.tenant}.${config.cloudArchive.user}.${config.cloudArchive.password}`)
}

if (config.rsync.password) {
  fs.writeFileSync('/tmp/rsync-password.txt', config.rsync.password)
  fs.chmodSync('/tmp/rsync-password.txt', '0600')
}
if (config.rsync.sshKey) {
  fs.writeFileSync('/tmp/rsync-ssh-key', config.rsync.sshKey)
  fs.chmodSync('/tmp/rsync-ssh-key', '0600')
}

async function exec (cmd, opts = {}) {
  opts.stdio = 'inherit'
  console.log('Run: ', cmd, opts)
  return spawn('bash', ['-c', cmd], opts)
}
exports.exec = exec

async function splitArchive (archive, backupName) {
  await exec(`split -b ${config.splitSize} ${archive.tmpPath} ${archive.name}-`, { cwd: `${absoluteBackupDir}/${backupName}` })
  archive.tmpFile.cleanup()
}

exports.name = (name) => {
  return name || dateStr(dayjs())
}

exports.dump = async (dumpKey, name) => {
  name = exports.name(name)
  await fs.ensureDir(`${config.backupDir}/${name}`)
  await fs.emptyDir(config.tmpdir)

  if (dumpKey === 'mongo') {
    const url = config.mongo.url || `mongodb://${config.mongo.host}:${config.mongo.port}`
    const client = await MongoClient.connect(url, { useNewUrlParser: true })
    const dbs = await client.db('admin').admin().listDatabases()
    await client.close()
    for (const db of dbs.databases.map(db => db.name).filter(db => !config.mongo.ignoreDBs.includes(db))) {
      const tmpFile = await tmp.file({ dir: config.tmpdir })
      const tmpPath = tmpFile.path
      let cmd = `mongodump --uri ${url} --readPreference ${config.mongo.readPreference} --db ${db} --gzip --archive=${tmpPath}`
      if (config.mongo.dumpParams && config.mongo.dumpParams[db]) {
        cmd += ` ${config.mongo.dumpParams[db]}`
      }
      await exec(config.mongo.cmdTmpl.replace('CMD', cmd))
      await splitArchive({ tmpFile, tmpPath, name: `mongo-${db}.gz` }, name)
    }
    await client.close()
  } else if (dumpKey.startsWith('dir:')) {
    const [archiveName, dirPath] = dumpKey.split(':').slice(1)
    const tmpFile = await tmp.dir({ unsafeCleanup: true, dir: config.tmpdir })
    const tmpPath = `${tmpFile.path}/archive.zip`
    await exec(`zip ${tmpPath} -q -r -- *`, { cwd: dirPath })
    await splitArchive({ tmpFile, tmpPath, name: `${archiveName}.zip` }, name)
  } else {
    throw new Error(`Unknown dump key "${dumpKey}"`)
  }
}

exports.cloudArchive = async (name) => {
  name = name || dateStr(dayjs())
  const files = await fs.readdir(`${absoluteBackupDir}/${name}`)
  for (const file of files) {
    // await exec(`sshpass -f /tmp/ca-password.txt rsync -e "ssh -o StrictHostKeyChecking=no" -av ${absoluteBackupDir}/${name}/* ${config.cloudArchive.url}/${name}/`)
    await exec(`sshpass -f /tmp/ca-password.txt scp -o StrictHostKeyChecking=no ${absoluteBackupDir}/${name}/${file} ${config.cloudArchive.url}/${name}-${file}`)
  }
}

exports.rsyncArchive = async (rsyncKey) => {
  let source, target
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

exports.restore = async (dumpKey, name) => {
  name = name || dateStr(dayjs())
  if (dumpKey.startsWith('mongo/')) {
    // for mongo the db is passed as mongo/simple-directory-production
    const db = dumpKey.replace('mongo/', '')
    const tmpFile = await tmp.file({ dir: config.tmpdir })
    await exec(`cat mongo-${db}.gz-* > ${tmpFile.path}`, { cwd: `${absoluteBackupDir}/${name}` })
    await exec(config.mongo.cmdTmpl.replace('CMD', `mongorestore --drop --host ${config.mongo.host} --port ${config.mongo.port} --db ${db} --gzip --archive=${tmpFile.path}`))
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

function dateStr (d) {
  return d.format().slice(0, 10)
}

// manage and remove deprecated daily/weekly/monthly dumps
exports.rotate = async () => {
  const now = dayjs.utc()

  const keepDirs = [dateStr(now)]
  for (const unit of ['day', 'week', 'month', 'quarter', 'year']) {
    for (let i = 0; i < config.rotation[unit]; i++) {
      const dir = dateStr(now.startOf(unit).subtract(i, unit))
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
