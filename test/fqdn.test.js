
import Metal from '../src/index'
import rawrequest from './support/rawagent'

let app

describe('app.use()', () => {
  beforeEach(() => {
    app = Metal.createServer()
  })

  test('should not obscure FQDNs', (done) => {
    app.use((req, res) => res.end(req.url))
    rawrequest(app)
      .get('http://example.com/foo')
      .expect(200, 'http://example.com/foo', done)
  })

  describe('with a connect app', function () {
    test('should adjust FQDN req.url', (done) => {
      app.use('/blog', (req, res) => res.end(req.url))
      rawrequest(app)
        .get('http://example.com/blog/post/1')
        .expect(200, 'http://example.com/post/1', done)
    })

    test('should adjust FQDN req.url with multiple handlers', (done) => {
      app.use((req, res, next) => next())
      app.use('/blog', (req, res) => res.end(req.url))
      rawrequest(app)
        .get('http://example.com/blog/post/1')
        .expect(200, 'http://example.com/post/1', done)
    })

    test('should adjust FQDN req.url with multiple routed handlers', (done) => {
      app.use('/blog', (req, res, next) => next())
      app.use('/blog', (req, res) => res.end(req.url))
      rawrequest(app)
        .get('http://example.com/blog/post/1')
        .expect(200, 'http://example.com/post/1', done)
    })
  })
})
