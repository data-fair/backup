const dumpUtils = require('../server/utils/dump')

async function main () {
  await dumpUtils.archive(process.argv[2])
}

main().then(() => {
  process.exit()
}, err => {
  console.error(err)
  process.exit(-1)
})
