import config from '#config'
import { assertAccountRole, httpError, reqAdminMode, reqIp, reqSessionAuthenticated, type AccountKeys } from '@data-fair/lib-express'
import express from 'express'
import path from 'node:path'
import fs from 'node:fs/promises'
import prettyBytes from 'pretty-bytes'

const api = express.Router()
export default api

const serveDirs = [{ name: 'backup', path: config.backupDir }, ...config.serveExtraDirs]
if (config.ownerExports) {
  serveDirs.push({ name: 'owner-exports', path: config.ownerExports.dir })
}

api.get('/directories', (req, res) => {
  reqAdminMode(req)
  res.send(serveDirs.map(serveDir => ({ path: serveDir.name, children: [] })))
})
for (const serveDir of serveDirs) {
  api.get(`/directories/${serveDir.name}/:path*`, async (req, res) => {
    reqAdminMode(req)
    const nodePath = (req.params as any).path as string
    const fullPath = path.join(serveDir.path, nodePath)
    const stats = await fs.stat(fullPath)
    if (stats.isDirectory()) {
      const childrenNames = await fs.readdir(fullPath)
      const children = []
      for (const childName of childrenNames) {
        if (childName === 'lost+found') continue
        const childStats = await fs.stat(path.join(fullPath, childName))
        const childPath = path.join(serveDir.name, nodePath, childName)
        if (childStats.isDirectory()) children.push({ name: childName, path: childPath, children: [] })
        else children.push({ name: childName, path: childPath, size: prettyBytes(childStats.size) })
      }
      children.sort((c1, c2) => {
        if (c1.children && !c2.children) return -1
        if (c2.children && !c1.children) return 1
        return 0
      })
      res.send(children)
    } else {
      const ip = reqIp(req)
      if (!config.authorizedIps.includes(ip)) {
        throw httpError(401, `unauthorized IP ${ip}`)
      }
      res.download(fullPath)
    }
  })
}

const ownerExports = config.ownerExports
if (ownerExports) {
  api.get('/owner-exports/:type/:id/:archive', (req, res) => {
    const sessionState = reqSessionAuthenticated(req)
    assertAccountRole(sessionState, req.params as AccountKeys, 'admin')
    res.download(path.join(ownerExports.dir, req.params.type, req.params.id, req.params.archive))
  })
}
