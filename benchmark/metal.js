const Metal = require('../dist/metal')
const http = require('http')

const app = Metal.createServer()

app.use((req, res, next) => {
  req.foobar = 1
  next()
})

app.use((req, res) => {
  res.end(`Hello from Connect! ${++req.foobar}\n`)
})

http.createServer(app).listen(3000)
