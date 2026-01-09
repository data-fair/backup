import { resolve } from 'node:path'
import { errorHandler, createSiteMiddleware, createSpaMiddleware, session } from '@data-fair/lib-express/index.js'
import express from 'express'
import helmet from 'helmet'
import apiRouter from './router.ts'
import { uiConfig } from '#config'
import { getSiteHashes } from './utils/site.ts'

const app = express()
export default app

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      // very restrictive by default, index.html of the UI will have custom rules defined in createSpaMiddleware
      // https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html#security-headers
      'frame-ancestors': ["'none'"],
      'default-src': ["'none'"]
    }
  }
}))

// no fancy embedded arrays, just string and arrays of strings in req.query
app.set('query parser', 'simple')
app.use(express.json())

app.use(createSiteMiddleware('backup'))
app.use(session.middleware())

app.use('/api', apiRouter)
app.use('/api', (req, res) => res.status(404).send('unknown api endpoint'))

app.use(await createSpaMiddleware(resolve(import.meta.dirname, '../../ui/dist'), uiConfig, {
  csp: { nonce: true, header: true },
  getSiteExtraParams: getSiteHashes
}))

app.use(errorHandler)
