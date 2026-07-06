interface LogoProps {
  height?: number;
  showText?: boolean;
}

export default function Logo({ height = 28, showText = true }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/assets/White Swype.png"
        alt="Swype"
        style={{ height, width: 'auto' }}
        className="object-contain"
      />
      {showText && (
        <div>
          <p className="text-base font-bold text-brand-text tracking-tight leading-none">TDS</p>
          <p className="text-[10px] text-brand-muted leading-none mt-0.5">Geo</p>
        </div>
      )}
    </div>
  );
}
