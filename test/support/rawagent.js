import assert from 'assert'
import http from 'http'

export default function createRawAgent(app) {
  return new RawAgent(app)
}

class RawAgent {
  constructor(app) {
    this.app = app
    this._open = 0
    this._port = null
    this._server = null
  }
  get(path) {
    return new RawRequest(this, 'GET', path)
  }
  _close(cb) {
    if (--this._open) {
      return process.nextTick(cb)
    }
    this._server.close(cb)
  }
  _start(cb) {
    this._open++
    if (this._port) {
      return process.nextTick(cb)
    }
    if (!this._server) {
      this._server = http.createServer(this.app).listen()
    }
    const agent = this
    this._server.on('listening', function () {
      agent._port = this.address().port
      cb()
    })
  }
}

class RawRequest {
  constructor(agent, method, path) {
    this.agent = agent
    this.method = method
    this.path = path
  }
  expect(status, body, callback) {
    const request = this
    this.agent._start(function () {
      const req = http.request({
        host: '127.0.0.1',
        method: request.method,
        path: request.path,
        port: request.agent._port
      })
      req.on('response', function (res) {
        let buf = ''
        res.setEncoding('utf8')
        res.on('data', (s) => { buf += s })
        res.on('end', () => {
          let err = null
          try {
            assert.strictEqual(res.statusCode, status, `expected ${status} status, got ${res.statusCode}`)
            if (body instanceof RegExp) {
              assert.ok(body.test(buf), 'expected body ' + buf + ' to match ' + body)
            } else {
              assert.strictEqual(buf, body, 'expected ' + body + ' response body, got ' + buf)
            }
          } catch (e) {
            err = e
          }
          request.agent._close(() => callback(err))
        })
      })
      req.end()
    })
  }
}
