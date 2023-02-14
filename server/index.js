const config = require('config')
const express = require('express')
const http = require('http')
const event2promise = require('event-to-promise')
const { spawn } = require('child_process')
const api = require('./api')
const nuxt = require('./nuxt')
const session = require('@koumoul/sd-express')({
  directoryUrl: config.directoryUrl,
  privateDirectoryUrl: config.privateDirectoryUrl
})
const debug = require('debug')('main')

const publicHost = new URL(config.publicUrl).host
debug('Public host', publicHost)

// Second express application for proxying requests based on host
const app = express()

if (process.env.NODE_ENV === 'development') {
  const proxy = require('http-proxy-middleware')
  // Create a mono-domain environment with other services in dev
  app.use('/simple-directory', proxy({ target: 'http://localhost:8080', pathRewrite: { '^/simple-directory': '' } }))
  app.use('/notify', proxy({ target: 'http://localhost:8088', pathRewrite: { '^/notify': '' } }))
  app.use('/data-fair', proxy({ target: 'http://localhost:5601', pathRewrite: { '^/data-fair': '' } }))
}

app.use('/api/v1', session.auth, api)

let httpServer
async function main () {
  const nuxtMiddleware = await nuxt()
  app.use(nuxtMiddleware)
  app.use((err, req, res, next) => {
    console.error('Error in HTTP request', err)
    res.status(err.status || 500).send(err.message)
  })

  httpServer = http.createServer(app).listen(config.port)
  await event2promise(httpServer, 'listening')
  debug('HTTP server is listening', config.port)
}

main().then(() => {
  console.log('Running on ' + config.publicUrl)
}, err => {
  console.error(err)
  process.exit(-1)
})

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

process.on('SIGTERM', async function onSigterm () {
  console.info('Received SIGTERM signal, shutdown gracefully...')
  try {
    if (httpServer) {
      httpServer.close()
      await event2promise(httpServer, 'close')
    }
    console.log('shutting down now')
    process.exit()
  } catch (err) {
    console.error('Failure while stopping service', err)
    process.exit(-1)
  }
})
