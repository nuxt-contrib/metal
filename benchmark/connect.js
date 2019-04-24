const connect = require('connect')
const http = require('http')

const app = connect()

app.use((req, res, next) => {
  req.foobar = 1
  next()
});

app.use((req, res) => {
  res.end(`Hello from Connect! ${++req.foobar}\n`)
})

http.createServer(app).listen(3000)
