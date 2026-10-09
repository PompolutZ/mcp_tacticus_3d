// Two linked fake channels. A frame sent on one arrives on the other, as an ArrayBuffer.
export function linkedChannels({ open = true } = {}) {
  const make = () => {
    const ch = new EventTarget()
    ch.readyState = open ? 'open' : 'connecting'
    ch.sent = []
    return ch
  }
  const a = make()
  const b = make()
  const wire = (from, to) => {
    from.send = (frame) => {
      from.sent.push(frame)
      const copy = frame.slice().buffer
      queueMicrotask(() => {
        const event = new Event('message')
        event.data = copy
        to.dispatchEvent(event)
      })
    }
  }
  wire(a, b)
  wire(b, a)
  const openBoth = () => {
    for (const ch of [a, b]) {
      ch.readyState = 'open'
      ch.dispatchEvent(new Event('open'))
    }
  }
  return { a, b, openBoth }
}
