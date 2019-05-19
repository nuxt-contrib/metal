import http from 'http'
import { EventEmitter } from 'events'
import { escapeRegExp } from './utils'
import { metalStack } from './symbols'
import baseHandler from './handlers/base'

const env = process.env.NODE_ENV || 'development'

export default class Metal extends EventEmitter {
  static createServer(...args) {
    const app = new Metal(...args)
    return (req, res, next) => {
      return app.handle(req, res, next)
    }
  }
  constructor(handler, ...middleware) {
    super()
    this.handle = handler || baseHandler
    this.route = '/'
    this[metalStack] = []
    for (const mddlwr in middleware) {
      this.use(mddlwr)
    }
  }
  listen() {
    const server = http.createServer(this)
    return server.listen.apply(server, arguments)
  }
  use(route, handle) {
    // default route to '/'
    if (typeof route !== 'string' || route instanceof RegExp) {
      handle = route
      route = /\//
    } else if (!(route instanceof RegExp)) {
      route = new RegExp(escapeRegExp(route), 'i')
    }
    // wrap sub-apps
    if (typeof handle.handle === 'function') {
      const server = handle
      server.route = route
      handle = (req, res, next) => server.handle(req, res, next)
    }
    // wrap vanilla http.Servers
    if (handle instanceof http.Server) {
      handle = handle.listeners('request')[0]
    }
    this[metalStack].push({ route, handle })
    return this
  }
}
