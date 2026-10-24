import { useEffect, useRef, useState } from 'react'
import { ApodError, fetchApod, formatApodDate } from './apod'
import type { Apod } from './apod'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; apod: Apod }

type Props = { open: boolean; onClose: () => void }

export default function ApodDialog({ open, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [imageFailed, setImageFailed] = useState(false)
  const [useFallbackImage, setUseFallbackImage] = useState(false)

  // Keep the native dialog in step with the `open` prop. showModal() traps focus
  // and closes on Escape, and the browser returns focus to the button afterwards.
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  // Load the picture when the dialog opens (and again after "Try again").
  useEffect(() => {
    if (!open) return
    let ignore = false

    fetchApod()
      .then((apod) => {
        if (!ignore) setState({ status: 'ready', apod })
      })
      .catch((err) => {
        if (ignore) return
        console.warn('Could not load the Astronomy Picture of the Day:', err)
        const message =
          err instanceof ApodError
            ? err.message
            : 'Could not reach NASA. Check your connection and try again.'
        setState({ status: 'error', message })
      })

    return () => {
      ignore = true
    }
  }, [open, attempt])

  const retry = () => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  const apod = state.status === 'ready' ? state.apod : null
  const mediaUrl = !apod
    ? null
    : apod.mediaType === 'video'
      ? apod.thumbnailUrl
      : useFallbackImage && apod.fallbackUrl
        ? apod.fallbackUrl
        : apod.url

  return (
    <dialog
      ref={dialog}
      className="apod"
      aria-labelledby="apod-heading"
      onClose={onClose}
      onClick={(event) => {
        // A click on the dimmed backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <header className="apod-header">
        <div>
          <span className="panel-kind">
            {apod?.source === 'library' ? 'NASA space picture' : 'Astronomy Picture of the Day'}
          </span>
          {apod && <span className="apod-date">{formatApodDate(apod.date)}</span>}
        </div>
        <button type="button" className="panel-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="apod-scroll">
        {state.status === 'loading' && <p className="apod-message">Loading today’s picture...</p>}

        {state.status === 'error' && (
          <div className="apod-message">
            <p>{state.message}</p>
            <button type="button" className="apod-retry" onClick={retry}>
              Try again
            </button>
          </div>
        )}

        {apod && (
          <>
            <div className="apod-media">
              {mediaUrl && !imageFailed ? (
                <img
                  src={mediaUrl}
                  alt={apod.title}
                  onError={() => {
                    // Try the smaller version once before giving up.
                    if (apod.fallbackUrl && !useFallbackImage) setUseFallbackImage(true)
                    else setImageFailed(true)
                  }}
                />
              ) : (
                <p className="apod-message">
                  {apod.mediaType === 'video' ? 'Today’s entry is a video.' : 'The image could not be loaded.'}
                </p>
              )}
            </div>

            <div className="apod-text">
              {apod.note && <p className="apod-note">{apod.note}</p>}
              <h2 id="apod-heading">{apod.title}</h2>
              {apod.copyright && <p className="panel-credit">Image credit: {apod.copyright}</p>}
              <p className="apod-explanation">{apod.explanation}</p>

              <div className="panel-links">
                {apod.mediaType === 'video' && (
                  <a href={apod.url} target="_blank" rel="noopener noreferrer">
                    Watch the video
                  </a>
                )}
                {apod.hdUrl && (
                  <a href={apod.hdUrl} target="_blank" rel="noopener noreferrer">
                    View full resolution
                  </a>
                )}
                <a href={apod.pageUrl} target="_blank" rel="noopener noreferrer">
                  {apod.source === 'library' ? 'View in NASA Image Library' : 'View on NASA'}
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}
