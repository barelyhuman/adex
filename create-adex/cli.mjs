#!/usr/bin/env node

import StreamZip from 'node-stream-zip'
import { createWriteStream, existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { parseArgs } from 'node:util'
import { finished } from 'stream/promises'
import k from 'kleur'

const TMP_FOLDER_PREFIX = '.create-adex'
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
  const { help } = flags.values
  const targetDir = flags.positionals[0] ?? '.'

  if (help) {
    showHelp()
    return
  }

  if (await isDirectoryNotEmpty(targetDir)) {
    console.log(
      `${failure(`[FAIL]`)} ${k.bold(targetDir)} is not empty, aborting initialization`
    )
    return
  }

  console.log(info(`Initializing in ${targetDir}`))
  const selectedTemplate = TEMPLATES.default
  const targetFilePath = await downloadFile(
    selectedTemplate.link,
    'adex-template.zip'
  )

  const unzipStream = new StreamZip.async({ file: targetFilePath })
  const entries = await unzipStream.entries()

  const files = await extractFiles(entries, unzipStream)
  await copyFiles(files, targetDir, selectedTemplate)

  await rm(TMP_FOLDER_PREFIX, { recursive: true })

  console.log(`\nNext Steps\n$ cd ${targetDir}\n$ npm i`)
  console.log(success('\nDone!\n'))
}

function showHelp() {
  console.log(`
${k.gray('[USAGE]')}

    $ adex [flags] [args]

${k.gray('[FLAGS]')}

    --help,-h                     Show this help
    --init PATH                   Initialize a new adex project at PATH (${k.gray('default: ./')})
  `)
}

async function isDirectoryNotEmpty(targetDir) {
  if (existsSync(targetDir)) {
    const entries = await readdir(targetDir)
    return entries.filter(d => d !== '.tmp').length > 0
  }
  return false
}

async function downloadFile(url, fileName) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`)

    if (!existsSync(TMP_FOLDER_PREFIX)) await mkdir(TMP_FOLDER_PREFIX)
    const destination = resolve(TMP_FOLDER_PREFIX, fileName)
    if (existsSync(destination)) {
      await rm(destination, { recursive: true })
    }

    const fileStream = createWriteStream(destination, { flags: 'wx' })
    await finished(Readable.fromWeb(res.body).pipe(fileStream))
    return destination
  } catch (err) {
    console.error(failure(`[FAIL] Download: ${err.message}`))
    process.exit(1)
  }
}

async function extractFiles(entries, unzipStream) {
  const files = await Promise.all(
    Object.values(entries).map(async entry => {
      const outFile = join(TMP_FOLDER_PREFIX, 'out', entry.name)
      await mkdir(dirname(outFile), { recursive: true })
      await unzipStream.extract(entry, outFile)
      if (entry.isFile) {
        return outFile
      }
    })
  )
  return files.filter(Boolean)
}

async function copyFiles(files, targetDir, selectedTemplate) {
  const copyPromises = files.map(d => {
    const absolutePath = resolve(d)
    const dest = absolutePath.replace(
      join(
        process.cwd(),
        TMP_FOLDER_PREFIX,
        'out',
        `${selectedTemplate.name}-${selectedTemplate.branch}`
      ),
      resolve(targetDir)
    )
    return copyFileWithLogging(absolutePath, dest)
  })

  await Promise.allSettled(copyPromises)
}

async function copyFileWithLogging(source, dest) {
  try {
    await mkdir(dirname(dest), { recursive: true })
    await copyFile(source, dest)
    console.log(`${k.gray('[Created]')} ${k.white(dest)}`)
  } catch (err) {
    console.log(failure(`[FAIL] Creation: ${dest}, ${err.message}`))
  }
}
