import { KIVO_BRAND } from '../brand/kivo';

interface LogoProps {
  height?: number;
  showText?: boolean;
}

export default function Logo({ height = 28, showText = true }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src={showText ? KIVO_BRAND.assets.markWhite : KIVO_BRAND.assets.markSvg}
        alt={KIVO_BRAND.company}
        style={{ height, width: 'auto' }}
        className="object-contain"
      />
      {showText && (
        <div>
          <p className="text-base font-bold text-brand-text tracking-tight leading-none">{KIVO_BRAND.company}</p>
          <p className="text-[10px] text-brand-muted leading-none mt-0.5">OS</p>
        </div>
      )}
    </div>
  );
}
