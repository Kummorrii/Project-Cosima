// A small credit fixed to the bottom center of the screen.
// Change the text here. Set LINK to a web address to make it clickable.
const TEXT = 'Built by Kummorii'
const LINK: string | null = null // for example 'https://github.com/your-name'

export default function Watermark() {
  return (
    <footer className="watermark">
      <span className="watermark-star" aria-hidden="true">
        ✦
      </span>
      {LINK ? (
        <a href={LINK} target="_blank" rel="noopener noreferrer">
          {TEXT}
        </a>
      ) : (
        <span>{TEXT}</span>
      )}
    </footer>
  )
}
