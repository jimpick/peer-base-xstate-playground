import { fork } from 'child_process'

import diffy from 'diffy'
import trim from 'diffy/trim'
import diffyInput from 'diffy/input'

let state
const log = []

const d = diffy({fullscreen: true})

d.render(
  () => trim(`
    State: ${state}
    Logs:
    ${log}
  `)
)

const input = diffyInput({showCursor: false})

/*
const child = fork(`${__dirname}/xstate-peer-base-multiprocess-child.js`)
const child = fork(`${__dirname}/xstate-peer-base-multiprocess-child.js`, {
  stdio: ['inherit', 'inherit', 'inherit', 'ipc']
})
*/
const child = fork(`${__dirname}/xstate-peer-base-multiprocess-child.js`, {
  stdio: ['pipe', 'pipe', 'pipe', 'ipc']
})

child.on('message', message => {
  state = message
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

