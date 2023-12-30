#!/usr/bin/env node
import gittar from 'gittar'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import ora from 'ora'

const CLI_MESSAGES = {
  BOOT: () => 'Starting Adex Template Engine...',
  CLONING: () => 'Downloading `default` template',
  EXTRACTING: location => `Extracting to: ${location}`,
}

const ERROR_TYPES = {
  UNKNOWN: 'Unknown',
  CREATION: 'Failed to Create',
}

class AdexCLIError extends Error {
  type
  constructor(errType, errMessage) {
    super(errMessage)
    this.type = errType
  }
}

const templates = {
  default: 'barelyhuman/adex-default-template',
}

const spinner = ora(CLI_MESSAGES.BOOT()).start()
try {
  const projectName = process.argv.slice(2)[0] || 'new-adex-project'
  const targetPath = join(process.cwd(), projectName)
  if (existsSync(targetPath)) {
    throw new AdexCLIError(
      ERROR_TYPES.CREATION,
      `Project folder with the name ${projectName} already exists`
    )
  }
  spinner.text = CLI_MESSAGES.CLONING()
  const pkg = await gittar.fetch(templates.default)
  spinner.text = CLI_MESSAGES.EXTRACTING()
  await gittar.extract(pkg, targetPath)
  spinner.text = 'DONE!'
  spinner.succeed()
} catch (err) {
  if (err instanceof AdexCLIError && err.type == ERROR_TYPES.CREATION) {
    spinner.fail(err.message || 'Oops! Something went wrong...')
  } else {
    writeFileSync('adex.error.log', err.stack)
  }
}
