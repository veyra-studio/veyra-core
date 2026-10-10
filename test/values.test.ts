import { describe, expect, it } from 'vitest'
import { interpolate, parseColor } from '../src/motion/values'

describe('interpolate', () => {
  it('interpolates numbers', () => {
    expect(interpolate(0, 10)(0.5)).toBe(5)
  })

  it('interpolates numbers inside strings', () => {
    const f = interpolate('inset(0% 0% 100% 0%)', 'inset(0% 0% 0% 0%)')
    expect(f(0.25)).toBe('inset(0% 0% 75% 0%)')
    expect(interpolate('blur(10px)', 'blur(0px)')(0.5)).toBe('blur(5px)')
  })

  it('gives bare numbers the unit of the other side', () => {
    expect(interpolate(0, '10vw')(0.5)).toBe('5vw')
  })

  it('mixes colors', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255, 1])
    expect(parseColor('rgb(10 20 30 / 50%)')).toEqual([10, 20, 30, 0.5])
    expect(interpolate('#000000', '#ffffff')(0)).toBe('rgb(0 0 0)')
    expect(interpolate('#000000', '#ffffff')(1)).toBe('rgb(255 255 255)')
  })

  it('switches discrete values at the end', () => {
    const f = interpolate('auto', '10px')
    expect(f(0.99)).toBe('auto')
    expect(f(1)).toBe('10px')
  })
})
