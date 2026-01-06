const config = require('config')
const express = require('express')
const path = require('path')
const fs = require('fs-extra')
const prettyBytes = require('pretty-bytes')
const asyncWrap = require('./utils/async-wrap')

const api = module.exports = express.Router()

const serveDirs = [{ name: 'backup', path: config.backupDir }, ...config.serveExtraDirs]
if (config.ownerExports && config.ownerExports.dir) {
  serveDirs.push({ name: 'owner-exports', path: config.ownerExports.dir })
}

const getOwnerRole = (owner, user) => {
  if (!user) return null
  if (user.activeAccount.department) return null
  if (user.activeAccount.type !== owner.type || user.activeAccount.id !== owner.id) return null
  if (user.activeAccount.type === 'user') return 'admin'
  return user.activeAccount.role
}

api.get('/directories', (req, res) => {
  if (!req.user || !req.user.adminMode) return res.status(401).send()
  res.send(serveDirs.map(serveDir => ({ path: serveDir.name, children: [] })))
})
for (const serveDir of serveDirs) {
  api.get(`/directories/${serveDir.name}/*`, asyncWrap(async (req, res) => {
    if (!req.user || !req.user.adminMode) return res.status(401).send()
    const fullPath = path.join(serveDir.path, req.params[0])
    const stats = await fs.stat(fullPath)
    if (stats.isDirectory()) {
      const childrenNames = await fs.readdir(fullPath)
      const children = []
      for (const childName of childrenNames) {
        if (childName === 'lost+found') continue
        const childStats = await fs.stat(path.join(fullPath, childName))
        const childPath = path.join(serveDir.name, req.params[0], childName)
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
      res.download(fullPath)
    }
  }))
}

if (config.ownerExports && config.ownerExports.dir) {
  api.get('/owner-exports/:type/:id/:archive', (req, res) => {
    if (!req.user) return res.status(401).send()
    if (!req.user.adminMode && getOwnerRole(req.params, req.user) !== 'admin') {
      console.warn('lack permission to download owner export', req.params, req.activeAccount)
      return res.status(403).send()
    }
    res.download(path.join(config.ownerExports.dir, req.params.type, req.params.id, req.params.archive))
  })
}
