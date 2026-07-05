interface LogoProps {
  size?: number;
  showText?: boolean;
}

export default function Logo({ size = 32, showText = true }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="10" fill="#FCB900" />
        <path d="M12 28V12H16.5L22 21.5L27.5 12H32V28H27.5V18.5L22.5 27.5H21.5L16.5 18.5V28H12Z" fill="#171414" />
      </svg>
      {showText && (
        <div>
          <p className="text-base font-bold text-brand-text tracking-tight leading-none">TDS</p>
          <p className="text-[10px] text-brand-muted leading-none mt-0.5">Geo</p>
        </div>
      )}
    </div>
  );
}
