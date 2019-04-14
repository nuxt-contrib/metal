// Package: https://github.com/jshttp/on-finished
// Authors: Jonathan Ong, Douglas Christopher Wilson

const first = require('./ee-first')

onFinished.isFinished = isFinished

// Invoke callback when the response has finished, useful for
// cleaning up resources afterwards.
module.exports = function onFinished (msg, listener) {
  if (isFinished(msg) !== false) {
    setImmediate(listener, null, msg)
    return msg
  }
  // attach the listener to the message
  attachListener(msg, listener)
  return msg
}

// Determine if message is already finished.
export function isFinished (msg) {
  const socket = msg.socket
  if (typeof msg.finished === 'boolean') { // OutgoingMessage
    return Boolean(msg.finished || (socket && !socket.writable))
  }
  if (typeof msg.complete === 'boolean') { // IncomingMessage
    return Boolean(msg.upgrade || !socket || !socket.readable || (msg.complete && !msg.readable))
  }
  return undefined
}

// Attach a finished listener to the message.
function attachFinishedListener (msg, callback) {
  var eeMsg
  var eeSocket
  var finished = false

  function onFinish (error) {
    eeMsg.cancel()
    eeSocket.cancel()
    finished = true
    callback(error)
  }

  // finished on first message event
  eeMsg = eeSocket = first([[msg, 'end', 'finish']], onFinish)

  function onSocket (socket) {
    // remove listener
    msg.removeListener('socket', onSocket)
    if (finished || eeMsg !== eeSocket) {
      return
    }
    // finished on first socket event
    eeSocket = first([[socket, 'error', 'close']], onFinish)
  }

  if (msg.socket) { // socket already assigned
    onSocket(msg.socket)
    return
  }

  // wait for socket to be assigned
  msg.on('socket', onSocket)
}

// Attach the listener to the message.
function attachListener (msg, listener) {
  let attached = msg.__onFinished
  // create a private single listener with queue
  if (!attached || !attached.queue) {
    attached = msg.__onFinished = createListener(msg)
    attachFinishedListener(msg, attached)
  }
  attached.queue.push(listener)
}

// Create listener on message.
function createListener (msg) {
  function listener (err) {
    if (msg.__onFinished === listener) {
      msg.__onFinished = null
    }
    if (!listener.queue) {
      return
    }
    const queue = listener.queue
    listener.queue = null
    for (const qListener of queue) {
      qListener(err, msg)
    }
  }
  listener.queue = []
  return listener
}
