import { STATUS_CODES as statuses } from 'http'
import consola from 'consola'
import {
  env,
  isFinished,
  encodeURL,
  getResponseStatusCode,
  getErrorHeaders,
  getErrorStatusCode,
  getErrorMessage,
  setHeaders
} from './utils'

// Invoke a route handle
export function call(handle, err, req, res, next) {
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
export function onerror(err) {
  if (env !== 'test') {
    consola.error(err.stack || err.toString())
  }
}

// Create a function to handle the final response.
export function response(req, res, options) {
  const opts = options || {}
  const env = opts.env || process.env.NODE_ENV || 'development'
  // get error callback
  const onerror = opts.onerror
  return function (err) {
    let headers
    let msg
    let status
    // ignore 404 on in-flight response
    if (!err && res.headersSent) {
      return
    }
    if (err) {
      status = getErrorStatusCode(err)
      if (status === undefined) {
        status = getResponseStatusCode(res)
      } else {
        headers = getErrorHeaders(err)
      }
      msg = getErrorMessage(err, status, env)
    } else {
      status = 404
      msg = `Cannot ${req.method} ${encodeURL(req.url || 'resource')}`
    }
    if (err && onerror) {
      setImmediate(onerror, err, req, res)
    }
    if (res.headersSent) {
      req.socket.destroy()
      return
    }
    send(req, res, status, headers, msg)
  }
}

function send(req, res, status, headers, message) {
  function write() {
    const body = JSON.stringify({ error: message })
    res.statusCode = status
    res.statusMessage = statuses[status]
    setHeaders(res, headers)
    res.setHeader('Content-Security-Policy', "default-src 'none'")
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Length', Buffer.byteLength(body, 'utf8'))
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    res.end(body, 'utf8')
  }
  if (isFinished(req)) {
    write()
    return
  }
  req.unpipe()
  new Promise((resolve) => {
    function onFinished() {
      req.removeListener('end', onFinished)
      res.removeListener('finish', onFinished)
      res.removeListener('close', onFinished)
      write()
      resolve()
    }
    req.on('end', onFinished)
    res.on('finish', onFinished)
    res.on('close', onFinished)
  }).then(() => req.resume())
}
