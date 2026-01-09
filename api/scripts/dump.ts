import fs from 'fs-extra'
import config from '#config'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat.js'
import 'dayjs/locale/fr.js'
import * as dumpUtils from '../src/dump.ts'
import eventsQueue from '@data-fair/lib-node/events-queue.js'
import debugModule from 'debug'

const debug = debugModule('dump')

dayjs.locale('fr')
dayjs.extend(localizedFormat)

const start = dayjs()

async function main () {
  const name = process.argv[3] || dumpUtils.dateStr(dayjs())
  await eventsQueue.start({ eventsSecret: config.secretKeys.events, eventsUrl: config.privateEventsUrl })
  try {
    await dumpUtils.rotate()
    if (process.argv[2] === 'all') {
      for (const dumpKey of config.dumpKeys) {
        await dumpUtils.dump(dumpKey, name)
      }
      if (config.rsync.url && (config.rsync.password || config.rsync.sshKey)) {
        for (const rsyncKey of config.rsyncKeys) {
          await dumpUtils.rsyncArchive(rsyncKey)
        }
      }
      if (config.cloudArchive.tenant && dayjs().day() === 1) {
        console.log('Sync backuped data to cold cloud archive every week')
        await dumpUtils.cloudArchive(process.argv[3])
      }
    } else {
      await dumpUtils.dump(process.argv[2], process.argv[3])
    }
    debug('send success event')
    eventsQueue.pushEvent({
      topic: { key: 'backup:success' },
      title: `Sauvegarde de "${process.argv[2]}" terminée avec succès`,
      body: `Démarrée le ${start.format('LL')} à ${start.format('LT')}.`
    })
    await eventsQueue.stop()
    console.log('dump finished')
  } catch (err: any) {
    debug('send failure event')
    eventsQueue.pushEvent({
      topic: { key: 'backup:failure' },
      title: `ATTENTION ! Sauvegarde de "${process.argv[2]}" a échoué`,
      body: `Démarrée le ${start.format('LL')} à ${start.format('LT')}.`
    })
    try {
      await fs.writeFile(`${config.backupDir}/${name}/error.txt`, err.stack || err)
    } catch (fsErr) {
      // nothing
    }
    await eventsQueue.stop()
    throw err
  }
}

main().then(() => {
  process.exit()
}, err => {
  console.error(err)
  process.exit(-1)
})
