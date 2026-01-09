import config from '#config'
import dayjs from 'dayjs'
import * as dumpUtils from '../src/dump.js'
import eventsQueue from '@data-fair/lib-node/events-queue.js'

const start = dayjs()

async function main () {
  await eventsQueue.start({ eventsSecret: config.secretKeys.events, eventsUrl: config.privateEventsUrl })
  try {
    await dumpUtils.restore(process.argv[2], process.argv[3])
    eventsQueue.pushEvent({
      topic: { key: 'backup:success' },
      title: `Restauration de "${process.argv[2]}/${process.argv[3]}" terminée avec succès`,
      body: `Démarrée le ${start.format('LL')} à ${start.format('LT')}.`
    })
    await eventsQueue.stop()
    console.log('restore finished')
  } catch (err) {
    eventsQueue.pushEvent({
      topic: { key: 'backup:failure' },
      title: `ATTENTION ! Restauration de "${process.argv[2]}/${process.argv[3]}" a échoué`,
      body: `Démarrée le ${start.format('LL')} à ${start.format('LT')}.`
    })
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
