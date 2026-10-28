// 机房电脑的浏览器是 Chrome 94，补上网页用到、而 Chrome 94 没有的功能。打包目标见 vite.config.ts。
// crypto.randomUUID 只在 https 或 localhost 打开时才有，用 http 地址打开的学生也要能用。

if (typeof crypto.randomUUID !== 'function') {
  crypto.randomUUID = function () {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`
  }
}

// Chrome 98 起才有。网页里只用来复制普通数据（对象、数组、字符串、数字等），这里只实现这些
if (typeof structuredClone !== 'function') {
  const clone = (value: unknown): unknown => {
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map(clone)
    if (value instanceof Date) return new Date(value.getTime())
    if (value instanceof Map) return new Map(Array.from(value, ([k, v]) => [clone(k), clone(v)]))
    if (value instanceof Set) return new Set(Array.from(value, clone))
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(value)) result[key] = clone((value as Record<string, unknown>)[key])
    return result
  }
  globalThis.structuredClone = ((value: unknown) => clone(value)) as typeof structuredClone
}

// Chrome 97 起才有
if (!('findLastIndex' in Array.prototype)) {
  Object.defineProperty(Array.prototype, 'findLastIndex', {
    configurable: true,
    writable: true,
    value: function <T>(this: T[], predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: unknown) {
      for (let i = this.length - 1; i >= 0; i--) if (predicate.call(thisArg, this[i], i, this)) return i
      return -1
    },
  })
  Object.defineProperty(Array.prototype, 'findLast', {
    configurable: true,
    writable: true,
    value: function <T>(this: T[], predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: unknown) {
      for (let i = this.length - 1; i >= 0; i--) if (predicate.call(thisArg, this[i], i, this)) return this[i]
      return undefined
    },
  })
}
