
import http from 'http'
import Metal from '../../src/index'
import rawrequest from './support/rawagent'

let app

describe('app.use()', () => {
  beforeEach(() => {
    app = Metal.createServer()
  })

  test('should not obscure FQDNs', (done) => {
    app.use(function(req, res){
      res.end(req.url)
    })

    rawrequest(app)
    .get('http://example.com/foo')
    .expect(200, 'http://example.com/foo', done)
  })

  describe('with a connect app', function(){
    test('should ignore FQDN in search', function (done) {
      app.use('/proxy', function (req, res) {
        res.end(req.url)
      })

      rawrequest(app)
      .get('/proxy?url=http://example.com/blog/post/1')
      .expect(200, '/?url=http://example.com/blog/post/1', done)
    })

    test('should ignore FQDN in path', function (done) {
      app.use('/proxy', function (req, res) {
        res.end(req.url)
      })

      rawrequest(app)
      .get('/proxy/http://example.com/blog/post/1')
      .expect(200, '/http://example.com/blog/post/1', done)
    })

    test('should adjust FQDN req.url', (done) => {
      app.use('/blog', function(req, res){
        res.end(req.url)
      })

      rawrequest(app)
      .get('http://example.com/blog/post/1')
      .expect(200, 'http://example.com/post/1', done)
    })

    test('should adjust FQDN req.url with multiple handlers', (done) => {
      app.use(function(req,res,next) {
        next()
      })

      app.use('/blog', function(req, res){
        res.end(req.url)
      })

      rawrequest(app)
      .get('http://example.com/blog/post/1')
      .expect(200, 'http://example.com/post/1', done)
    })

    test('should adjust FQDN req.url with multiple routed handlers', function(done) {
      app.use('/blog', function(req,res,next) {
        next()
      })
      app.use('/blog', function(req, res) {
        res.end(req.url)
      })

      rawrequest(app)
      .get('http://example.com/blog/post/1')
      .expect(200, 'http://example.com/post/1', done)
    })
  })
})
