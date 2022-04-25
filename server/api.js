const config = require('config')
const express = require('express')
const path = require('path')
const fs = require('fs-extra')
const prettyBytes = require('pretty-bytes')
const asyncWrap = require('./utils/async-wrap')

const api = module.exports = express.Router()

api.use((req, res, next) => {
  if (!req.user || !req.user.adminMode) return res.status(401).send()
  next()
})

const serveDirs = [{ name: 'backup', path: config.backupDir }, ...config.serveExtraDirs]

api.get('/directories', (req, res) => {
  res.send(serveDirs.map(serveDir => ({ path: serveDir.name, children: [] })))
})
for (const serveDir of serveDirs) {
  api.get(`/directories/${serveDir.name}/*`, asyncWrap(async (req, res) => {
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
