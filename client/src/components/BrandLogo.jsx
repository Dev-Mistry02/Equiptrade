import { Cog, Zap } from 'lucide-react'

export function BrandLogoMark() {
  return (
    <span className="brand-logo-mark" aria-hidden="true">
      <Cog className="brand-logo-cog" />
      <Zap className="brand-logo-zap" />
    </span>
  )
}

export default function BrandLogo({ subtitle = 'INDIA' }) {
  return (
    <>
      <BrandLogoMark />
      <span className="brand-wordmark">
        <span className="brand-wordmark-name">EQUIPTRADE</span>
        <span className="brand-wordmark-country">{subtitle}</span>
      </span>
    </>
  )
}
