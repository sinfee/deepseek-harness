/**
 * Windows 7 has no nested Job Objects, so the shared spawn lifecycle must
 * detect those kernels and take the breakaway path. Pure version parsing --
 * runs on every platform.
 */

import { describe, expect, it } from 'vitest'

import { nestedJobsUnsupported } from '../src/index.ts'

describe('nested Job support by kernel version', () => {
  it('marks Windows 7 and older kernels as unable to nest Jobs', () => {
    expect(nestedJobsUnsupported('6.1.7601')).toBe(true)
    expect(nestedJobsUnsupported('6.0.6002')).toBe(true)
    expect(nestedJobsUnsupported('5.1.2600')).toBe(true)
  })

  it('keeps upstream behaviour on Windows 8 and newer', () => {
    expect(nestedJobsUnsupported('6.2.9200')).toBe(false)
    expect(nestedJobsUnsupported('6.3.9600')).toBe(false)
    expect(nestedJobsUnsupported('10.0.26100')).toBe(false)
  })

  it('does not claim missing nesting for unparsable release strings', () => {
    expect(nestedJobsUnsupported('')).toBe(false)
    expect(nestedJobsUnsupported('not-a-version')).toBe(false)
  })
})
