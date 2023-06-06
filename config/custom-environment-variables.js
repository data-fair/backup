module.exports = {
  publicUrl: 'PUBLIC_URL',
  sessionDomain: 'SESSION_DOMAIN',
  directoryUrl: 'DIRECTORY_URL',
  privateDirectoryUrl: 'PRIVATE_DIRECTORY_URL',
  notifyUrl: 'NOTIFY_URL',
  privateNotifyUrl: 'PRIVATE_NOTIFY_URL',
  mongo: {
    host: 'MONGO_HOST',
    readPreference: 'MONGO_READ_PREFERENCE',
    ignoreDBs: {
      __name: 'MONGO_IGNORE_DBS',
      __format: 'json'
    },
    dumpParams: {
      __name: 'MONGO_DUMP_PARAMS',
      __format: 'json'
    }
  },
  dumpKeys: {
    __name: 'DUMP_KEYS',
    __format: 'json'
  },
  rsyncKeys: {
    __name: 'RSYNC_KEYS',
    __format: 'json'
  },
  ownerExports: {
    __name: 'OWNER_EXPORTS',
    __format: 'json'
  },
  cloudArchive: {
    url: 'CA_URL',
    tenant: 'CA_TENANT',
    user: 'CA_USER',
    password: 'CA_PASSWORD'
  },
  rsync: {
    url: 'RSYNC_URL',
    password: 'RSYNC_PASSWORD',
    sshKey: 'RSYNC_SSH_KEY'
  },
  rotation: {
    day: {
      __name: 'ROTATION_DAY',
      __format: 'json'
    },
    week: {
      __name: 'ROTATION_WEEK',
      __format: 'json'
    },
    month: {
      __name: 'ROTATION_MONTH',
      __format: 'json'
    },
    quarter: {
      __name: 'ROTATION_QUARTER',
      __format: 'json'
    },
    year: {
      __name: 'ROTATION_YEAR',
      __format: 'json'
    }
  },
  secretKeys: {
    notifications: 'SECRET_NOTIFICATIONS'
  },
  tmpdir: 'TMPDIR',
  autoTask: {
    exec: 'AUTO_TASK_EXEC',
    cron: 'AUTO_TASK_CRON'
  },
  serveExtraDirs: {
    __name: 'SERVE_EXTRA_DIRS',
    __format: 'json'
  }
}
