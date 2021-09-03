module.exports = {
  port: 5600,
  sessionDomain: null,
  publicUrl: 'http://localhost:5600',
  directoryUrl: 'http://localhost:5600/simple-directory',
  notifyUrl: 'http://localhost:5600/notify',
  mongo: {
    host: 'localhost',
    port: 27017,
    readPreference: 'secondaryPreferred',
    cmdTmpl: 'CMD',
    ignoreDBs: ['admin', 'config', 'local'],
    dumpParams: {}
  },
  backupDir: `data/backup`,
  dumpKeys: [
    'dir:portals-manager:/data/portals-manager',
    'dir:data-fair:/data/data-fair',
    'mongo'
  ],
  // OVH cloud archive backend for cold archiving
  cloudArchive: {
    url: 'pca@gateways.storage.sbg.cloud.ovh.net:backup',
    tenant: null,
    user: null,
    password: null
  },
  rsync: {
    url: null,
    password: null
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
  }
}
