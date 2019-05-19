import { metalStack } from '../symbols'
import { env } from '../utils'
import response from '../response'

export default async function baseHandler(req, res, out) {
  let index = 0
  const stack = this[metalStack]
  req.originalUrl = req.originalUrl || req.url
  const done = out || response(req, res, { env, onerror })
  function next(err) {
    const { route, handle } = stack[index++] || {}
    if (!route) {
      return done(err)
    }
    return call(handle, err, req, res, next)
  }
  await next()
}
