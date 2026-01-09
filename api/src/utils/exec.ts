import { spawn, type SpawnOptions } from 'node:child_process'
import debugModule from 'debug'

const debug = debugModule('exec')

export function exec (cmd: string, opts: SpawnOptions = {}) {
  debug('exec command', cmd, opts)
  return new Promise<void>((resolve, reject) => {
    // ignore stdin and stdout, inherit stderr
    const childProcess = spawn(cmd, { shell: true, stdio: ['ignore', 'ignore', 'inherit'], ...opts })
    childProcess.on('error', reject)
    childProcess.on('close', (code, signal) => {
      if (signal !== null) return reject(new Error('process interrupted by signal ' + signal))
      if (code !== 0) return reject(new Error('process finished with code ' + code))
      resolve()
    })
  })
}
