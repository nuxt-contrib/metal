
import { STATUS_CODES as statuses } from 'http'

export function escapeRegExp(str) {
  return str.replace(/([.*+?=^!:${}()|[\]\/\\])/g, '\\$1')
}

// RegExp to match non-URL code points, *after* encoding (i.e. not including
// "%") and including invalid escape sequences.
const ENCODE_CHARS_REGEXP =
  /(?:[^\x21\x25\x26-\x3B\x3D\x3F-\x5B\x5D\x5F\x61-\x7A\x7E]|%(?:[^0-9A-Fa-f]|[0-9A-Fa-f][^0-9A-Fa-f]|$))+/g

// RegExp to match unmatched surrogate pair.
const UNMATCHED_SURROGATE_PAIR_REGEXP =
  /(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]|[\uD800-\uDBFF]([^\uDC00-\uDFFF]|$)/g

// String to replace unmatched surrogate pair with.
const UNMATCHED_SURROGATE_PAIR_REPLACE = '$1\uFFFD$2'

// Encode a URL to a percent-encoded form, excluding already-encoded sequences.
//
// This function will take an already-encoded URL and encode all the non-URL
// code points. This function will not encode the "%" character unless it is
// not part of a valid sequence (`%20` will be left as-is, but `%foo` will
// be encoded as `%25foo`).
//
// This encode is meant to be "safe" and does not throw errors. It will
// try as hard as it can to properly encode the given URL, including replacing
// any raw, unpaired surrogate pairs with the Unicode replacement character
// prior to encoding.
export function encodeURL(url) {
  return String(url)
    .replace(UNMATCHED_SURROGATE_PAIR_REGEXP, UNMATCHED_SURROGATE_PAIR_REPLACE)
    .replace(ENCODE_CHARS_REGEXP, encodeURI)
}

// Determine if message is already finished
export function isFinished(msg) {
  const socket = msg.socket
  if (typeof msg.finished === 'boolean') { // OutgoingMessage
    return Boolean(msg.finished || (socket && !socket.writable))
  }
  if (typeof msg.complete === 'boolean') { // IncomingMessage
    return Boolean(msg.upgrade || !socket || !socket.readable || (msg.complete && !msg.readable))
  }
  return undefined
}

// Get status code from response.
export function getResponseStatusCode(res) {
  const status = res.statusCode
  // default status code to 500 if outside valid range
  if (typeof status !== 'number' || status < 400 || status > 599) {
    return 500
  }
  return status
}

// Get headers from Error object
export function getErrorHeaders(err) {
  if (!err.headers || typeof err.headers !== 'object') {
    return undefined
  }
  const headers = Object.create(null)
  for (const key of Object.keys(err.headers)) {
    headers[key] = err.headers[key]
  }
  return headers
}

// Set response headers from an object
export function setHeaders(res, headers) {
  if (!headers) {
    return
  }
  for (const key of Object.keys(headers)) {
    res.setHeader(key, headers[key])
  }
}

// Get status code from Error object.
export function getErrorStatusCode(err) {
  if (typeof err.status === 'number' && err.status >= 400 && err.status < 600) {
    return err.status
  }
  if (typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600) {
    return err.statusCode
  }
  return undefined
}

// Get message from Error object, fallback to status message.
export function getErrorMessage(err, status, env) {
  let msg
  if (env !== 'production') {
    msg = err.stack // typically includes err.message
    // fallback to err.toString() when possible
    if (!msg && typeof err.toString === 'function') {
      msg = err.toString()
    }
  }
  return msg || statuses[status]
}
