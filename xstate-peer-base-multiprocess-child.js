import { Machine } from 'xstate'
import { interpret } from 'xstate/lib/interpreter'

import PeerBase from 'peer-base'
import IPFSRepo from 'ipfs-repo'
import { MemoryDatastore } from 'interface-datastore'

let app
let collaboration

const peerMachine = Machine({
  id: 'peerBase',
  initial: 'clean',
  states: {
    clean: {
      on: {
        NEXT: 'new'
      }
    },
    new: {
      onEntry: () => {
        app = PeerBase('xstate-demo', {
          ipfs: {
            repo: new IPFSRepo('ipfs', {
              lock: 'memory',
              storageBackends: {
                root: MemoryDatastore,
                blocks: MemoryDatastore,
                keys: MemoryDatastore,
                datastore: MemoryDatastore
              }
            }),
            swarm: ['/ip4/0.0.0.0/tcp/9090/ws/p2p-websocket-star']
          }
        })
      },
      on: {
        NEXT: 'starting'
      }
    },
    starting: {
      invoke: {
        id: 'startPeerBase',
        src: () => app.start(),
        onDone: 'started',
        onError: 'failed'
      },
    },
    started: {
      on: {
        NEXT: 'create collaboration'
      }
    },
    'create collaboration': {
      invoke: {
        id: 'startPeerBase',
        src: async () => {
          collaboration = await app.collaborate('collab1', 'rga')
          collaboration.on('state changed', () => {
            process.send({
              crdtValue: collaboration.shared.value().join('')
            })
          })
        },
        onDone: 'collaboration created',
        onError: 'failed'
      },
    },
    'collaboration created': {
      on: {
        NEXT: 'type a'
      }
    },
    'type a': {
      onEntry: () => { collaboration.shared.push('a') },
      on: {
        NEXT: 'type b'
      }
    },
    'type b': {
      onEntry: () => { collaboration.shared.push('b') },
      on: {
        NEXT: 'type c'
      }
    },
    'type c': {
      onEntry: () => { collaboration.shared.push('c') },
      on: {
        NEXT: 'done'
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
    process.send({
      stateMachine: nextState.value
    })
  })
service.start()

process.on('message', message => service.send(message))