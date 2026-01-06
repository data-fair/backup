module.exports = {
  port: 5600,
  privateDirectoryUrl: 'http://simple-directory:8080',
  privateEventsUrl: null,
  observer: {
    active: true,
    port: 9090
  },
  mongo: {
    url: 'mongodb://localhost:27017/admin',
    readPreference: 'secondaryPreferred',
    cmdTmpl: 'CMD',
    ignoreDBs: ['admin', 'config', 'local'],
    dumpParams: {}
  },
  backupDir: 'data/backup',
  dumpKeys: [
    // 'dir:portals-manager:/data/portals-manager',
    // 'dir:data-fair:/data/data-fair',
    'mongo'
  ],
  rsyncKeys: [
    // 'dir:portals-manager:/data/portals-manager',
    // 'dir:data-fair:/data/data-fair',
    'latest-dump'
  ],
  // ownerExports: null,
  // OVH cloud archive backend for cold archiving
  cloudArchive: {
    url: 'pca@gateways.storage.sbg.cloud.ovh.net:backup',
    // tenant: null,
    // user: null,
    // password: null
  },
  rsync: {
    // url: null,
    // port: null,
    // password: null,
    // sshKey: null
  },
  splitSize: '200000000', // 200M
  rotation: {
    day: 4, // number of fresh daily dumps
    week: 3,
    month: 2,
    quarter: 3,
    year: 1
  },
  secretKeys: {
    notifications: 'secret-notifications'
  },
  tmpdir: '/tmp/backup',
  autoTask: {
    exec: 'node scripts/dump.js all',
    // 1am every day ? '0 1 * * *'
    cron: null
  },
  serveExtraDirs: [] // [{"name": "archives", "path": "/data/archives"}]
}
