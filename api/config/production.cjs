module.exports = {
  port: 8080,
  mongo: {
    ignoreDBs: [
      'sirene-3-production',
      'cadastre-production',
      'node-rate-limiter-flexible',
      'admin',
      'config',
      'local'
    ]
  }
}
