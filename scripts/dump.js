const fs = require('fs-extra')
const config = require('config')
const dayjs = require('dayjs')
const dumpUtils = require('../server/utils/dump')
const notifications = require('../server/utils/notifications')

const start = dayjs()

async function main () {
  const name = dumpUtils.name(process.argv[3])
  try {
    await dumpUtils.rotate()
    if (process.argv[2] === 'all') {
      for (const dumpKey of config.dumpKeys) {
        await dumpUtils.dump(dumpKey)
      }
    } else {
      await dumpUtils.dump(process.argv[2], process.argv[3])
    }
    if (config.cloudArchive.tenant && dayjs().day() === 1) {
      console.log('Sync backuped data to cold cloud archive every week')
      await dumpUtils.cloudArchive(process.argv[3])
    }
    if (config.rsync.url && config.rsync.password) {
      console.log('Sync backuped data to rsync server')
      await dumpUtils.rsyncArchive(process.argv[3])
    }
    await notifications.send({
      topic: { key: 'backup:success' },
      title: `Sauvegarde de "${process.argv[2]}" terminée avec succès`,
      body: `Démarrée le ${start.format('LL')} à ${start.format('LT')}. Voir sur ${config.publicUrl}.`
    })
  } catch (err) {
    await notifications.send({
      topic: { key: 'backup:failure' },
      title: `ATTENTION ! Sauvegarde de "${process.argv[2]}" a échoué`,
      body: `Démarrée le ${start.format('LL')} à ${start.format('LT')}. Voir sur ${config.publicUrl}.`
    })
    try {
      await fs.writeFile(`${config.backupDir}/${name}/error.txt`, err.stack || err)
    } catch (fsErr) {
      // nothing
    }
    throw err
  }
}

main().then(() => {
  process.exit()
}, err => {
  console.error(err)
  process.exit(-1)
})
