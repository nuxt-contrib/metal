
import http from 'http'
import Metal from '../../src/index'
import { request } from './support/utils'

let app

describe('app.use()', () => {
  beforeEach(() => {
    app = Metal.createServer()
  })

  test('should match all paths with "/"', (done) => {
    app.use('/', (req, res) => res.end(req.url))
    request(app)
      .get('/blog')
      .expect(200, '/blog', done)
  })

  test('should match full path', (done) => {
    app.use('/blog', (req, res) => res.end(req.url))
    request(app)
      .get('/blog')
      .expect(200, '/', done)
  })

  test('should match left-side of path', (done) => {
    app.use('/blog', (req, res) => res.end(req.url))
    request(app)
      .get('/blog/article/1')
      .expect(200, '/article/1', done)
  })

  test('should match up to dot', (done) => {
    app.use('/blog', (req, res) => res.end(req.url))
    request(app)
      .get('/blog.json')
      .expect(200, done)
  })

  test('should not match shorter path', (done) => {
    app.use('/blog-o-rama', (req, res) => res.end(req.url))
    request(app)
      .get('/blog')
      .expect(404, done)
  })

  test('should not end match in middle of component', (done) => {
    app.use('/blog', (req, res) => res.end(req.url))
    request(app)
      .get('/blog-o-rama/article/1')
      .expect(404, done)
  })

  test('should be case insensitive (lower-case route, mixed-case request)', (done) => {
    const blog = http.createServer((req, res) => {
      expect(req.url).toBe('/')
      res.end('blog')
    })
    app.use('/blog', blog)
    request(app)
      .get('/BLog')
      .expect('blog', done)
  })

  test('should be case insensitive (mixed-case route, lower-case request)', (done) => {
    const blog = http.createServer((req, res) => {
      expect(req.url).toBe('/')
      res.end('blog')
    })
    app.use('/BLog', blog)
    request(app)
      .get('/blog')
      .expect('blog', done)
  })

  test('should be case insensitive (mixed-case route, mixed-case request)', (done) => {
    const blog = http.createServer((req, res) => {
      expect(req.url).toBe('/')
      res.end('blog')
    })
    app.use('/BLog', blog)
    request(app)
      .get('/blOG')
      .expect('blog', done)
  })

  test('should ignore fn.arity > 4', (done) => {
    const invoked = []
    app.use((req, res, next, _a, _b) => {
      invoked.push(0)
      next()
    })
    app.use((req, res, next) => {
      invoked.push(1)
      next(new Error('err'))
    })
    app.use((err, req, res, next) => {
      invoked.push(2)
      res.end(invoked.join(','))
    })
    request(app)
      .get('/')
      .expect(200, '1,2', done)
  })
})

describe('with a connect app', () => {
  test('should mount', (done) => {
    const blog = Metal.createServer()
    blog.use((req, res) => {
      expect(req.url).toBe('/')
      res.end('blog')
    })
    app.use('/blog', blog)
    request(app)
      .get('/blog')
      .expect(200, 'blog', done)
  })

  test('should retain req.originalUrl', (done) => {
    app.use('/blog', (req, res) => {
      res.end(req.originalUrl)
    })
    request(app)
      .get('/blog/post/1')
      .expect(200, '/blog/post/1', done)
  })

  test('should adjust req.url', function(done){
    app.use('/blog', (req, res) => {
      res.end(req.url)
    })

    request(app)
      .get('/blog/post/1')
      .expect(200, '/post/1', done)
  })

  test('should strip trailing slash', function(done){
    const blog = Metal.createServer()
    blog.use((req, res) => {
      expect(req.url).toBe('/')
      res.end('blog')
    })
    app.use('/blog/', blog)
    request(app)
      .get('/blog')
      .expect('blog', done)
  })

  test('should set .route', function(){
    const blog = Metal.createServer()
    const admin = Metal.createServer()
    app.use('/blog', blog)
    blog.use('/admin', admin)
    expect(app.route).toBe('/')
    expect(blog.route).toBe('/blog')
    expect(admin.route).toBe('/admin')
  })

  test('should not add trailing slash to req.url', (done) => {
    app.use('/admin', (req, res, next) => next())
    app.use((req, res, next) => res.end(req.url))
    request(app)
      .get('/admin')
      .expect('/admin', done)
  })
})

describe('with a node app', () => {
  test('should mount', (done) => {
    const blog = http.createServer((req, res) => {
      expect(req.url).toBe('/')
      res.end('blog')
    })
    app.use('/blog', blog)
    request(app)
      .get('/blog')
      .expect('blog', done)
  })
})

describe('error handling', function(){
  test('should send errors to airty 4 fns', function(done){
    app.use(function(req, res, next){
      next(new Error('msg'))
    })
    app.use(function(err, req, res, next){
      res.end('got error ' + err.message)
    })

    request(app)
    .get('/')
    .expect('got error msg', done)
  })

  test('should skip to non-error middleware', function(done){
    var invoked = false

    app.use(function(req, res, next){
      next(new Error('msg'))
    })
    app.use(function(req, res, next){
      invoked = true
      next()
    })
    app.use(function(err, req, res, next){
      res.end(invoked ? 'invoked' : err.message)
    })

    request(app)
    .get('/')
    .expect(200, 'msg', done)
  })

  test('should start at error middleware declared after error', function(done){
    var invoked = false

    app.use(function(err, req, res, next){
      res.end('fail: ' + err.message)
    })
    app.use(function(req, res, next){
      next(new Error('boom!'))
    })
    app.use(function(err, req, res, next){
      res.end('pass: ' + err.message)
    })

    request(app)
    .get('/')
    .expect(200, 'pass: boom!', done)
  })

  test('should stack error fns', function(done){
    app.use(function(req, res, next){
      next(new Error('msg'))
    })
    app.use(function(err, req, res, next){
      res.setHeader('X-Error', err.message)
      next(err)
    })
    app.use(function(err, req, res, next){
      res.end('got error ' + err.message)
    })

    request(app)
    .get('/')
    .expect('X-Error', 'msg')
    .expect(200, 'got error msg', done)
  })

  test('should invoke error stack even when headers sent', function(done){
    app.use(function(req, res, next){
      res.end('0')
      next(new Error('msg'))
    })
    app.use(function(err, req, res, next){
      done()
    })

    request(app)
    .get('/')
    .end(function(){})
  })
})
