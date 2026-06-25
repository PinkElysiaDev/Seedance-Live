import { describe, it, expect } from 'vitest'
import { getByPath, getAllByPath } from '@/lib/path'

describe('getByPath', () => {
  it('按点路径取值', () => {
    const obj = { data: { task_id: 't1' } }
    expect(getByPath(obj, 'data.task_id')).toBe('t1')
  })

  it('按下标取数组元素', () => {
    const obj = { data: { result: { videos: [{ url: 'http://a' }] } } }
    expect(getByPath(obj, 'data.result.videos[0].url')).toBe('http://a')
  })

  it('路径不存在返回 undefined', () => {
    expect(getByPath({ a: 1 }, 'b.c')).toBeUndefined()
  })

  it('null 安全', () => {
    expect(getByPath(null, 'a')).toBeUndefined()
  })
})

describe('getAllByPath', () => {
  it('展开数组取子字段', () => {
    const obj = { data: { videos: [{ url: 'a' }, { url: 'b' }] } }
    expect(getAllByPath(obj, 'data.videos.url')).toEqual(['a', 'b'])
  })

  it('非数组返回单元素数组', () => {
    expect(getAllByPath({ data: { url: 'a' } }, 'data.url')).toEqual(['a'])
  })
})
