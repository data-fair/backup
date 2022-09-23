module.exports = {
  mongo: {
    cmdTmpl: `docker run --privileged=true --network=host --rm -v /tmp:/tmp -v ${process.cwd()}:/workdir/:Z -w /workdir/ mongo:4.0 bash -c "CMD"`,
    dumpParams: {
      'notify-production': '--excludeCollection=notifications'
    }
  },
  splitSize: '100',
  autoTask: {
    cron: '* * * * *'
  },
  serveExtraDirs: [{ name: 'public', path: 'public' }],
  dumpKeys: [
    'dir:test:./test',
    'mongo'
  ],
  ownerExports: {
    dir: 'data/owner-exports',
    mongo: {
      dbs: [{
        db: 'simple-directory-production',
        collections: [{
          collection: 'organizations',
          filter: '{"_id": "{ownerId}"}',
          project: '{}',
          ownerType: 'organization'
        }, {
          collection: 'users',
          filter: '{"organizations.id": "{ownerId}"}',
          project: '{"password": 0, "organizations": {"$elemMatch": {"id": "{ownerId}"}}}',
          ownerType: 'organization'
        }, {
          collection: 'users',
          filter: '{"_id": "{ownerId}"}',
          project: '{"password": 0, "organizations": {"$elemMatch": {"id": "emptyOrgsArray"}}}',
          ownerType: 'user'
        }]
      }]
    },
    dirs: [{
      name: 'test',
      path: './test/{ownerType}/{ownerId}'
    }]
  }
}
