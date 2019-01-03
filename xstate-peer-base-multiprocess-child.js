import { Machine } from 'xstate'
import { interpret } from 'xstate/lib/interpreter'

import PeerBase from 'peer-base'

let backend

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
      onEntry: () => {
        backend = PeerBase('xstate-demo', {
          ipfs: {
            swarm: ['/ip4/0.0.0.0/tcp/9090/ws/p2p-websocket-star']
          }
        })
      },
      on: {
        NEXT: 'starting',
      }
    },
    starting: {
      invoke: {
        id: 'startPeerBase',
        src: () => backend.start(),
        onDone: 'started',
        onError: 'failed'
      },
    },
    started: {
      on: {
        NEXT: 'done',
      }
    },
    done: {
      type: 'final'
    },
    failed: {
      type: 'final'
    }
  }
})

const service = interpret(peerMachine)
  .onTransition(nextState => {
    process.send(nextState.value)
  })
service.start()

process.on('message', message => service.send(message))