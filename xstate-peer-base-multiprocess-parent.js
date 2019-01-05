import { fork, spawn } from 'child_process'

import diffy from 'diffy'
import trim from 'diffy/trim'
import diffyInput from 'diffy/input'

import { Machine, actions } from 'xstate'
import { interpret } from 'xstate/lib/interpreter'
const { assign } = actions

import getPort from 'get-port'

let peerA

const peerAStates = {
  initial: 'starting',
  states: {
    'not started': {
      on: { NEXT: 'starting' }
    },
    starting: {
      onEntry: () => { peerA = startPeer('a') },
      on: {
        NEXT: { actions: () => { peerA.send('NEXT') } },
        'PEER A:COLLABORATION CREATED': 'waiting for b to be ready'
      }
    },
    'waiting for b to be ready': {
      onEntry: assign({readyA: true}),
      on: { 'PEER B:COLLABORATION CREATED': 'paused' }
    },
    paused: {
      on: { NEXT: 'editing' }
    },
    editing: {
      onEntry: () => { peerA.send('NEXT') },
      on: { 'PEER A:DONE': 'done' }
    },
    done: {
      onEntry: assign({editedA: true}),
      type: 'final'
    }
  }
}

let peerB

const peerBStates = {
  initial: 'not started',
  states: {
    'not started': {
      on: {
        NEXT: {
          target: 'starting',
          cond: ctx => ctx.readyA
        }
      }
    },
    starting: {
      onEntry: () => { peerB = startPeer('b') },
      on: {
        NEXT: { actions: () => { peerB.send('NEXT') } },
        'PEER B:COLLABORATION CREATED': 'waiting for a to finish'
      },
    },
    'waiting for a to finish': {
      on: {
        NEXT: {
          target: 'editing',
          cond: ctx => ctx.editedA
        }
      }
    },
    editing: {
      onEntry: () => { peerB.send('NEXT') },
      on: { 'PEER B:DONE': 'done' }
    },
    done: {
      type: 'final'
    }
  }
}

const machine = Machine({
  id: 'top',
  initial: 'initial',
  context: {
    readyA: false,
    editedA: false
  },
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
        NEXT: 'peers'
      }
    },
    'peers': {
      id: 'peers',
      type: 'parallel',
      states: {
        'peer a': peerAStates,
        'peer b': peerBStates
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
const peerStates = {
  a: { step: '', crdtValue: '' },
  b: { step: '', crdtValue: '' }
}

const d = diffy({fullscreen: true})

d.render(
  () => trim(`
    State: ${state.slice(0, d.width - 8)}

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
    state = JSON.stringify(nextState.value)
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

async function startRendezvous () {
  const port = await getPort()
  log.push(`RV: Starting rendezvous server on port ${port}`)
  process.env['RENDEZVOUS_PORT'] = port
  const child = spawn('npx', ['rendezvous', '-p', `${port}`])
  child.stdout.on('data', appendToLog)
  child.stderr.on('data', appendToLog)
  process.on('exit', () => child.kill())

  function appendToLog (chunk) {
    log.push(`RV: ` + chunk.toString().replace(/\s+$/, ''))
    d.render()
  }
}

function startPeer (peerLabel) {
  const peerLabelUpper = peerLabel.toUpperCase()
  const child = fork(`${__dirname}/xstate-peer-base-multiprocess-child.js`, {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, PEER_LABEL: peerLabel }
  })

  child.on('message', message => {
    if (message.stateMachine) {
      peerStates[peerLabel].step = message.stateMachine
      service.send(
        `PEER ${peerLabelUpper}:` +
        `${message.stateMachine.toUpperCase()}`
      )
    }
    if (message.crdtValue) {
      peerStates[peerLabel].crdtValue = message.crdtValue
    }
    d.render()
  })

  function appendToLog (chunk) {
    log.push(`${peerLabelUpper}: ` + chunk.toString().replace(/\s+$/, ''))
    d.render()
  }
  child.stdout.on('data', appendToLog)
  child.stderr.on('data', appendToLog)

  process.on('exit', () => child.kill())
  return child
}

function appendToLog (msg) {
  log.push(msg)
  d.render()
}
