import { Cog, Zap } from 'lucide-react'

export default function BrandLogo({ subtitle = 'INDIA' }) {
  return (
    <>
      <span className="brand-logo-mark" aria-hidden="true">
        <Cog className="brand-logo-cog" />
        <Zap className="brand-logo-zap" />
      </span>
      <span className="brand-wordmark">
        <span className="brand-wordmark-name">EQUIPTRADE</span>
        <span className="brand-wordmark-country">{subtitle}</span>
      </span>
    </>
  )
}
