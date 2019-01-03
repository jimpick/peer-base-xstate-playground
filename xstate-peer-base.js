import { Machine } from 'xstate'
import { interpret } from 'xstate/lib/interpreter'

import diffy from 'diffy'
import trim from 'diffy/trim'
import diffyInput from 'diffy/input'

import chalk from 'chalk'

import PeerBase from 'peer-base'

class PeerBaseInstance {
  async init () {
    this.backend = PeerBase('xstate-demo', {
      peerBase: {
        ipfs: {
          swarm: ['/ip4/0.0.0.0/tcp/9090/ws/p2p-websocket-star'],
          bootstrap: []
        }
      }
    })
  }
}

let state
let peer1

const peerMachine = Machine({
  id: 'peerBase',
  initial: 'init',
  states: {
    init: {
      on: {
        NEXT: 'new',
      }
    },
    new: {
      onEntry: (ctx, event) => {
        peer1 = new PeerBaseInstance()
        peer1.init()
      },
      on: {
        NEXT: 'start',
      }
    },
    start: {
      onEntry: (ctx, event) => {
        peer1.backend.start()
      },
      on: {
        NEXT: 'done',
      }
    },
    done: {
    }
  }
})

const d = diffy({fullscreen: true})

d.render(
  () => trim(`
    State: ${state && state.value}
  `)
)


const service = interpret(peerMachine)
  .onTransition(nextState => {
    state = nextState
    d.render()
  })
service.start()

const input = diffyInput({showCursor: false})

// input.on('update', () => d.render())
input.on('keypress', (ch, key) => {
  switch (key.sequence) {
    case ' ':
      service.send('NEXT')
      break
    case 'q':
      process.exit(0)
      break
  }
})


