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
  }
}
