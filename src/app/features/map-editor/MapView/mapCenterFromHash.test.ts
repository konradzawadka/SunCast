import { describe, expect, it } from 'vitest'
import { buildHashWithMapCenter, parseMapCenterFromHash } from './mapCenterFromHash'

describe('parseMapCenterFromHash', () => {
  it('parses #lat and #lon hash params into [lon, lat]', () => {
    expect(parseMapCenterFromHash('#lat=52.2297&lon=21.0122')).toEqual([21.0122, 52.2297])
  })

  it('supports lng alias for longitude', () => {
    expect(parseMapCenterFromHash('#lat=40.7128&lng=-74.0060')).toEqual([-74.006, 40.7128])
  })

  it('returns null when hash misses required params', () => {
    expect(parseMapCenterFromHash('#lat=52.2297')).toBeNull()
    expect(parseMapCenterFromHash('#lon=21.0122')).toBeNull()
  })

  it('returns null for invalid numeric values', () => {
    expect(parseMapCenterFromHash('#lat=abc&lon=21')).toBeNull()
    expect(parseMapCenterFromHash('#lat=52&lon=xyz')).toBeNull()
  })

  it('returns null for out-of-range values', () => {
    expect(parseMapCenterFromHash('#lat=91&lon=21')).toBeNull()
    expect(parseMapCenterFromHash('#lat=52&lon=181')).toBeNull()
  })
})

describe('buildHashWithMapCenter', () => {
  it('sets lat/lon while preserving existing params', () => {
    expect(buildHashWithMapCenter('#c=abc&foo=bar', [21.0122, 52.2297])).toBe(
      '#c=abc&foo=bar&lat=52.229700&lon=21.012200',
    )
  })
})
