const fs = require('fs-extra')
const config = require('config')
const moment = require('moment')
const dumpUtils = require('../server/utils/dump')
const notifications = require('../server/utils/notifications')

const start = moment()

async function main() {
  const name = dumpUtils.name(process.argv[3])
  try {
    if (process.argv[2] === 'all') {
      for (const dumpKey of config.dumpKeys) {
        await dumpUtils.dump(dumpKey)
      }
    } else {
      await dumpUtils.dump(process.argv[2], process.argv[3])
    }
    await dumpUtils.rotate()
    if (config.cloudArchive.tenant && moment().day() === 1) {
      console.log('Sync backuped data to cold cloud archive every week')
      await dumpUtils.archive(process.argv[3])
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
