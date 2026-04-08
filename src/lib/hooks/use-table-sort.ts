'use client'

import { useState } from 'react'

type SortDir = 'asc' | 'desc'

export function useTableSort<T>(data: T[]) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortKey(null); setSortDir('asc') }
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function sortData(getters: Record<string, (item: T) => string | number>): T[] {
    if (!sortKey || !getters[sortKey]) return data
    const getter = getters[sortKey]
    return [...data].sort((a, b) => {
      const va = getter(a)
      const vb = getter(b)
      let cmp: number
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb
      } else {
        cmp = String(va).localeCompare(String(vb))
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
  }

  return { sortKey, sortDir, handleSort, sortData }
}
