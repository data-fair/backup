import { createServer } from 'node:http'
import { resolve } from 'node:path'
import i18n from 'i18n'
import { session } from '@data-fair/lib-express/index.js'
import { startObserver, stopObserver } from '@data-fair/lib-node/observer.js'
import locks from '@data-fair/lib-node/locks.js'
import * as wsServer from '@data-fair/lib-express/ws-server.js'
import * as wsEmitter from '@data-fair/lib-node/ws-emitter.js'
// import upgradeScripts from '@data-fair/lib-node/upgrade-scripts.js'
import mongo from '#mongo'
import { createHttpTerminator } from 'http-terminator'
import app from './app.ts'
import config from '#config'
import * as webhooksWorker from './webhooks/worker.ts'
import * as pushService from './push/service.ts'

const server = createServer(app)
const httpTerminator = createHttpTerminator({ server })

// cf https://connectreport.com/blog/tuning-http-keep-alive-in-node-js/
// timeout is often 60s on the reverse proxy, better to a have a longer one here
// so that interruption is managed downstream instead of here
server.keepAliveTimeout = (60 * 1000) + 1000
server.headersTimeout = (60 * 1000) + 2000

export const start = async () => {
  if (config.observer.active) await startObserver(config.observer.port)
  session.init(config.privateDirectoryUrl)
  await mongo.init()
  await locks.start(mongo.db)
  // await upgradeScripts(mongo.db, resolve(import.meta.dirname, '../..'))

  await wsServer.start(server, mongo.db, async (channel, sessionState) => {
    const [ownerType, ownerId] = channel.split(':')
    if (!sessionState.user) return false
    if (sessionState.user.adminMode) return true
    return ownerType === 'user' && ownerId === sessionState.user.id
  })
  await wsEmitter.init(mongo.db)
  await pushService.init()
  await webhooksWorker.start()

  server.listen(config.port)
  await new Promise(resolve => server.once('listening', resolve))

  console.log(`API server listening on port ${config.port}`)

  if (config.autoTask && config.autoTask.cron) {
    const cron = require('node-cron')
    cron.schedule(config.autoTask.cron, async () => {
      try {
        console.info(`\nrunning automated task "${config.autoTask.exec}"\n`)
        await event2promise(spawn(config.autoTask.exec, { shell: true, stdio: 'inherit' }), 'close')
        console.info('\nautomated task done\n')
      } catch (err) {
        console.error('problem while running automated task', err)
      }
    })
  }
}

export const stop = async () => {
  await httpTerminator.terminate()
  await webhooksWorker.stop()
  await wsServer.stop()
  if (config.observer.active) await stopObserver()
  await mongo.client.close()
}
