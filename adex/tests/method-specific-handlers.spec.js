import { describe, it } from 'node:test'
import assert from 'node:assert'

// Test the method dispatch logic separately
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

describe('Method-specific API handler dispatch logic', () => {
  
  it('should use GET method-specific export', () => {
    const module = {
      GET: (req, res) => 'GET handler',
      POST: (req, res) => 'POST handler'
    }
    
    const handler = getMethodHandler(module, 'GET')
    assert.strictEqual(handler.name, module.GET.name)
  })
  
  it('should use POST method-specific export', () => {
    const module = {
      GET: (req, res) => 'GET handler',
      POST: (req, res) => 'POST handler'
    }
    
    const handler = getMethodHandler(module, 'POST')
    assert.strictEqual(handler.name, module.POST.name)
  })
  
  it('should handle case-insensitive method matching', () => {
    const module = {
      put: (req, res) => 'PUT handler' // lowercase export
    }
    
    const handler = getMethodHandler(module, 'PUT')
    assert.strictEqual(handler, module.put)
  })
  
  it('should fall back to default export when method export not found', () => {
    const module = {
      default: (req, res) => 'Default handler'
    }
    
    const handler = getMethodHandler(module, 'GET')
    assert.strictEqual(handler, module.default)
  })
  
  it('should prefer method-specific export over default', () => {
    const module = {
      GET: (req, res) => 'GET specific',
      default: (req, res) => 'Default handler'
    }
    
    const handler = getMethodHandler(module, 'GET')
    assert.strictEqual(handler, module.GET)
  })
  
  it('should fall back to default when method not found but default exists', () => {
    const module = {
      GET: (req, res) => 'GET handler',
      default: (req, res) => 'Default handler'
    }
    
    const handler = getMethodHandler(module, 'DELETE')
    assert.strictEqual(handler, module.default)
  })
  
  it('should return 405 handler when neither method nor default export exists', () => {
    const module = {
      // No handlers
    }
    
    // Mock response object
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[name] = value },
      end(data) { this.endData = data }
    }
    
    const handler = getMethodHandler(module, 'GET')
    handler({}, res)
    
    assert.strictEqual(res.statusCode, 405)
    assert.strictEqual(res.headers['Allow'], 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD')
    assert.strictEqual(res.endData, 'Method Not Allowed')
  })
  
  it('should support all HTTP methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']
    
    methods.forEach(method => {
      const module = {
        [method]: () => `${method} handler`
      }
      
      const handler = getMethodHandler(module, method)
      assert.strictEqual(handler, module[method])
    })
  })
})