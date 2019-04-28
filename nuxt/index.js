module.exports = function () {
  this.nuxt.hook('render:before', (renderer) => {
    const Metal = require('..')
    const app = Metal.createServer()
    renderer.app = app
  })
}
