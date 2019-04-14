// Package: unpipe
// Author: Douglas Christopher Wilson

// Unpipe a stream from all destinations
export default function unpipe (stream) {
  if (!stream) {
    throw new TypeError('argument stream is required')
  }

  if (typeof stream.unpipe === 'function') {
    // new-style
    stream.unpipe()
    return
  }

  for (const listener of stream.listeners('close')) {
    if (listener.name !== 'cleanup' && listener.name !== 'onclose') {
      continue
    }
    listener.call(stream)
  }
}
