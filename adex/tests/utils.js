import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const dir = (...args) => path.join(__dirname, '..', ...args)

export const devServerURL = new URL('http://localhost:5173/')

/**
 * Wait for vite dev server to start
 * @param {import('node:child_process').ChildProcess} devServerProc
 * @returns {Promise<void>}
 */
function waitForServerStart(devServerProc) {
  return new Promise((resolve, reject) => {
    function onError(err) {
      cleanup()
      reject(err)
    }

    /** @param {number | null} code */
    function onClose(code) {
      cleanup()
      reject(new Error(`Dev server closed unexpectedly with code "${code}"`))
    }

    let serverReady = false
    let stdout = ''
    /** @param {Buffer | string} chunk */
    function onData(chunk) {
      try {
        /** @type {string} */
        const data = Buffer.isBuffer(chunk)
          ? chunk.toString('utf-8')
          : chunk.toString()

        stdout += data

        if (stdout.match(/ready\sin\s[0-9]+\sms/g) != null) {
          serverReady = true
        }

        console.log(stdout)

        if (stdout.match(/localhost:(\d+)/) != null) {
          const matchedPort = stdout.match(/localhost:(\d+)/)
          devServerURL.port = matchedPort[1]
          if (serverReady) {
            cleanup()
            resolve()
          }
        }
      } catch (e) {
        reject(e)
      }
    }

    function cleanup() {
      try {
        devServerProc.stdout?.off('data', onData)
        devServerProc.off('error', onError)
        devServerProc.off('close', onClose)
      } catch (e) {
        reject(e)
      }
    }

    devServerProc.stdout?.on('data', onData)
    devServerProc.on('error', onError)
    devServerProc.on('close', onClose)
  })
}

/**
 * @param {string} fixturePath
 */
export async function launchDemoDevServer(fixturePath) {
  console.log(`launching on ${dir(fixturePath)}`)
  /** @type {import('node:child_process').ChildProcess} */
  const devServerProc = spawn(
    process.execPath,
    [dir('node_modules/vite/bin/vite.js')],
    { cwd: dir(fixturePath), stdio: 'pipe' }
  )

  await waitForServerStart(devServerProc)

  // Ensure the server remains active until the test completes.
  process.once('exit', () => {
    devServerProc.kill()
  })

  return devServerProc
}
