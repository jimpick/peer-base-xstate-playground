import { fork, spawn } from 'child_process'

import diffy from 'diffy'
import trim from 'diffy/trim'
import diffyInput from 'diffy/input'

import { Machine } from 'xstate'
import { interpret } from 'xstate/lib/interpreter'

import getPort from 'get-port'

const machine = Machine({
  id: 'top',
  initial: 'initial',
  states: {
    initial: {
      on: {
        NEXT: 'starting rendezvous'
      }
    },
    'starting rendezvous': {
      invoke: {
        id: 'startRendezvous',
        src: startRendezvous,
        onDone: 'rendezvous started',
        onError: 'failed'
      }
    },
    'rendezvous started': {
      on: {
        NEXT: 'peer a'
      }
    },
    'peer a': {
      invoke: {
        id: 'peerA',
        src: startPeerA,
        onDone: 'done',
        onError: 'failed'
      },
      on: {
        NEXT: {
          actions: () => { peerA.send('NEXT') }
        }
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

let state = ''
const log = []
let peerA
const peerStates = {
  a: { step: '', crdtValue: '' },
  b: { step: '', crdtValue: '' }
}

const d = diffy({fullscreen: true})

d.render(
  () => trim(`
    Step: ${state.value}

    Peer A:
      Step: ${peerStates['a'].step}
      CRDT Value: ${peerStates['a'].crdtValue}

    Peer B:
      Step: ${peerStates['b'].step}
      CRDT Value: ${peerStates['b'].crdtValue}

    Logs:
    ${log.slice(-(d.height - 15)).join('\n')}
  `)
)

const input = diffyInput({showCursor: false})

const service = interpret(machine)
  .onTransition(nextState => {
    state = nextState
    d.render()
  })
service.start()

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

function appendToLog (chunk) {
  log.push(chunk.toString())
  d.render()
}

async function startRendezvous () {
  const port = await getPort()
  log.push(`Starting rendezvous server on port ${port}`)
  process.env['RENDEZVOUS_PORT'] = port
  const child = spawn('npx', ['rendezvous', '-p', `${port}`])
  child.stdout.on('data', appendToLog)
  child.stderr.on('data', appendToLog)
  process.on('exit', () => child.kill())
}

function startPeerA () {
  const promise = new Promise((resolve, reject) => {
    const child = fork(`${__dirname}/xstate-peer-base-multiprocess-child.js`, {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    })

    child.on('message', message => {
      if (message.stateMachine) {
        peerStates['a'].step = message.stateMachine
      }
      if (message.crdtValue) {
        peerStates['a'].crdtValue = message.crdtValue
      }
      d.render()
    })

    function appendToLog (chunk) {
      log.push(`A: ` + chunk.toString())
      d.render()
    }
    child.stdout.on('data', appendToLog)
    child.stderr.on('data', appendToLog)

    process.on('exit', () => child.kill())
    peerA = child
  })
  return promise
}
