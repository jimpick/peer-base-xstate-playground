import { fork, spawn } from 'child_process'

import diffy from 'diffy'
import trim from 'diffy/trim'
import diffyInput from 'diffy/input'

import { Machine } from 'xstate'
import { interpret } from 'xstate/lib/interpreter'

import getPort from 'get-port'

let peerA

const peerAStates = {
  initial: 'not started',
  states: {
    'not started': {
      on: {
        NEXT: 'starting'
      }
    },
    starting: {
      onEntry: () => { peerA = startPeer('a') },
      on: {
        NEXT: {
          actions: () => { peerA.send('NEXT') }
        },
        'PEER A:COLLABORATION CREATED': 'editing'
      }
    },
    editing: {
      on: {
        NEXT: {
          actions: () => { peerA.send('NEXT') }
        },
        'PEER A:DONE': 'done'
      }
    },
    done: {
      type: 'final'
    }
  }
}

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
      ...peerAStates
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
    Step: ${state}

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
    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
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
      peerStates['a'].crdtValue = message.crdtValue
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
