import { io } from 'socket.io-client'
import { API_URL } from './api'

let socket = null

function resolveSocketUrl() {
  if (API_URL && API_URL !== '/api') {
    return API_URL.replace(/\/api$/, '')
  }
  return window.location.origin
}

export function getSocket() {
  if (!socket) {
    socket = io(resolveSocketUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
    })
  }
  return socket
}

export function subscribeToMarketplace(onUpdate) {
  const s = getSocket()
  s.on('equipment:sold', onUpdate)
  s.on('equipment:created', onUpdate)
  return () => {
    s.off('equipment:sold', onUpdate)
    s.off('equipment:created', onUpdate)
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
