import Image from "next/image";

export function BrandMark({ className = "size-10", eager = false, alt = "" }: { className?: string; eager?: boolean; alt?: string }) {
  return <Image data-testid="insureflow-logo" src="/brand/insureflow-mark.webp" alt={alt} width={512} height={512} loading={eager ? "eager" : "lazy"} className={`shrink-0 object-contain ${className}`} sizes="(max-width: 640px) 40px, 48px" />;
}

export function BrandLockup({ compactOnMobile = false, className = "", markClassName = "size-10", wordmarkClassName = "text-xl", eager = false }: { compactOnMobile?: boolean; className?: string; markClassName?: string; wordmarkClassName?: string; eager?: boolean }) {
  return <span className={`inline-flex items-center gap-2.5 ${className}`}><BrandMark className={markClassName} eager={eager} /><span className={`${compactOnMobile ? "hidden min-[390px]:inline" : ""} ${wordmarkClassName} font-bold tracking-[-0.035em] text-[var(--brand-navy)]`}>InsureFlow</span></span>;
}
