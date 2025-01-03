#!/usr/bin/env node

import StreamZip from 'node-stream-zip'
import { createWriteStream, existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { parseArgs } from 'node:util'
import { finished } from 'stream/promises'
import k from 'kleur'

const TMP_FOLDER_PREFX = '.create-adex'
const info = k.cyan
const success = k.green
const failure = k.red

const TEMPLATES = {
  default: {
    name: 'adex-default-template',
    link: 'https://github.com/barelyhuman/adex-default-template/archive/refs/heads/main.zip',
    branch: 'main',
  },
}

const flags = parseArgs({
  allowPositionals: true,
  options: {
    help: {
      short: 'h',
      type: 'boolean',
      default: false,
    },
  },
})

await main()

async function main() {
  const { init, help } = flags.values
  const targetDir = flags.positionals[0] ?? '.'

  if (help) {
    console.log(`
${k.gray('[USAGE]')}

    $ adex [flags] [args]

${k.gray('[FLAGS]')}

    --help,-h                     Show this help
    --init PATH   Initialise a new adex project at PATH (${k.gray('default: ./')})

    `)
    return
  }

  if (existsSync(targetDir)) {
    const entries = await readdir(targetDir)
    if (entries.filter(d => d != '.tmp').length) {
      console.log(
        `${failure(`[FAIL]`)} ${k.bold(targetDir)} is not empty, aborting initialisation`
      )
      return
    }
  }
  console.log(info(`Initializing in ${targetDir}`))
  const selectedTemplate = TEMPLATES.default
  const targetFilePath = await downloadFile(
    selectedTemplate.link,
    'adex-template.zip'
  )

  const unzipStream = new StreamZip.async({
    file: targetFilePath,
  })

  const entries = await unzipStream.entries()

  const files = (
    await Promise.all(
      Object.values(entries).map(async entry => {
        const outFile = join(TMP_FOLDER_PREFX, 'out', entry.name)
        await mkdir(dirname(outFile), { recursive: true })
        await unzipStream.extract(entry, outFile)
        if (entry.isFile) {
          return outFile
        }
      })
    )
  ).filter(Boolean)

  await Promise.allSettled(
    files
      .map(d => {
        const absolutePath = resolve(d)
        return {
          source: absolutePath,
          dest: absolutePath.replace(
            join(
              process.cwd(),
              TMP_FOLDER_PREFX,
              'out',
              selectedTemplate.name + '-' + selectedTemplate.branch
            ),
            resolve(targetDir)
          ),
        }
      })
      .map(async d => {
        try {
          await mkdir(dirname(d.dest), { recursive: true })
          await copyFile(d.source, d.dest)
          console.log(`${k.gray('[Created]')} ${k.white(d.dest)}`)
        } catch (err) {
          console.log(failure(`[FAIL] Creation: ${d.dest}, ${err.message}`))
        }
      })
  )

  rm(TMP_FOLDER_PREFX, { recursive: true })

  console.log(
    `\nNext Steps\n
$ cd ${targetDir}
$ npm i`
  )
  console.log(success('\nDone!\n'))

  return
}

async function downloadFile(url, fileName) {
  const res = await fetch(url)
  if (!existsSync(TMP_FOLDER_PREFX)) await mkdir(TMP_FOLDER_PREFX)
  const destination = resolve(TMP_FOLDER_PREFX, fileName)
  if (existsSync(destination)) {
    await rm(destination, { recursive: true })
  }
  const fileStream = createWriteStream(destination, { flags: 'wx' })
  // @ts-expect-error , supports the input but readable needs to be fixed for the same
  await finished(Readable.fromWeb(res.body).pipe(fileStream))
  return destination
}
