const config = require('config')
const dayjs = require('dayjs')
const dumpUtils = require('../server/utils/dump')
const notifications = require('../server/utils/notifications')

const start = dayjs()

async function main () {
  try {
    await dumpUtils.restore(process.argv[2], process.argv[3])
    await notifications.send({
      topic: { key: 'backup:success' },
      title: `Restauration de "${process.argv[2]}/${process.argv[3]}" terminée avec succès`,
      body: `Démarrée le ${start.format('LL')} à ${start.format('LT')}. Voir sur ${config.publicUrl}.`
    })
  } catch (err) {
    await notifications.send({
      topic: { key: 'backup:failure' },
      title: `ATTENTION ! Restauration de "${process.argv[2]}/${process.argv[3]}" a échoué`,
      body: `Démarrée le ${start.format('LL')} à ${start.format('LT')}. Voir sur ${config.publicUrl}.`
    })
    throw err
  }
}

main().then(() => {
  process.exit()
}, err => {
  console.error(err)
  process.exit(-1)
})
