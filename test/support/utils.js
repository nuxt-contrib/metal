
import assert from 'assert'
import finalhandler from '../../src/final'
import http from 'http'
import _request from 'supertest'
import SlowWriteStream from './sws'

export const request = _request

export function createError (message, props) {
  var err = new Error(message)

  if (props) {
    for (var prop in props) {
      err[prop] = props[prop]
    }
  }

  return err
}

function createServer (err, opts) {
  return http.createServer(function (req, res) {
    var done = finalhandler(req, res, opts)

    if (typeof err === 'function') {
      err(req, res, done)
      return
    }

    done(err)
  })
}

export function createSlowWriteStream () {
  return new SlowWriteStream()
}

export function rawrequest (server) {
  var _headers = {}
  var _path

  function expect (status, body, callback) {
    if (arguments.length === 2) {
      _headers[status.toLowerCase()] = body
      return this
    }

    server.listen(function onlisten () {
      var addr = this.address()
      var port = addr.port

      var req = http.get({
        host: '127.0.0.1',
        path: _path,
        port: port
      })
      req.on('error', callback)
      req.on('response', function onresponse (res) {
        var buf = ''

        res.setEncoding('utf8')
        res.on('data', function ondata (s) { buf += s })
        res.on('end', function onend () {
          var err = null

          try {
            for (var key in _headers) {
              assert.strictEqual(res.headers[key], _headers[key])
            }

            assert.strictEqual(res.statusCode, status)

            if (body instanceof RegExp) {
              assert.ok(body.test(buf), 'expected body ' + buf + ' to match ' + body)
            } else {
              assert.strictEqual(buf, body, 'expected ' + body + ' response body, got ' + buf)
            }
          } catch (e) {
            err = e
          }

          server.close()
          callback(err)
        })
      })
    })
  }

  function get (path) {
    _path = path

    return {
      expect: expect
    }
  }

  return {
    get: get
  }
}

export function shouldHaveStatusMessage (statusMessage) {
  return function (test) {
    assert.strictEqual(test.res.statusMessage, statusMessage, 'should have statusMessage "' + statusMessage + '"')
  }
}

export function shouldNotHaveBody () {
  return function (res) {
    assert.ok(res.text === '' || res.text === undefined)
  }
}

export function shouldNotHaveHeader (header) {
  return function (test) {
    assert.ok(test.res.headers[header] === undefined, 'response does not have header "' + header + '"')
  }
}
