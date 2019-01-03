import { Machine } from 'xstate'
import { interpret } from 'xstate/lib/interpreter'

import diffy from 'diffy'
import trim from 'diffy/trim'
import diffyInput from 'diffy/input'

import chalk from 'chalk'

import PeerBase from 'peer-base'

class PeerBaseInstance {
  init () {
    this.backend = PeerBase('xstate-demo', {
      ipfs: {
        swarm: ['/ip4/0.0.0.0/tcp/9090/ws/p2p-websocket-star']
      }
    })
  }
}

let state
let peer1

const peerMachine = Machine({
  id: 'peerBase',
  initial: 'clean',
  states: {
    clean: {
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
        NEXT: 'starting',
      }
    },
    starting: {
      onEntry: async (ctx, event) => {
        peer1.backend.start()
      }
    },
    started: {
      on: {
        NEXT: 'done',
      }
    },
    done: {
      type: 'final'
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


