// Ingetogen merk-mark: een "plaat" met een spraak-waveform (verwijst naar de stem van
// de assistent). Kleuren volgen het designsysteem (dark/light) via CSS-klassen.
export default function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="brand-svg">
        <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="14" className="brand-plate" />
        <g className="brand-wave">
          <rect x="13.5" y="20" width="3.4" height="8" rx="1.7" />
          <rect x="20" y="15" width="3.4" height="18" rx="1.7" />
          <rect x="26.6" y="12" width="3.4" height="24" rx="1.7" />
          <rect x="33.2" y="18" width="3.4" height="12" rx="1.7" />
        </g>
      </svg>
    </span>
  );
}
