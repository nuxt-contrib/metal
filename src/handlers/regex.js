import { metalStack } from '../symbols'
import { env } from '../utils'

export default async function regexHandler(req, res, out) {
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
