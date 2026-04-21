/**
 * Creates a virtual module that can be imported in Vite
 *
 * @param {string} id - The module ID
 * @param {string} content - The module content
 * @returns {import("vite").Plugin}
 */
export function createVirtualModule(id, content) {
  return {
    name: `adex-virtual-${id}`,
    enforce: 'pre',
    resolveId(requestId) {
      if (requestId === id || requestId === '/' + id) {
        return `\0${id}`
      }
    },
    load(requestId) {
      if (requestId === `\0${id}`) {
        return content
      }
    },
  }
}

/**
 * Creates a virtual module that can fall back to a user-provided file
 *
 * @param {string} id - The virtual module ID
 * @param {string} content - The default content if user file doesn't exist
 * @param {string} userPath - The path to the user file
 * @returns {import("vite").Plugin}
 */
export function createUserDefaultVirtualModule(id, content, userPath) {
  return {
    name: `adex-virtual-user-default-${id}`,
    enforce: 'pre',
    async resolveId(requestId) {
      if (
        requestId === id ||
        requestId === '/' + id ||
        requestId === userPath
      ) {
        const userPathResolved = await this.resolve(userPath)
        return userPathResolved ?? `\0${id}`
      }
    },
    load(requestId) {
      if (requestId === `\0${id}`) {
        return content
      }
    },
  }
}
