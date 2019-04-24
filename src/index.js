
import http from 'http'
import { EventEmitter } from 'events'
import { getURLPathname, trimURLPath, escapeRegExp } from './utils'
import handler from './handler'

export default class Metal extends EventEmitter {
  static createServer () {
    const app = new Metal()
    function appHandler () {
      return appHandler.handle(...arguments)
    }
    appHandler.route = '/'
    appHandler.stack = []
    appHandler.use = app.use.bind(appHandler)
    appHandler.listen = app.listen.bind(appHandler)
    appHandler.handle = app.handle.bind(appHandler)
    for (const member in Metal.prototype) {
      appHandler[member] = Metal.prototype[member]
    }
    return appHandler
  }
  listen () {
    const server = http.createServer(this)
    return server.listen.apply(server, arguments)
  }
  use (route, handle) {
    // default route to '/'
    if (typeof route !== 'string' || route instanceof RegExp) {
      handle = route
      route = '/'
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
    this.stack.push({ route, handle })
    return this
  }
  async handle (req, res, out) {
    let index = 0
    let stack = this.stack
    req.originalUrl = req.originalUrl || req.url
    let done = out || handler(req, res, { env, onerror })
    function next (err) {
      const layer = stack[index++]
      if (!layer) {
        setImmediate(done, err)
        return
      }
      const path = req.url
      const match = path.match(layer.route)
      if (match) {
        req.match = match
        return call(layer.handle, layer.route, err, req, res, next)
      } else {
        return next()
      }
    }
    await next()
  }
}

// Invoke a route handle.
function call (handle, route, err, req, res, next) {
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

const env = process.env.NODE_ENV || 'development'

// Log error using console.error.
function onerror (err) {
  if (env !== 'test') {
    console.error(err.stack || err.toString())
  }
}
