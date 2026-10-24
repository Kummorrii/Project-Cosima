import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { loadCatalog, searchCatalog } from './catalog'
import type { CatalogEntry } from './catalog'
import { resolveObject } from './simbad'
import { useCosima } from './store'

type Row = { type: 'local'; entry: CatalogEntry } | { type: 'remote'; query: string }

type Status = { tone: 'info' | 'error'; text: string } | null

export default function SearchBar() {
  const listId = useId()
  const flyTo = useCosima((state) => state.flyTo)

  const [entries, setEntries] = useState<CatalogEntry[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [status, setStatus] = useState<Status>(null)
  const lookupId = useRef(0) // lets a newer choice cancel an older SIMBAD lookup

  useEffect(() => {
    loadCatalog()
      .then(setEntries)
      .catch((err) => {
        console.error(err)
        setStatus({
          tone: 'error',
          text: 'The star catalog failed to load. Check that public/data/stars.bin exists.',
        })
      })
  }, [])

  const rows = useMemo<Row[]>(() => {
    const text = query.trim()
    if (!text) return []
    const list: Row[] = searchCatalog(entries, text, 6).map((entry) => ({ type: 'local', entry }))
    if (text.length >= 2) list.push({ type: 'remote', query: text })
    return list
  }, [entries, query])

  const choose = async (row: Row) => {
    const id = ++lookupId.current
    setOpen(false)

    if (row.type === 'local') {
      setQuery(row.entry.name)
      setStatus(null)
      flyTo(row.entry)
      return
    }

    setStatus({ tone: 'info', text: `Looking up “${row.query}”...` })
    try {
      const found = await resolveObject(row.query)
      if (id !== lookupId.current) return
      if (!found) {
        setStatus({ tone: 'error', text: `No object named “${row.query}” found.` })
        return
      }
      setQuery(found.name)
      setStatus(null)
      flyTo(found)
    } catch (err) {
      if (id !== lookupId.current) return
      console.error(err)
      setStatus({ tone: 'error', text: 'Could not reach the lookup service. Try again in a moment.' })
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, rows.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      const row = rows[Math.min(active, rows.length - 1)]
      if (row) {
        event.preventDefault()
        void choose(row)
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const showList = open && rows.length > 0

  return (
    <div className="search">
      <input
        type="text"
        role="combobox"
        aria-label="Search the galaxy"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        placeholder="Search a star, galaxy or nebula"
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
          setOpen(true)
          setStatus(null)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />

      {showList && (
        <ul className="search-results" role="listbox" id={listId}>
          {rows.map((row, i) => (
            <li
              key={row.type === 'local' ? row.entry.id : 'remote'}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className="search-option"
              onMouseDown={(event) => event.preventDefault()} // keep focus in the input
              onMouseEnter={() => setActive(i)}
              onClick={() => void choose(row)}
            >
              <strong>
                {row.type === 'local' ? row.entry.name : `Look up “${row.query}” in SIMBAD`}
              </strong>
              <span>
                {row.type === 'local'
                  ? row.entry.subtitle
                  : 'Galaxies, nebulae, clusters and other objects'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {status && (
        <p className="search-status" data-tone={status.tone} role="status">
          {status.text}
        </p>
      )}
    </div>
  )
}
