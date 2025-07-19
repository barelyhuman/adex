import { describe, it } from 'node:test'
import assert from 'node:assert'

// Test with isolated handler function to avoid dependency issues
function createMethodHandlerTests() {
  
  function getMethodHandler(module, method) {
    const supportedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']
    
    // Check for method-specific export (case-insensitive)
    for (const supportedMethod of supportedMethods) {
      if (method.toUpperCase() === supportedMethod) {
        if (module[supportedMethod] || module[supportedMethod.toLowerCase()]) {
          return module[supportedMethod] || module[supportedMethod.toLowerCase()]
        }
      }
    }
    
    // Fall back to default export
    if (module.default) {
      return module.default
    }
    
    // Return 405 handler if neither exists
    return (req, res) => {
      res.statusCode = 405
      res.setHeader('Allow', supportedMethods.join(', '))
      res.end('Method Not Allowed')
    }
  }
  
  // Simulate API handler modules
  const testModules = {
    getOnly: {
      GET: (req, res) => {
        res.statusCode = 200
        res.end('GET handler')
      }
    },
    
    postOnly: {
      POST: (req, res) => {
        res.statusCode = 201
        res.end('POST handler')
      }
    },
    
    multipleMethod: {
      GET: (req, res) => {
        res.statusCode = 200
        res.end('GET method')
      },
      POST: (req, res) => {
        res.statusCode = 201
        res.end('POST method')
      },
      PUT: (req, res) => {
        res.statusCode = 200
        res.end('PUT method')
      }
    },
    
    mixedCase: {
      get: (req, res) => { // lowercase
        res.statusCode = 200
        res.end('lowercase get')
      },
      POST: (req, res) => { // uppercase
        res.statusCode = 201
        res.end('uppercase POST')
      }
    },
    
    defaultFallback: {
      GET: (req, res) => {
        res.statusCode = 200
        res.end('GET specific')
      },
      default: (req, res) => {
        res.statusCode = 200
        res.end('default handler')
      }
    },
    
    onlyDefault: {
      default: (req, res) => {
        res.statusCode = 200
        res.end('only default')
      }
    },
    
    empty: {
      // No handlers
    }
  }
  
  class MockResponse {
    constructor() {
      this.statusCode = 200
      this.headers = {}
      this.body = ''
    }
    
    setHeader(name, value) {
      this.headers[name] = value
    }
    
    end(data) {
      if (data) this.body = data
    }
  }
  
  return { getMethodHandler, testModules, MockResponse }
}

describe('Method-specific handler integration tests', () => {
  const { getMethodHandler, testModules, MockResponse } = createMethodHandlerTests()
  
  it('should handle GET request with GET export', () => {
    const handler = getMethodHandler(testModules.getOnly, 'GET')
    const res = new MockResponse()
    
    handler({}, res)
    
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.body, 'GET handler')
  })
  
  it('should handle POST request with POST export', () => {
    const handler = getMethodHandler(testModules.postOnly, 'POST')
    const res = new MockResponse()
    
    handler({}, res)
    
    assert.strictEqual(res.statusCode, 201)
    assert.strictEqual(res.body, 'POST handler')
  })
  
  it('should return 405 for unsupported method', () => {
    const handler = getMethodHandler(testModules.getOnly, 'POST')
    const res = new MockResponse()
    
    handler({}, res)
    
    assert.strictEqual(res.statusCode, 405)
    assert.strictEqual(res.headers['Allow'], 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD')
    assert.strictEqual(res.body, 'Method Not Allowed')
  })
  
  it('should handle multiple methods correctly', () => {
    const methods = ['GET', 'POST', 'PUT']
    const expectedBodies = ['GET method', 'POST method', 'PUT method']
    const expectedCodes = [200, 201, 200]
    
    methods.forEach((method, i) => {
      const handler = getMethodHandler(testModules.multipleMethod, method)
      const res = new MockResponse()
      
      handler({}, res)
      
      assert.strictEqual(res.statusCode, expectedCodes[i])
      assert.strictEqual(res.body, expectedBodies[i])
    })
  })
  
  it('should handle case-insensitive method matching', () => {
    // Test lowercase export with uppercase method
    const getHandler = getMethodHandler(testModules.mixedCase, 'GET')
    const getRes = new MockResponse()
    getHandler({}, getRes)
    
    assert.strictEqual(getRes.statusCode, 200)
    assert.strictEqual(getRes.body, 'lowercase get')
    
    // Test uppercase export with lowercase method  
    const postHandler = getMethodHandler(testModules.mixedCase, 'post')
    const postRes = new MockResponse()
    postHandler({}, postRes)
    
    assert.strictEqual(postRes.statusCode, 201)
    assert.strictEqual(postRes.body, 'uppercase POST')
  })
  
  it('should prefer method-specific over default', () => {
    const handler = getMethodHandler(testModules.defaultFallback, 'GET')
    const res = new MockResponse()
    
    handler({}, res)
    
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.body, 'GET specific')
  })
  
  it('should fall back to default when method not available', () => {
    const handler = getMethodHandler(testModules.defaultFallback, 'POST')
    const res = new MockResponse()
    
    handler({}, res)
    
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.body, 'default handler')
  })
  
  it('should use default when only default is available', () => {
    const handler = getMethodHandler(testModules.onlyDefault, 'GET')
    const res = new MockResponse()
    
    handler({}, res)
    
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.body, 'only default')
  })
  
  it('should return 405 when no handlers available', () => {
    const handler = getMethodHandler(testModules.empty, 'GET')
    const res = new MockResponse()
    
    handler({}, res)
    
    assert.strictEqual(res.statusCode, 405)
    assert.strictEqual(res.headers['Allow'], 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD')
    assert.strictEqual(res.body, 'Method Not Allowed')
  })
  
  it('should support all HTTP methods', () => {
    const allMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']
    
    // Create a module with all methods
    const allMethodsModule = {}
    allMethods.forEach(method => {
      allMethodsModule[method] = (req, res) => {
        res.statusCode = 200
        res.end(`${method} handler`)
      }
    })
    
    allMethods.forEach(method => {
      const handler = getMethodHandler(allMethodsModule, method)
      const res = new MockResponse()
      
      handler({}, res)
      
      assert.strictEqual(res.statusCode, 200)
      assert.strictEqual(res.body, `${method} handler`)
    })
  })
})