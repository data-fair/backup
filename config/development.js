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
      }, {
        db: 'data-fair',
        collections: [{
          collection: 'datasets',
          filter: '{"owner.type": "{ownerType}", "owner.id": "{ownerId}"}',
          project: '{"_id": 0}',
          linkedCollections: [{
            collection: 'dataset-data-{id}',
            filter: '{}',
            ignoreFilterWarning: true,
            optional: true
          }, {
            collection: 'dataset-revisions-{id}',
            filter: '{}',
            ignoreFilterWarning: true,
            optional: true
          }]
        }]
      }]
    },
    dirs: [{
      name: 'test',
      path: './test/{ownerType}/{ownerId}'
    }]
  }
}
