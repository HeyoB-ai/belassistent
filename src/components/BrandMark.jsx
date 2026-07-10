import Icon from './Icon.jsx';

// Merk-mark: blauwe (gradient) squircle met een call-icoon. Icoon-gedreven, fris.
export default function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <Icon name="phone-call" size={24} strokeWidth={2} />
    </span>
  );
}
