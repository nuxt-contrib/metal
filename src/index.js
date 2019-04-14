
// Copyright(c) 2010 Sencha Inc.
// Copyright(c) 2011 TJ Holowaychuk
// Copyright(c) 2015 Douglas Christopher Wilson
// MIT Licensed

import http from 'http'
import { EventEmitter } from 'events'
import { getURLPathname } from './utils'
import finalhandler from './finalhandler'

const env = process.env.NODE_ENV || 'development'
const proto = {}

class Metal extends EventEmitter {
  static createServer() {
    const app = new Metal()
    app.route = '/'
    app.stack = []
    return function() {
      app.handle(arguments)
    }
  }
  listen() {
    const server = http.createServer(this)
    return server.listen.apply(server, arguments)
  }
  use(route, handle) {
    // default route to '/'
    if (typeof route !== 'string') {
      handle = route
      route = '/'
    }
    // wrap sub-apps
    if (typeof handle.handle === 'function') { 
      const server = handle
      server.route = route
      handle = function (req, res, next) {
        server.handle(req, res, next)
      }
    }
    // wrap vanilla http.Servers
    if (handle instanceof http.Server) {
      handle = handle.listeners('request')[0]
    }
    // strip trailing slash
    if (route[route.length - 1] === '/') {
      route = route.slice(0, -1)
    }
    this.stack.push({ route, handle })
    return this
  }
  handle(req, res, out) {
    var index = 0
    var protohost = getProtohost(req.url) || ''
    var removed = ''
    var slashAdded = false
    var stack = this.stack

    // final function handler
    var done = out || finalhandler(req, res, {
      env: env,
      onerror: logerror
    })

    // store the original URL
    req.originalUrl = req.originalUrl || req.url

    function next(err) {
      if (slashAdded) {
        req.url = req.url.substr(1)
        slashAdded = false
      }

      if (removed.length !== 0) {
        req.url = protohost + removed + req.url.substr(protohost.length)
        removed = ''
      }

      // next callback
      var layer = stack[index++]

      // all done
      if (!layer) {
        setImmediate(done, err)
        return
      }

      // route data
      var path = getURLPathname(req.url) || '/'
      var route = layer.route

      // skip this layer if the route doesn't match
      if (path.toLowerCase().substr(0, route.length) !== route.toLowerCase()) {
        return next(err)
      }

      // skip if route match does not border "/", ".", or end
      var c = path.length > route.length && path[route.length]
      if (c && c !== '/' && c !== '.') {
        return next(err)
      }

      // trim off the part of the url that matches the route
      if (route.length !== 0 && route !== '/') {
        removed = route
        req.url = protohost + req.url.substr(protohost.length + removed.length)

        // ensure leading slash
        if (!protohost && req.url[0] !== '/') {
          req.url = '/' + req.url
          slashAdded = true
        }
      }

      // call the layer handle
      call(layer.handle, route, err, req, res, next)
    }
    next()
  }
}

// Invoke a route handle.
function call(handle, route, err, req, res, next) {
  var arity = handle.length
  var error = err
  var hasError = Boolean(err)

  try {
    if (hasError && arity === 4) {
      // error-handling middleware
      handle(err, req, res, next)
      return
    } else if (!hasError && arity < 4) {
      // request-handling middleware
      handle(req, res, next)
      return
    }
  } catch (e) {
    // replace the error
    error = e
  }

  // continue
  next(error)
}

// Log error using console.error.
function logerror(err) {
  if (env !== 'test') console.error(err.stack || err.toString())
}

// Get get protocol + host for a URL.
function getProtohost(url) {
  if (url.length === 0 || url[0] === '/') {
    return undefined
  }

  var searchIndex = url.indexOf('?')
  var pathLength = searchIndex !== -1
    ? searchIndex
    : url.length
  var fqdnIndex = url.substr(0, pathLength).indexOf('://')

  return fqdnIndex !== -1
    ? url.substr(0, url.indexOf('/', 3 + fqdnIndex))
    : undefined
}
