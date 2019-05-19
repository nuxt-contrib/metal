import { call, response } from '../response'
import { env, trimURLPath } from '../utils'
import { metalStack } from './symbols'

export default function pathHandler(req, res, out) {
  let index = 0
  let removed = ''
  let slashAdded = false
  const protohost = trimURLPath(req.url) || ''
  const stack = this[metalStack]

  // final function handler
  const done = out || response(req, res, {
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
    const layer = stack[index++]

    // all done
    if (!layer) {
      setImmediate(done, err)
      return
    }

    // route data
    const path = parseUrl(req).pathname || '/'
    const route = layer.route

    // skip this layer if the route doesn't match
    if (path.toLowerCase().substr(0, route.length) !== route.toLowerCase()) {
      return next(err)
    }

    // skip if route match does not border "/", ".", or end
    const c = path.length > route.length && path[route.length]
    if (c && c !== '/' && c !== '.') {
      return next(err)
    }

    // trim off the part of the url that matches the route
    if (route.length !== 0 && route !== '/') {
      removed = route
      req.url = `${protohost}${req.url.substr(protohost.length + removed.length)}`

      // ensure leading slash
      if (!protohost && req.url[0] !== '/') {
        req.url = `/${req.url}`
        slashAdded = true
      }
    }

    // call the layer handle
    call(layer.handle, route, err, req, res, next)
  }

  next()
}
