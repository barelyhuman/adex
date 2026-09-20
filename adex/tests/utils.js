import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripColors } from 'kolorist'

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

        const matchableStdout = stripColors(stdout)

        if (matchableStdout.match(/ready\sin\s[0-9]+\sms/g) != null) {
          serverReady = true
        }

        if (matchableStdout.match(/localhost:(\d+)/) != null) {
          const matchedPort = matchableStdout.match(/localhost:(\d+)/)
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
 * @param {{ port?: number }} [options]
 */
export async function launchDemoDevServer(fixturePath, options = {}) {
  console.log(`launching on ${dir(fixturePath)}`)
  const args = [dir('node_modules/vite/bin/vite.js')]
  if (options.port) {
    args.push('--strictPort', '--port', String(options.port))
  }
  /** @type {import('node:child_process').ChildProcess} */
  const devServerProc = spawn(process.execPath, args, {
    cwd: dir(fixturePath),
    stdio: 'pipe',
  })

  await waitForServerStart(devServerProc)

  // Ensure the server remains active until the test completes.
  process.once('exit', () => {
    devServerProc.kill()
  })

  return devServerProc
}

/**
 * @param {import('node:child_process').ChildProcess} proc
 * @returns {Promise<{ code: number | null, stdout: string, stderr: string }>}
 */
function waitForExit(proc) {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    proc.stdout?.on('data', chunk => {
      stdout += chunk.toString()
    })
    proc.stderr?.on('data', chunk => {
      stderr += chunk.toString()
    })
    proc.on('error', reject)
    proc.on('close', code => {
      resolve({ code, stdout, stderr })
    })
  })
}

/**
 * @param {string} fixturePath
 */
export async function buildFixture(fixturePath) {
  const cwd = dir(fixturePath)
  console.log(`building ${cwd}`)
  const buildProc = spawn(
    process.execPath,
    [dir('node_modules/vite/bin/vite.js'), 'build'],
    { cwd, stdio: 'pipe' }
  )
  const { code, stdout, stderr } = await waitForExit(buildProc)
  if (code !== 0) {
    throw new Error(
      `vite build failed with code "${code}"\n${stdout}\n${stderr}`
    )
  }
}

/**
 * @param {import('node:child_process').ChildProcess} proc
 * @param {RegExp} pattern
 * @returns {Promise<void>}
 */
function waitForOutput(proc, pattern) {
  return new Promise((resolve, reject) => {
    function onError(err) {
      cleanup()
      reject(err)
    }

    /** @param {number | null} code */
    function onClose(code) {
      cleanup()
      reject(new Error(`Process closed unexpectedly with code "${code}"`))
    }

    let stdout = ''
    /** @param {Buffer | string} chunk */
    function onData(chunk) {
      stdout += Buffer.isBuffer(chunk)
        ? chunk.toString('utf-8')
        : chunk.toString()
      if (pattern.test(stripColors(stdout))) {
        cleanup()
        resolve()
      }
    }

    function cleanup() {
      proc.stdout?.off('data', onData)
      proc.off('error', onError)
      proc.off('close', onClose)
    }

    proc.stdout?.on('data', onData)
    proc.stderr?.on('data', onData)
    proc.on('error', onError)
    proc.on('close', onClose)
  })
}

/**
 * @param {string} fixturePath
 * @param {{ port: number, host?: string }} options
 */
export async function launchProdServer(fixturePath, options) {
  const host = options.host ?? 'localhost'
  const entry = dir(fixturePath, 'dist/server/index.js')
  console.log(`launching prod server ${entry}`)
  /** @type {import('node:child_process').ChildProcess} */
  const proc = spawn(process.execPath, [entry], {
    cwd: dir(fixturePath),
    env: {
      ...process.env,
      PORT: String(options.port),
      HOST: host,
    },
    stdio: 'pipe',
  })

  await waitForOutput(proc, /Listening on/)

  process.once('exit', () => {
    proc.kill()
  })

  return proc
}
