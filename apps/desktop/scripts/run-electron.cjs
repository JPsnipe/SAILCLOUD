const { spawn } = require('node:child_process')
const path = require('node:path')

const electronPath = require('electron')

const appPath = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
if (args.length === 0) args.push('.')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(electronPath, args, {
  cwd: appPath,
  env,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (typeof code === 'number') process.exit(code)
  process.exit(signal ? 1 : 0)
})

child.on('error', (err) => {
  console.error(err)
  process.exit(1)
})

