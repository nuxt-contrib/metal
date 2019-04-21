import http from 'http'
import { Buffer } from 'safe-buffer'
import handler from '../../src/handler'
import {
  createServer,
  createError,
  createSlowWriteStream,
  rawrequest,
  request,
  shouldHaveStatusMessage,
  shouldNotHaveBody,
  shouldNotHaveHeader
} from './support/utils'

const describeStatusMessage = !/statusMessage/
  .test(http.IncomingMessage.toString())
    ? describe.skip
    : describe

describe('handler(req, res)', () => {
  describe('headers', () => {
    test('should ignore err.headers without status code', (done) => {
      request(createServer(createError('oops!', {
        headers: { 'X-Custom-Header': 'foo' }
      })))
        .get('/')
        .expect(shouldNotHaveHeader('X-Custom-Header'))
        .expect(500, done)
    })

    test('should ignore err.headers with invalid res.status', (done) => {
      request(createServer(createError('oops!', {
        headers: { 'X-Custom-Header': 'foo' },
        status: 601
      })))
        .get('/')
        .expect(shouldNotHaveHeader('X-Custom-Header'))
        .expect(500, done)
    })

    test('should ignore err.headers with invalid res.statusCode', (done) => {
      request(createServer(createError('oops!', {
        headers: { 'X-Custom-Header': 'foo' },
        statusCode: 601
      })))
        .get('/')
        .expect(shouldNotHaveHeader('X-Custom-Header'))
        .expect(500, done)
    })

    test('should include err.headers with err.status', (done) => {
      request(createServer(createError('oops!', {
        headers: { 'X-Custom-Header': 'foo=500', 'X-Custom-Header2': 'bar' },
        status: 500
      })))
        .get('/')
        .expect('X-Custom-Header', 'foo=500')
        .expect('X-Custom-Header2', 'bar')
        .expect(500, done)
    })

    test('should include err.headers with err.statusCode', (done) => {
      request(createServer(createError('too many requests', {
        headers: { 'Retry-After': '5' },
        statusCode: 429
      })))
        .get('/')
        .expect('Retry-After', '5')
        .expect(429, done)
    })

    test('should ignore err.headers when not an object', (done) => {
      request(createServer(createError('oops!', {
        headers: 'foobar',
        statusCode: 500
      })))
        .get('/')
        .expect(500, done)
    })
  })

  describe('status code', () => {
    test('should 404 on no error', (done) => {
      request(createServer())
        .get('/')
        .expect(404, done)
    })

    test('should 500 on error', (done) => {
      request(createServer(createError()))
        .get('/')
        .expect(500, done)
    })

    test('should use err.statusCode', (done) => {
      request(createServer(createError('nope', {
        statusCode: 400
      })))
        .get('/')
        .expect(400, done)
    })

    test('should ignore non-error err.statusCode code', (done) => {
      request(createServer(createError('created', {
        statusCode: 201
      })))
        .get('/')
        .expect(500, done)
    })

    test('should ignore non-numeric err.statusCode', (done) => {
      request(createServer(createError('oops', {
        statusCode: 'oh no'
      })))
        .get('/')
        .expect(500, done)
    })

    test('should use err.status', (done) => {
      request(createServer(createError('nope', {
        status: 400
      })))
        .get('/')
        .expect(400, done)
    })

    test('should use err.status over err.statusCode', (done) => {
      request(createServer(createError('nope', {
        status: 400,
        statusCode: 401
      })))
        .get('/')
        .expect(400, done)
    })

    test('should set status to 500 when err.status < 400', (done) => {
      request(createServer(createError('oops', {
        status: 202
      })))
        .get('/')
        .expect(500, done)
    })

    test('should set status to 500 when err.status > 599', (done) => {
      request(createServer(createError('oops', {
        status: 601
      })))
        .get('/')
        .expect(500, done)
    })

    test('should use err.statusCode over invalid err.status', (done) => {
      request(createServer(createError('nope', {
        status: 50,
        statusCode: 410
      })))
        .get('/')
        .expect(410, done)
    })

    test('should ignore non-error err.status code', (done) => {
      request(createServer(createError('created', {
        status: 201
      })))
        .get('/')
        .expect(500, done)
    })

    test('should ignore non-numeric err.status', (done) => {
      request(createServer(createError('oops', {
        status: 'oh no'
      })))
        .get('/')
        .expect(500, done)
    })
  })

  describeStatusMessage('status message', () => {
    test('should be "Not Found" on no error', (done) => {
      request(createServer())
        .get('/')
        .expect(shouldHaveStatusMessage('Not Found'))
        .expect(404, done)
    })

    test('should be "Internal Server Error" on error', (done) => {
      request(createServer(createError()))
        .get('/')
        .expect(shouldHaveStatusMessage('Internal Server Error'))
        .expect(500, done)
    })

    test('should be "Bad Request" when err.statusCode = 400', (done) => {
      request(createServer(createError('oops', {
        status: 400
      })))
        .get('/')
        .expect(shouldHaveStatusMessage('Bad Request'))
        .expect(400, done)
    })

    test('should reset existing res.statusMessage', (done) => {
      function onRequest (req, res, next) {
        res.statusMessage = 'An Error Occurred'
        next(new Error())
      }

      request(createServer(onRequest))
        .get('/')
        .expect(shouldHaveStatusMessage('Internal Server Error'))
        .expect(500, done)
    })
  })

  describe('404 response', () => {
    test('should include method and pathname', (done) => {
      request(createServer())
        .get('/foo')
        .expect(404, /<pre>Cannot GET \/foo<\/pre>/, done)
    })

    test('should escape method and pathname characters', (done) => {
      rawrequest(createServer())
        .get('/<la\'me>')
        .expect(404, /<pre>Cannot GET \/%3Cla&#39;me%3E<\/pre>/, done)
    })

    test('should encode bad pathname characters', (done) => {
      rawrequest(createServer())
        .get('/foo%20§')
        .expect(404, /<pre>Cannot GET \/foo%20%C2%A7<\/pre>/, done)
    })

    test('should fallback to generic pathname without URL', (done) => {
      const server = createServer((req, res, next) => {
        req.url = undefined
        next()
      })

      request(server)
        .get('/foo')
        .expect(404, /<pre>Cannot GET resource<\/pre>/, done)
    })

    test('should include original pathname', (done) => {
      const server = createServer((req, res, next) => {
        cons tparts = req.url.split('/')
        req.originalUrl = req.url
        req.url = `/${parts.slice(2).join('/')}`
        next()
      })
      request(server)
        .get('/foo/bar')
        .expect(404, /<pre>Cannot GET \/foo\/bar<\/pre>/, done)
    })

    test('should include pathname only', (done) => {
      rawrequest(createServer())
        .get('http://localhost/foo?bar=1')
        .expect(404, /<pre>Cannot GET \/foo<\/pre>/, done)
    })

    test('should handle HEAD', (done) => {
      request(createServer())
        .head('/foo')
        .expect(404)
        .expect(shouldNotHaveBody())
        .end(done)
    })

    test('should include X-Content-Type-Options header', (done) => {
      request(createServer())
        .get('/foo')
        .expect('X-Content-Type-Options', 'nosniff')
        .expect(404, done)
    })

    test('should includeContent-Security-Policy header', (done) => {
      request(createServer())
        .get('/foo')
        .expect('Content-Security-Policy', "default-src 'none'")
        .expect(404, done)
    })

    test('should not hang/error if there is a request body', (done) => {
      const buf = Buffer.alloc(1024 * 16, '.')
      const server = createServer()
      const test = request(server).post('/foo')
      test.write(buf)
      test.write(buf)
      test.write(buf)
      test.expect(404, done)
    })
  })

  describe('error response', () => {
    test('should include error stack', (done) => {
      request(createServer(createError('boom!')))
        .get('/foo')
        .expect(500, /<pre>Error: boom!<br> &nbsp; &nbsp;at/, done)
    })

    test('should handle HEAD', (done) => {
      request(createServer())
        .head('/foo')
        .expect(404)
        .expect(shouldNotHaveBody())
        .end(done)
    })

    test('should include X-Content-Type-Options header', (done) => {
      request(createServer(createError('boom!')))
        .get('/foo')
        .expect('X-Content-Type-Options', 'nosniff')
        .expect(500, done)
    })

    test('should includeContent-Security-Policy header', (done) => {
      request(createServer(createError('boom!')))
        .get('/foo')
        .expect('Content-Security-Policy', "default-src 'none'")
        .expect(500, done)
    })

    test('should handle non-error-objects', (done) => {
      request(createServer('lame string'))
        .get('/foo')
        .expect(500, /<pre>lame string<\/pre>/, done)
    })

    test('should handle null prototype objects', (done) => {
      request(createServer(Object.create(null)))
        .get('/foo')
        .expect(500, /<pre>Internal Server Error<\/pre>/, done)
    })

    test('should send staus code name when production', (done) => {
      const err = createError('boom!', { status: 501 })
      request(createServer(err, { env: 'production' }))
        .get('/foo')
        .expect(501, /<pre>Not Implemented<\/pre>/, done)
    })

    describe('when there is a request body', () => {
      test('should not hang/error when unread', (done) => {
        const buf = Buffer.alloc(1024 * 16, '.')
        const server = createServer(new Error('boom!'))
        const test = request(server).post('/foo')
        test.write(buf)
        test.write(buf)
        test.write(buf)
        test.expect(500, done)
      })

      test('should not hang/error when actively piped', (done) => {
        const buf = Buffer.alloc(1024 * 16, '.')
        const server = createServer((req, res, next) => {
          req.pipe(stream)
          process.nextTick(() => {
            next(new Error('boom!'))
          })
        })
        const stream = createSlowWriteStream()
        const test = request(server).post('/foo')
        test.write(buf)
        test.write(buf)
        test.write(buf)
        test.expect(500, done)
      })

      test('should not hang/error when read', (done) => {
        const buf = Buffer.alloc(1024 * 16, '.')
        const server = createServer((req, res, next) => {
          // read off the request
          req.once('end', () => {
            next(new Error('boom!'))
          })
          req.resume()
        })
        const test = request(server).post('/foo')
        test.write(buf)
        test.write(buf)
        test.write(buf)
        test.expect(500, done)
      })
    })

    describe('when res.statusCode set', () => {
      test('should keep when >= 400', (done) => {
        const server = http.createServer((req, res) => {
          const done = handler(req, res)
          res.statusCode = 503
          done(new Error('oops'))
        })
        request(server)
          .get('/foo')
          .expect(503, done)
      })

      test('should convert to 500 is not a number', (done) => {
        const server = http.createServer((req, res) => {
          const done = handler(req, res)
          res.statusCode = 'oh no'
          done(new Error('oops'))
        })
        request(server)
          .get('/foo')
          .expect(500, done)
      })

      test('should override with err.status', (done) => {
        const server = http.createServer((req, res) => {
          const done = handler(req, res)
          const err = createError('oops', {
            status: 414,
            statusCode: 503
          })
          done(err)
        })
        request(server)
          .get('/foo')
          .expect(414, done)
      })

      test('should default body to status message in production', (done) => {
        const err = createError('boom!', { status: 509 })
        request(createServer(err, { env: 'production' }))
          .get('/foo')
          .expect(509, /<pre>Bandwidth Limit Exceeded<\/pre>/, done)
      })
    })

    describe('when res.statusCode undefined', () => {
      test('should set to 500', (done) => {
        const server = http.createServer((req, res) => {
          const done = handler(req, res)
          res.statusCode = undefined
          done(new Error('oops'))
        })
        request(server)
          .get('/foo')
          .expect(500, done)
      })
    })
  })

  describe('request started', () => {
    test('should not respond', (done) => {
      const server = http.createServer((req, res) => {
        const done = handler(req, res)
        res.statusCode = 301
        res.write('0')
        process.nextTick(() => {
          done()
          res.end('1')
        })
      })

      request(server)
        .get('/foo')
        .expect(301, '01', done)
    })

    test('should terminate on error', (done) => {
      const server = http.createServer((req, res) => {
        const done = handler(req, res)
        res.statusCode = 301
        res.write('0')
        process.nextTick(() => {
          done(createError('too many requests', {
            status: 429,
            headers: { 'Retry-After': '5' }
          }))
          res.end('1')
        })
      })
      request(server)
        .get('/foo')
        .expect(301, '0', done)
    })
  })

  describe('onerror', () => {
    test('should be invoked when error', (done) => {
      let err = new Error('boom!')
      let error
      function log (e) {
        error = e
      }
      request(createServer(err, { onerror: log }))
        .get('/')
        .end(() => {
          assert.equal(error, err)
          done()
        })
    })
  })
})