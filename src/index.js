import http from 'http'
import { EventEmitter } from 'events'
import { escapeRegExp } from './utils'
import handler from './handler'

const env = process.env.NODE_ENV || 'development'
const metalStack = Symbol('metal:stack')

export default class Metal extends EventEmitter {
  static createServer() {
    const app = new Metal()
    function appHandler(req, res, next) {
      return appHandler.handle(req, res, next)
    }
    appHandler.route = '/'
    appHandler[metalStack] = []
    appHandler.use = app.use.bind(appHandler)
    appHandler.listen = app.listen.bind(appHandler)
    appHandler.handle = app.handle.bind(appHandler)
    for (const member in Metal.prototype) {
      appHandler[member] = Metal.prototype[member]
    }
    return appHandler
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
  async handle(req, res, out) {
    let index = 0
    const stack = this[metalStack]
    req.originalUrl = req.originalUrl || req.url
    const done = out || handler(req, res, { env, onerror })
    function next(err) {
      const { route, handle } = stack[index++] || {}
      if (!route) {
        return done(err)
      }
      // eslint-disable-next-line no-cond-assign
      if (req.match = route.exec(req.url)) {
        return call(handle, err, req, res, next)
      } else {
        return next()
      }
    }
    await next()
  }
}

// Invoke a route handle.
function call(handle, err, req, res, next) {
  const arity = handle.length
  const hasError = Boolean(err)
  let error = err

  try {
    if (hasError && arity === 4) {
      // error-handling middleware
      return handle(err, req, res, next)
    } else if (!hasError && arity < 4) {
      // request-handling middleware
      return handle(req, res, next)
    }
  } catch (e) {
    // replace the error
    error = e
  }
  return next(error)
}

// Log error using console.error.
function onerror(err) {
  if (env !== 'test') {
    console.error(err.stack || err.toString())
  }
}
