import { useEffect, useState } from 'react'
import { constellationName } from './constellations'
import { formatDec, formatDistance, formatRa } from './destinations'
import type { Destination, DestinationKind } from './destinations'
import { IMAGE_HEIGHT, IMAGE_WIDTH, SURVEYS, aladinUrl, skyImageUrl } from './skyImage'
import { useCosima } from './store'
import { fetchSummary, wikipediaCandidates } from './wikipedia'
import type { WikiSummary } from './wikipedia'

const KIND_LABEL: Record<DestinationKind, string> = {
  place: 'Place',
  star: 'Star',
  galaxy: 'Galaxy',
  nebula: 'Nebula',
  cluster: 'Cluster',
  object: 'Object',
}

type WikiState = { status: 'loading' } | { status: 'none' } | { status: 'done'; summary: WikiSummary }
type ImageState = 'loading' | 'ready' | 'error'

function PanelBody({ destination, onClose }: { destination: Destination; onClose: () => void }) {
  const details = destination.details
  const hasSky = details?.raDeg !== undefined && details?.decDeg !== undefined

  const [surveyIndex, setSurveyIndex] = useState(0)
  const [imageState, setImageState] = useState<ImageState>('loading')
  const [wiki, setWiki] = useState<WikiState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    fetchSummary(wikipediaCandidates(destination), controller.signal)
      .then((summary) => setWiki(summary ? { status: 'done', summary } : { status: 'none' }))
      .catch((err) => {
        if (controller.signal.aborted) return
        console.warn('Could not load the Wikipedia summary:', err)
        setWiki({ status: 'none' })
      })
    return () => controller.abort()
  }, [destination])

  // Facts, in reading order. Only rows we actually have data for are shown.
  const facts: [string, string][] = [['Type', details?.typeLabel ?? KIND_LABEL[destination.kind]]]
  if (details?.distancePc !== undefined) {
    facts.push(['Distance', formatDistance(details.distancePc)])
  } else if (destination.id.startsWith('simbad:')) {
    facts.push(['Distance', 'Not on record'])
  }
  if (details?.extraFacts) facts.push(...details.extraFacts)
  if (details?.constellation) facts.push(['Constellation', constellationName(details.constellation)])
  if (details?.spectralClass) facts.push(['Spectral class', details.spectralClass])
  if (details?.magnitude !== undefined) {
    facts.push(['Apparent magnitude', details.magnitude.toFixed(2)])
  }
  if (details?.raDeg !== undefined && details?.decDeg !== undefined) {
    facts.push(['Right ascension', formatRa(details.raDeg)])
    facts.push(['Declination', formatDec(details.decDeg)])
  }

  const survey = SURVEYS[surveyIndex]
  const fov = details?.fovDeg ?? 0.5
  const imageUrl = hasSky ? skyImageUrl(survey.id, details.raDeg!, details.decDeg!, fov) : null

  const chooseSurvey = (index: number) => {
    if (index === surveyIndex) return
    setSurveyIndex(index)
    setImageState('loading')
  }

  return (
    <>
      <header className="panel-header">
        <div>
          <span className="panel-kind">{KIND_LABEL[destination.kind]}</span>
          <h2>{destination.name}</h2>
          <p>{destination.subtitle}</p>
        </div>
        <button type="button" className="panel-close" onClick={onClose} aria-label="Close details">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="panel-body">
        {imageUrl && (
          <section aria-label="Sky image">
            <div
              className="sky-frame"
              style={{ aspectRatio: `${IMAGE_WIDTH} / ${IMAGE_HEIGHT}` }}
              data-state={imageState}
            >
              <img
                key={imageUrl}
                src={imageUrl}
                alt={`${destination.name} in ${survey.label.toLowerCase()} light`}
                onLoad={() => setImageState('ready')}
                onError={() => setImageState('error')}
              />
              {imageState === 'loading' && <span className="sky-note">Loading sky image...</span>}
              {imageState === 'error' && <span className="sky-note">Sky image unavailable</span>}
            </div>
            <div className="sky-tabs" role="group" aria-label="Wavelength">
              {SURVEYS.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={i === surveyIndex}
                  onClick={() => chooseSurvey(i)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="panel-credit">
              {survey.credit}, via CDS. Field of view {fov < 1 ? `${Math.round(fov * 60)}′` : `${fov.toFixed(1)}°`}.
            </p>
          </section>
        )}

        <section aria-label="Facts">
          <dl className="facts">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-label="About">
          {wiki.status === 'loading' && <p className="panel-muted">Loading description...</p>}
          {wiki.status === 'none' && <p className="panel-muted">No description found.</p>}
          {wiki.status === 'done' && (
            <>
              <p className="panel-about">{wiki.summary.extract}</p>
              <p className="panel-credit">
                From{' '}
                <a href={wiki.summary.url} target="_blank" rel="noopener noreferrer">
                  Wikipedia
                </a>
                , CC BY-SA 4.0.
              </p>
            </>
          )}
        </section>

        {hasSky && (
          <footer className="panel-links">
            <a
              href={aladinUrl(survey.id, details.raDeg!, details.decDeg!, fov)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Aladin Lite
            </a>
            <a
              href={`https://simbad.cds.unistra.fr/simbad/sim-basic?Ident=${encodeURIComponent(
                details.mainId ?? destination.name,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View in SIMBAD
            </a>
          </footer>
        )}
      </div>
    </>
  )
}

export default function DetailPanel() {
  const shown = useCosima((state) => state.shown)
  const open = useCosima((state) => state.panelOpen && state.phase === 'arrived')
  const closePanel = useCosima((state) => state.closePanel)

  // Escape closes the panel, unless a dialog (such as today's picture) is open and
  // already handling the key.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closePanel])

  return (
    <aside className="panel" data-open={open} aria-hidden={!open} aria-label="Object details">
      {shown && <PanelBody key={shown.id} destination={shown} onClose={closePanel} />}
    </aside>
  )
}
