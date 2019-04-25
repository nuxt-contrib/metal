
import assert from 'assert'
import http from 'http'
import Metal from '../src/index'
import { escapeRegExp } from '../src/utils'
import rawrequest from './support/rawagent'
import request from 'supertest'

function re(str) {
  return new RegExp(escapeRegExp(str), 'i')
}

describe('app.listen()', () => {
  test('should wrap in an http.Server', (done) => {
    const app = Metal.createServer()
    app.use((_, res) => res.end())
    const server = app.listen(0, () => {
      expect(server).toBeTruthy()
      request(server)
        .get('/')
        .expect(200, (err) => {
          server.close(() => done(err))
        })
    })
  })
})

let app

describe('app', () => {
  beforeEach(() => {
    app = Metal.createServer()
  })

  test('should inherit from event emitter', (done) => {
    app.on('foo', done)
    app.emit('foo')
  })

  test('should work in http.createServer', (done) => {
    const app = Metal.createServer()
    app.use((req, res) => {
      res.end('hello, world!')
    })
    request(http.createServer(app))
      .get('/')
      .expect(200, 'hello, world!', done)
  })

  test('should be a callable function', async (done) => {
    const app = Metal.createServer()
    app.use((req, res) => {
      res.end('hello, world!')
    })
    async function handler (req, res) {
      res.write('oh, ')
      await app(req, res)
    }
    request(http.createServer(handler))
      .get('/')
      .expect(200, 'oh, hello, world!', done)
  })

  test('should invoke callback if request not handled', (done) => {
    const app = Metal.createServer()
    app.use('/foo', (req, res) => {
      res.end('hello, world!')
    })
    function handler (req, res) {
      res.write('oh, ')
      app(req, res, () => res.end('no!'))
    }
    request(http.createServer(handler))
      .get('/')
      .expect(200, 'oh, no!', done)
  })

  test('should invoke callback on error', (done) => {
    const app = Metal.createServer()
    app.use((req, res) => {
      throw new Error('boom!')
    })
    function handler (req, res) {
      res.write('oh, ')
      app(req, res, function (err) {
        res.end(err.message)
      })
    }
    request(http.createServer(handler))
      .get('/')
      .expect(200, 'oh, boom!', done)
  })

  test('should work as middleware', (done) => {
    // custom server handler array
    const handlers = [Metal.createServer(), (req, res, next) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('Ok')
    }]
    // execute callbacks in sequence
    let n = 0
    function run (req, res) {
      if (handlers[n]) {
        handlers[n++](req, res, () => {
          run(req, res)
        })
      }
    }
    request(http.createServer(run))
      .get('/')
      .expect(200, 'Ok', done)
  })

  test('should include path info in 500 response body', (done) => {
    app.use((req, res, next) => {
      next(new Error('error!'))
    })
    request(app)
      .get('/')
      .expect(/"Error: error!\\n/)
      .expect(500, done)
  })

  describe('404 handler', () => {
    test('should include path info in 404 response body', (done) => {
      rawrequest(app)
        .get('/foo/<script>stuff\'n</script>')
        .expect(404, re('{"error":"Cannot GET /foo/%3Cscript%3Estuff\'n%3C'), done)
    })

    test('shoud not fire after headers sent', (done) => {
      const app = Metal.createServer()
      app.use((req, res, next) => {
        res.write('body')
        res.end()
        process.nextTick(next)
      })
      request(app)
        .get('/')
        .expect(200, done)
    })

    test('shoud have no body for HEAD', (done) => {
      request(Metal.createServer())
        .head('/')
        .expect(404)
        .expect(shouldHaveNoBody())
        .end(done)
    })
  })

  describe('error handler', () => {
    test('should have escaped response body', (done) => {
      const app = Metal.createServer()
      app.use((req, res, next) => {
        throw new Error('<script>alert()</script>')
      })
      request(app)
        .get('/')
        .expect(500, re('{"error":"Error: <script>alert()</script>'), done)
    })

    it('should use custom error code', (done) => {
      const app = Metal.createServer()
      app.use((req, res, next) => {
        var err = new Error('ack!')
        err.status = 503
        throw err
      })
      request(app)
        .get('/')
        .expect(503, done)
    })

    it('should keep error statusCode', (done) => {
      const app = Metal.createServer()
      app.use((req, res, next) => {
        res.statusCode = 503
        throw new Error('ack!')
      })
      request(app)
        .get('/')
        .expect(503, done)
    })

    test('shoud not fire after headers sent', (done) => {
      const app = Metal.createServer()
      app.use((req, res, next) => {
        res.write('body')
        res.end()
        process.nextTick(() => {
          next(new Error('ack!'))
        })
      })
      request(app)
        .get('/')
        .expect(200, done)
    })

    test('shoud have no body for HEAD', (done) => {
      const app = Metal.createServer()
      app.use((req, res, next) => {
        throw new Error('ack!')
      })
      request(app)
        .head('/')
        .expect(500)
        .expect(shouldHaveNoBody())
        .end(done)
    })
  })
})

function shouldHaveNoBody () {
  return function (res) {
    assert.ok(res.text === '' || res.text === undefined)
  }
}
