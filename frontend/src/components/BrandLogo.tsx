export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <div
      className={`select-none text-[20px] font-black uppercase tracking-tight text-white [text-shadow:1px_0_0_#2563eb,-1px_0_0_#f43f5e,0_1px_0_#ffffff] ${className}`}
    >
      MYCHAT
    </div>
  );
}
