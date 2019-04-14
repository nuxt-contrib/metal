
import statuses from './statuses'
import {
  onFinished,
  isFinished
} from './on-finished'
import { 
  encodeURL, 
  getURLPathname, 
  getHeadersSent, 
  getResponseStatusCode,
  getErrorHeaders
} from './utils'

// Create a function to handle the final response.
export default function finalHandler (req, res, options) {
  var opts = options || {}
  var env = opts.env || process.env.NODE_ENV || 'development'
  // get error callback
  var onerror = opts.onerror
  return function (err) {
    var headers
    var msg
    var status

    // ignore 404 on in-flight response
    if (!err && getHeadersSent(res)) {
      debug('cannot 404 after headers sent')
      return
    }

    if (err) {
      status = getErrorStatusCode(err)

      if (status === undefined) {
        // fallback to status code on response
        status = getResponseStatusCode(res)
      } else {
        // respect headers from error
        headers = getErrorHeaders(err)
      }
      msg = getErrorMessage(err, status, env)
    } else {
      status = 404
      msg = 'Cannot ' + req.method + ' ' + encodeUrl(getResourceName(req))
    }

    debug('default %s', status)

    // schedule onerror callback
    if (err && onerror) {
      setImmediate(onerror, err, req, res)
    }

    // cannot actually respond
    if (getHeadersSent(res)) {
      req.socket.destroy()
      return
    }

    // send response
    send(req, res, status, headers, msg)
  }
}



// Get message from Error object, fallback to status message.
function getErrorMessage (err, status, env) {
  var msg

  if (env !== 'production') {
    // use err.stack, which typically includes err.message
    msg = err.stack

    // fallback to err.toString() when possible
    if (!msg && typeof err.toString === 'function') {
      msg = err.toString()
    }
  }

  return msg || statuses[status]
}

// Get status code from Error object.
function getErrorStatusCode (err) {
  // check err.status
  if (typeof err.status === 'number' && err.status >= 400 && err.status < 600) {
    return err.status
  }

  // check err.statusCode
  if (typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600) {
    return err.statusCode
  }

  return undefined
}

// Get resource name for the request.
//
// This is typically just the original pathname of the request
// but will fallback to "resource" is that cannot be determined.

function getResourceName (req) {
  try {
    return getURLPathname(req.originalUrl)
  } catch (e) {
    return 'resource'
  }
}

// getResponseStatusCode
// getHeadersSent


// Send response.
function send (req, res, status, headers, message) {
  function write () {
    // response body
    var body = JSON.stringify({ error: message })

    // response status
    res.statusCode = status
    res.statusMessage = statuses[status]

    // response headers
    setHeaders(res, headers)

    // security headers
    res.setHeader('Content-Security-Policy', "default-src 'none'")
    res.setHeader('X-Content-Type-Options', 'nosniff')

    // standard headers
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

  // unpipe everything from the request
  req.unpipe()

  // flush the request
  onFinished(req, write)
  req.resume()
}

// Set response headers from an object.

function setHeaders (res, headers) {
  if (!headers) {
    return
  }

  var keys = Object.keys(headers)
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
    res.setHeader(key, headers[key])
  }
}

// Copyright(c) 2014-2017 Douglas Christopher Wilson
