import { fork } from 'child_process'

import diffy from 'diffy'
import trim from 'diffy/trim'
import diffyInput from 'diffy/input'

let state = 'forking child process'
let crdtValue = ''
const log = []

const d = diffy({fullscreen: true})

d.render(
  () => trim(`
    Step: ${state}

    CRDT Value: ${crdtValue}

    Logs:
    ${log.slice(-(d.height - 10)).join('\n')}
  `)
)

const input = diffyInput({showCursor: false})

const child = fork(`${__dirname}/xstate-peer-base-multiprocess-child.js`, {
  stdio: ['pipe', 'pipe', 'pipe', 'ipc']
})

child.on('message', message => {
  if (message.stateMachine) {
    state = message.stateMachine
  }
  if (message.crdtValue) {
    crdtValue = message.crdtValue
  }
  d.render()
})

function appendToLog (chunk) {
  log.push(chunk.toString())
  d.render()
}
child.stdout.on('data', appendToLog)
child.stderr.on('data', appendToLog)

process.on('exit', () => child.kill())

input.on('keypress', (ch, key) => {
  switch (key.sequence) {
    case ' ':
      child.send('NEXT')
      break
    case 'q':
      process.exit(0)
      break
  }
})

