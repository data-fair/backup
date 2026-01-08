import { createServer } from 'node:http'
import { session } from '@data-fair/lib-express/index.js'
import { startObserver, stopObserver } from '@data-fair/lib-node/observer.js'
import { createHttpTerminator } from 'http-terminator'
import app from './app.ts'
import { exec } from './utils/exec.ts'
import config from '#config'

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
  // await upgradeScripts(mongo.db, resolve(import.meta.dirname, '../..'))

  server.listen(config.port)
  await new Promise(resolve => server.once('listening', resolve))

  console.log(`API server listening on port ${config.port}`)

  if (config.autoTask && config.autoTask.cron) {
    const cron = await import('node-cron')
    console.log(`init cron task "${config.autoTask.exec}" ${config.autoTask.cron}`)
    cron.schedule(config.autoTask.cron, async () => {
      try {
        console.info(`\nrunning automated task "${config.autoTask.exec}"\n`)
        await exec(config.autoTask.exec)
        console.info('\nautomated task done\n')
      } catch (err) {
        console.error('problem while running automated task', err)
      }
    })
  }
}

export const stop = async () => {
  await httpTerminator.terminate()
  if (config.observer.active) await stopObserver()
}
