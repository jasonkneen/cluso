/**
 * Tests for API Adapter system
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createAdapter, getAdapter, resetAdapter } from '../index'
import type { APIAdapter } from '../types'

describe('API Adapters', () => {
  beforeEach(() => {
    resetAdapter()
  })

  describe('createAdapter', () => {
    it('should create an Electron adapter', () => {
      const adapter = createAdapter('electron')
      expect(adapter.type).toBe('electron')
    })

    it('should create a Web adapter', () => {
      const adapter = createAdapter('web', 'http://localhost:3000')
      expect(adapter.type).toBe('web')
    })

    it('should throw when creating Electron adapter without electronAPI', () => {
      expect(() => createAdapter('electron')).toThrow()
    })
  })

  describe('getAdapter', () => {
    it('should return same instance on multiple calls', () => {
      resetAdapter()
      const adapter1 = getAdapter()
      const adapter2 = getAdapter()
      expect(adapter1).toBe(adapter2)
    })
  })

  describe('adapter interface', () => {
    it('should have required methods', () => {
      const adapter = createAdapter('web')
      expect(typeof adapter.invoke).toBe('function')
      expect(typeof adapter.subscribe).toBe('function')
      expect(typeof adapter.send).toBe('function')
      expect(typeof adapter.disconnect).toBe('function')
    })

    it('should have required properties', () => {
      const adapter = createAdapter('web')
      expect(adapter.type).toBeDefined()
      expect(typeof adapter.isConnected).toBe('boolean')
    })
  })

  describe('Web adapter', () => {
    it('should create instance with custom server URL', () => {
      const adapter = createAdapter('web', 'http://api.example.com')
      expect(adapter.type).toBe('web')
    })

    it('should use default URL when not provided', () => {
      const adapter = createAdapter('web')
      expect(adapter.type).toBe('web')
    })

    it('should not be connected initially', () => {
      const adapter = createAdapter('web')
      expect(adapter.isConnected).toBe(false)
    })

    it('subscribe should return unsubscribe function', () => {
      const adapter = createAdapter('web')
      const unsubscribe = adapter.subscribe('test', () => {})
      expect(typeof unsubscribe).toBe('function')
    })
  })
})
