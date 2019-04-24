
import assert from 'assert'
import http from 'http'
import net from 'net'
import { onFinished, isFinished } from '../src/finished'

describe('onFinished(res, listener)', () => {
  test('should invoke listener given an unknown object', (done) => {
    onFinished({}, done)
  })

  describe('when the response finishes', () => {
    test('should fire the callback', (done) => {
      const server = http.createServer((req, res) => {
        onFinished(res, done)
        setTimeout(res.end.bind(res), 0)
      })
      sendGet(server)
    })

    test('should include the response object', (done) => {
      const server = http.createServer((req, res) => {
        onFinished(res, (err, msg) => {
          assert.ok(!err)
          assert.strictEqual(msg, res)
          done()
        })
        setTimeout(res.end.bind(res), 0)
      })
      sendGet(server)
    })

    test('should fire when called after finish', (done) => {
      const server = http.createServer((req, res) => {
        onFinished(res, () => onFinished(res, done))
        setTimeout(res.end.bind(res), 0)
      })
      sendGet(server)
    })
  })

  describe('when using keep-alive', () => {
    test('should fire for each response', (done) => {
      let socket
      let called = false
      const server = http.createServer((req, res) => {
        onFinished(res, () => {
          if (called) {
            socket.end()
            server.close()
            done(called !== req ? null : new Error('fired twice on same req'))
            return
          }
          called = req
          writeRequest(socket)
        })
        res.end()
      })
      server.listen(function () {
        socket = net.connect(this.address().port, function () {
          writeRequest(this)
        })
      })
    })
  })

  describe('when requests pipelined', () => {
    test('should fire for each request', (done) => {
      let socket
      let count = 0
      const responses = []
      const server = http.createServer((req, res) => {
        responses.push(res)
        onFinished(res, (err) => {
          assert.ifError(err)
          assert.strictEqual(responses[0], res)
          responses.shift()
          if (responses.length === 0) {
            socket.end()
            return
          }
          responses[0].end('response b')
        })
        onFinished(req, (err) => {
          assert.ifError(err)
          if (++count !== 2) {
            return
          }
          assert.strictEqual(responses.length, 2)
          responses[0].end('response a')
        })
        if (responses.length === 1) {
          // second request
          writeRequest(socket)
        }
        req.resume()
      })
      server.listen(function () {
        let data = ''
        socket = net.connect(this.address().port, function () {
          writeRequest(this)
        })
        socket.on('data', (chunk) => {
          data += chunk.toString('binary')
        })
        socket.on('end', () => {
          assert.ok(/response a/.test(data))
          assert.ok(/response b/.test(data))
          server.close(done)
        })
      })
    })
  })

  describe('when response errors', () => {
    test('should fire with error', (done) => {
      let socket
      const server = http.createServer((req, res) => {
        onFinished(res, (err) => {
          assert.ok(err)
          server.close(done)
        })
        socket.on('error', noop)
        socket.write('W')
      })
      server.listen(function () {
        socket = net.connect(this.address().port, function () {
          writeRequest(this, true)
        })
      })
    })

    test('should include the response object', (done) => {
      let socket
      const server = http.createServer((req, res) => {
        onFinished(res, (err, msg) => {
          assert.ok(err)
          assert.strictEqual(msg, res)
          server.close(done)
        })
        socket.on('error', noop)
        socket.write('W')
      })
      server.listen(function () {
        socket = net.connect(this.address().port, function () {
          writeRequest(this, true)
        })
      })
    })
  })

  describe('when the response aborts', () => {
    test('should execute the callback', (done) => {
      let client
      const server = http.createServer((req, res) => {
        onFinished(res, close(server, done))
        setTimeout(client.abort.bind(client), 0)
      })
      server.listen(function () {
        const port = this.address().port
        client = http.get(`http://127.0.0.1:${port}`)
        client.on('error', noop)
      })
    })
  })

  describe('when calling many times on same response', () => {
    test('should not print warnings', (done) => {
      const server = http.createServer((req, res) => {
        const stderr = captureStderr(() => {
          for (let i = 0; i < 400; i++) {
            onFinished(res, noop)
          }
        })
        onFinished(res, done)
        assert.strictEqual(stderr, '')
        res.end()
      })
      server.listen(function () {
        let port = this.address().port
        http.get(`http://127.0.0.1:${port}`, (res) => {
          res.resume()
          res.on('end', server.close.bind(server))
        })
      })
    })
  })
})

describe('isFinished(res)', () => {
  test('should return undefined for unknown object', () => {
    expect(isFinished({})).toBeUndefined()
  })

  test('should be false before response finishes', (done) => {
    const server = http.createServer((req, res) => {
      assert.ok(!isFinished(res))
      res.end()
      done()
    })
    sendGet(server)
  })

  test('should be true after response finishes', (done) => {
    const server = http.createServer((req, res) => {
      onFinished(res, (err) => {
        assert.ifError(err)
        assert.ok(isFinished(res))
        done()
      })
      res.end()
    })
    sendGet(server)
  })

  describe('when requests pipelined', () => {
    test('should have correct state when socket shared', (done) => {
      let socket
      let count = 0
      const responses = []
      const server = http.createServer((req, res) => {
        responses.push(res)
        onFinished(req, (err) => {
          assert.ifError(err)
          if (++count !== 2) {
            return
          }
          assert.ok(!isFinished(responses[0]))
          assert.ok(!isFinished(responses[1]))
          responses[0].end()
          responses[1].end()
          socket.end()
          server.close(done)
        })
        if (responses.length === 1) {
          // second request
          writeRequest(socket)
        }
        req.resume()
      })
      server.listen(function () {
        socket = net.connect(this.address().port, function () {
          writeRequest(this)
        })
      })
    })

    test('should handle aborted requests', (done) => {
      let socket
      let count = 0
      let requests = 0
      const server = http.createServer((req, res) => {
        requests++
        onFinished(req, (err) => {
          switch (++count) {
            case 1:
              assert.ifError(err)
              // abort the socket
              socket.on('error', noop)
              socket.destroy()
              break
            case 2:
              server.close(done)
              break
          }
        })
        req.resume()
        if (requests === 1) {
          // second request
          writeRequest(socket, true)
        }
      })
      server.listen(function () {
        socket = net.connect(this.address().port, function () {
          writeRequest(this)
        })
      })
    })
  })

  describe('when response errors', () => {
    test('should return true', (done) => {
      let socket
      const server = http.createServer((req, res) => {
        onFinished(res, (err) => {
          assert.ok(err)
          assert.ok(isFinished(res))
          server.close(done)
        })
        socket.on('error', noop)
        socket.write('W')
      })
      server.listen(function () {
        socket = net.connect(this.address().port, function () {
          writeRequest(this, true)
        })
      })
    })
  })

  describe('when the response aborts', () => {
    test('should return true', (done) => {
      let client
      const server = http.createServer((req, res) => {
        onFinished(res, (err) => {
          assert.ifError(err)
          assert.ok(isFinished(res))
          server.close(done)
        })
        setTimeout(client.abort.bind(client), 0)
      })
      server.listen(function () {
        let port = this.address().port
        client = http.get(`http://127.0.0.1:${port}`)
        client.on('error', noop)
      })
    })
  })
})

describe('onFinished(req, listener)', () => {
  describe('when the request finishes', () => {
    test('should fire the callback', (done) => {
      const server = http.createServer((req, res) => {
        onFinished(req, done)
        req.resume()
        setTimeout(res.end.bind(res), 0)
      })
      sendGet(server)
    })

    test('should include the request object', (done) => {
      const server = http.createServer((req, res) => {
        onFinished(req, (err, msg) => {
          assert.ok(!err)
          assert.strictEqual(msg, req)
          done()
        })
        req.resume()
        setTimeout(res.end.bind(res), 0)
      })
      sendGet(server)
    })

    test('should fire when called after finish', (done) => {
      const server = http.createServer((req, res) => {
        onFinished(req, () => {
          onFinished(req, done)
        })
        req.resume()
        setTimeout(res.end.bind(res), 0)
      })
      sendGet(server)
    })
  })

  describe('when using keep-alive', () => {
    test('should fire for each request', (done) => {
      let socket
      let called = false
      const server = http.createServer((req, res) => {
        let data = ''
        onFinished(req, (err) => {
          assert.ifError(err)
          assert.strictEqual(data, 'A')
          if (called) {
            socket.end()
            server.close()
            done(called !== req ? null : new Error('fired twice on same req'))
            return
          }
          called = req
          res.end()
          writeRequest(socket, true)
        })
        req.setEncoding('utf8')
        req.on('data', (str) => {
          data += str
        })
        socket.write('1\r\nA\r\n')
        socket.write('0\r\n\r\n')
      })
      server.listen(function () {
        socket = net.connect(this.address().port, function () {
          writeRequest(this, true)
        })
      })
    })
  })

  describe('when request errors', () => {
    test('should fire with error', (done) => {
      let socket
      const server = http.createServer((req, res) => {
        onFinished(req, (err) => {
          assert.ok(err)
          server.close(done)
        })
        socket.on('error', noop)
        socket.write('W')
      })
      server.listen(function () {
        socket = net.connect(this.address().port, function () {
          writeRequest(this, true)
        })
      })
    })

    test('should include the request object', (done) => {
      let socket
      const server = http.createServer((req, res) => {
        onFinished(req, (err, msg) => {
          assert.ok(err)
          assert.strictEqual(msg, req)
          server.close(done)
        })
        socket.on('error', noop)
        socket.write('W')
      })
      server.listen(function () {
        socket = net.connect(this.address().port, function () {
          writeRequest(this, true)
        })
      })
    })
  })

  describe('when requests pipelined', () => {
    test('should handle socket errors', (done) => {
      let socket
      let count = 0
      let wait = 3
      const server = http.createServer((req) => {
        const num = ++count
        onFinished(req, (err) => {
          assert.ok(err)
          if (!--wait) {
            server.close(done)
          }
        })
        if (num === 1) {
          // second request
          writeRequest(socket, true)
          req.pause()
        } else {
          // cause framing error in second request
          socket.write('W')
          req.resume()
        }
      })
      server.listen(function () {
        socket = net.connect(this.address().port, function () {
          writeRequest(this)
        })
        socket.on('close', () => {
          assert.strictEqual(count, 2)
          if (!--wait) {
            server.close(done)
          }
        })
      })
    })
  })

  describe('when the request aborts', () => {
    test('should execute the callback', (done) => {
      let client
      const server = http.createServer((req, res) => {
        onFinished(req, close(server, done))
        setTimeout(client.abort.bind(client), 0)
      })
      server.listen(function () {
        let port = this.address().port
        client = http.get(`http://127.0.0.1:${port}`)
        client.on('error', noop)
      })
    })
  })

  describe('when calling many times on same request', () => {
    test('should not print warnings', (done) => {
      const server = http.createServer((req, res) => {
        let stderr = captureStderr(() => {
          for (var i = 0; i < 400; i++) {
            onFinished(req, noop)
          }
        })
        onFinished(req, done)
        assert.strictEqual(stderr, '')
        res.end()
      })
      server.listen(function () {
        let port = this.address().port
        http.get(`http://127.0.0.1:${port}`, (res) => {
          res.resume()
          res.on('end', server.close.bind(server))
        })
      })
    })
  })

  describe('when CONNECT method', () => {
    test('should fire when request finishes', (done) => {
      let client
      const server = http.createServer((req, res) => {
        res.statusCode = 405
        res.end()
      })
      server.on('connect', (req, socket, bodyHead) => {
        let data = [bodyHead]
        onFinished(req, (err) => {
          assert.ifError(err)
          assert.strictEqual(Buffer.concat(data).toString(), 'knock, knock')
          socket.on('data', (chunk) => {
            assert.strictEqual(chunk.toString(), 'ping')
            socket.end('pong')
          })
          socket.write('HTTP/1.1 200 OK\r\n\r\n')
        })
        req.on('data', (chunk) => {
          data.push(chunk)
        })
      })
      server.listen(function () {
        client = http.request({
          hostname: '127.0.0.1',
          method: 'CONNECT',
          path: '127.0.0.1:80',
          port: this.address().port
        })
        client.on('connect', (res, socket, bodyHead) => {
          socket.write('ping')
          socket.on('data', (chunk) => {
            assert.strictEqual(chunk.toString(), 'pong')
            socket.end()
            server.close(done)
          })
        })
        client.end('knock, knock')
      })
    })

    test('should fire when called after finish', (done) => {
      let client
      const server = http.createServer((req, res) => {
        res.statusCode = 405
        res.end()
      })
      server.on('connect', (req, socket, bodyHead) => {
        let data = [bodyHead]
        onFinished(req, (err) => {
          assert.ifError(err)
          assert.strictEqual(Buffer.concat(data).toString(), 'knock, knock')
          socket.write('HTTP/1.1 200 OK\r\n\r\n')
        })
        socket.on('data', (chunk) => {
          assert.strictEqual(chunk.toString(), 'ping')
          onFinished(req, () => socket.end('pong'))
        })
        req.on('data', (chunk) => {
          data.push(chunk)
        })
      })
      server.listen(function () {
        client = http.request({
          hostname: '127.0.0.1',
          method: 'CONNECT',
          path: '127.0.0.1:80',
          port: this.address().port
        })
        client.on('connect', (res, socket, bodyHead) => {
          socket.write('ping')
          socket.on('data', (chunk) => {
            assert.strictEqual(chunk.toString(), 'pong')
            socket.end()
            server.close(done)
          })
        })
        client.end('knock, knock')
      })
    })
  })

  describe('when Upgrade request', () => {
    test('should fire when request finishes', (done) => {
      let client
      const server = http.createServer((req, res) => {
        res.statusCode = 405
        res.end()
      })
      server.on('upgrade', (req, socket, bodyHead) => {
        let data = [bodyHead]
        onFinished(req, (err) => {
          assert.ifError(err)
          assert.strictEqual(Buffer.concat(data).toString(), 'knock, knock')
          socket.on('data', (chunk) => {
            assert.strictEqual(chunk.toString(), 'ping')
            socket.end('pong')
          })
          socket.write('HTTP/1.1 101 Switching Protocols\r\n')
          socket.write('Connection: Upgrade\r\n')
          socket.write('Upgrade: Raw\r\n')
          socket.write('\r\n')
        })
        req.on('data', (chunk) => {
          data.push(chunk)
        })
      })
      server.listen(function () {
        client = http.request({
          headers: {
            'Connection': 'Upgrade',
            'Upgrade': 'Raw'
          },
          hostname: '127.0.0.1',
          port: this.address().port
        })
        client.on('upgrade', (res, socket, bodyHead) => {
          socket.write('ping')
          socket.on('data', (chunk) => {
            assert.strictEqual(chunk.toString(), 'pong')
            socket.end()
            server.close(done)
          })
        })
        client.end('knock, knock')
      })
    })

    test('should fire when called after finish', (done) => {
      let client
      const server = http.createServer((req, res) => {
        res.statusCode = 405
        res.end()
      })
      server.on('upgrade', (req, socket, bodyHead) => {
        let data = [bodyHead]
        onFinished(req, (err) => {
          assert.ifError(err)
          assert.strictEqual(Buffer.concat(data).toString(), 'knock, knock')
          socket.write('HTTP/1.1 101 Switching Protocols\r\n')
          socket.write('Connection: Upgrade\r\n')
          socket.write('Upgrade: Raw\r\n')
          socket.write('\r\n')
        })
        socket.on('data', (chunk) => {
          assert.strictEqual(chunk.toString(), 'ping')
          onFinished(req, () => socket.end('pong'))
        })
        req.on('data', (chunk) => data.push(chunk))
      })

      server.listen(function () {
        client = http.request({
          headers: {
            'Connection': 'Upgrade',
            'Upgrade': 'Raw'
          },
          hostname: '127.0.0.1',
          port: this.address().port
        })
        client.on('upgrade', (res, socket, bodyHead) => {
          socket.write('ping')
          socket.on('data', (chunk) => {
            assert.strictEqual(chunk.toString(), 'pong')
            socket.end()
            server.close(done)
          })
        })
        client.end('knock, knock')
      })
    })
  })
})

describe('isFinished(req)', () => {
  test('should return undefined for unknown object', () => {
    expect(isFinished({})).toBeUndefined()
  })

  test('should be false before request finishes', (done) => {
    const server = http.createServer((req, res) => {
      assert.ok(!isFinished(req))
      req.resume()
      res.end()
      done()
    })
    sendGet(server)
  })

  test('should be true after request finishes', (done) => {
    const server = http.createServer((req, res) => {
      onFinished(req, (err) => {
        assert.ifError(err)
        assert.ok(isFinished(req))
        done()
      })
      req.resume()
      res.end()
    })
    sendGet(server)
  })

  describe('when request data buffered', () => {
    test('should be false before request finishes', (done) => {
      const server = http.createServer((req, res) => {
        assert.ok(!isFinished(req))
        req.pause()
        setTimeout(() => {
          assert.ok(!isFinished(req))
          req.resume()
          res.end()
          done()
        }, 10)
      })
      sendGet(server)
    })
  })

  describe('when request errors', () => {
    test('should return true', (done) => {
      let socket
      const server = http.createServer((req, res) => {
        onFinished(req, (err) => {
          assert.ok(err)
          assert.ok(isFinished(req))
          server.close(done)
        })
        socket.on('error', noop)
        socket.write('W')
      })
      server.listen(function () {
        socket = net.connect(this.address().port, function () {
          writeRequest(this, true)
        })
      })
    })
  })

  describe('when the request aborts', () => {
    test('should return true', (done) => {
      let client
      const server = http.createServer((req, res) => {
        onFinished(res, (err) => {
          assert.ifError(err)
          assert.ok(isFinished(req))
          server.close(done)
        })
        setTimeout(client.abort.bind(client), 0)
      })
      server.listen(function () {
        let port = this.address().port
        client = http.get(`http://127.0.0.1:${port}`)
        client.on('error', noop)
      })
    })
  })

  describe('when CONNECT method', () => {
    test('should be true immediately', (done) => {
      let client
      const server = http.createServer((req, res) => {
        res.statusCode = 405
        res.end()
      })
      server.on('connect', (req, socket, bodyHead) => {
        assert.ok(isFinished(req))
        assert.strictEqual(bodyHead.length, 0)
        req.resume()
        socket.on('data', (chunk) => {
          assert.strictEqual(chunk.toString(), 'ping')
          socket.end('pong')
        })
        socket.write('HTTP/1.1 200 OK\r\n\r\n')
      })
      server.listen(function () {
        client = http.request({
          hostname: '127.0.0.1',
          method: 'CONNECT',
          path: '127.0.0.1:80',
          port: this.address().port
        })
        client.on('connect', (res, socket, bodyHead) => {
          socket.write('ping')
          socket.on('data', (chunk) => {
            assert.strictEqual(chunk.toString(), 'pong')
            socket.end()
            server.close(done)
          })
        })
        client.end()
      })
    })

    test('should be true after request finishes', (done) => {
      let client
      const server = http.createServer((req, res) => {
        res.statusCode = 405
        res.end()
      })
      server.on('connect', (req, socket, bodyHead) => {
        let data = [bodyHead]
        onFinished(req, (err) => {
          assert.ifError(err)
          assert.ok(isFinished(req))
          assert.strictEqual(Buffer.concat(data).toString(), 'knock, knock')
          socket.write('HTTP/1.1 200 OK\r\n\r\n')
        })
        socket.on('data', (chunk) => {
          assert.strictEqual(chunk.toString(), 'ping')
          socket.end('pong')
        })
        req.on('data', (chunk) => data.push(chunk))
      })

      server.listen(function () {
        client = http.request({
          hostname: '127.0.0.1',
          method: 'CONNECT',
          path: '127.0.0.1:80',
          port: this.address().port
        })
        client.on('connect', (res, socket, bodyHead) => {
          socket.write('ping')
          socket.on('data', (chunk) => {
            assert.strictEqual(chunk.toString(), 'pong')
            socket.end()
            server.close(done)
          })
        })
        client.end('knock, knock')
      })
    })
  })

  describe('when Upgrade request', () => {
    test('should be true immediately', (done) => {
      let client
      const server = http.createServer((req, res) => {
        res.statusCode = 405
        res.end()
      })
      server.on('upgrade', (req, socket, bodyHead) => {
        assert.ok(isFinished(req))
        assert.strictEqual(bodyHead.length, 0)
        req.resume()
        socket.on('data', (chunk) => {
          assert.strictEqual(chunk.toString(), 'ping')
          socket.end('pong')
        })
        socket.write('HTTP/1.1 101 Switching Protocols\r\n')
        socket.write('Connection: Upgrade\r\n')
        socket.write('Upgrade: Raw\r\n')
        socket.write('\r\n')
      })
      server.listen(function () {
        client = http.request({
          headers: {
            'Connection': 'Upgrade',
            'Upgrade': 'Raw'
          },
          hostname: '127.0.0.1',
          port: this.address().port
        })
        client.on('upgrade', (res, socket, bodyHead) => {
          socket.write('ping')
          socket.on('data', (chunk) => {
            assert.strictEqual(chunk.toString(), 'pong')
            socket.end()
            server.close(done)
          })
        })
        client.end()
      })
    })

    test('should be true after request finishes', (done) => {
      let client
      const server = http.createServer((req, res) => {
        res.statusCode = 405
        res.end()
      })
      server.on('upgrade', (req, socket, bodyHead) => {
        let data = [bodyHead]
        onFinished(req, (err) => {
          assert.ifError(err)
          assert.ok(isFinished(req))
          assert.strictEqual(Buffer.concat(data).toString(), 'knock, knock')
          socket.write('HTTP/1.1 101 Switching Protocols\r\n')
          socket.write('Connection: Upgrade\r\n')
          socket.write('Upgrade: Raw\r\n')
          socket.write('\r\n')
        })
        socket.on('data', (chunk) => {
          assert.strictEqual(chunk.toString(), 'ping')
          socket.end('pong')
        })
        req.on('data', (chunk) => data.push(chunk))
      })
      server.listen(function () {
        client = http.request({
          headers: {
            'Connection': 'Upgrade',
            'Upgrade': 'Raw'
          },
          hostname: '127.0.0.1',
          port: this.address().port
        })
        client.on('upgrade', (res, socket, bodyHead) => {
          socket.write('ping')
          socket.on('data', (chunk) => {
            assert.strictEqual(chunk.toString(), 'pong')
            socket.end()
            server.close(done)
          })
        })
        client.end('knock, knock')
      })
    })
  })
})

function captureStderr (fn) {
  const chunks = []
  const write = process.stderr.write
  process.stderr.write = (chunk, encoding) => {
    // eslint-disable-next-line node/no-deprecated-api
    chunks.push(new Buffer(chunk, encoding))
  }
  try {
    fn()
  } finally {
    process.stderr.write = write
  }
  return Buffer.concat(chunks).toString('utf8')
}

function close (server, callback) {
  return (error) => {
    server.close((err) => {
      callback(error || err)
    })
  }
}

function noop () {}

function sendGet (server) {
  server.listen(function () {
    var port = this.address().port
    http.get(`http://127.0.0.1:${port}`, (res) => {
      res.resume()
      res.on('end', server.close.bind(server))
    })
  })
}

function writeRequest (socket, chunked) {
  socket.write('GET / HTTP/1.1\r\n')
  socket.write('Host: localhost\r\n')
  socket.write('Connection: keep-alive\r\n')
  if (chunked) {
    socket.write('Transfer-Encoding: chunked\r\n')
  }
  socket.write('\r\n')
}
