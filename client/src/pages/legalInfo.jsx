import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react'

const legalSections = [
  {
    title: 'Marketplace role & Limitation of Liability',
    text: 'EquipTrade India operates solely as an intermediary and machinery listing platform, connecting buyers and sellers. The platform does not independently verify ownership documents, machinery condition, fitness, operating hours, outstanding liabilities, or other claims made by sellers. Buyers are responsible for conducting their own due diligence, verifying ownership and relevant documents, and physically inspecting machinery before making any payment or entering into a transaction. EquipTrade India does not guarantee the accuracy, completeness, quality, ownership, or condition of any listed machinery.',
  },
  {
    title: 'Listing review',
    text: 'A listing marked as reviewed has passed the platform’s submission review. This is not an independent inspection, certification, warranty, or guarantee of the equipment’s condition, ownership, or suitability.',
  },
  {
    title: 'Payment & Commercial Transactions',
    text: 'EquipTrade India does not collect advance payments, provide escrow services, or guarantee the safety of token payments. All payments, GST invoices, and logistics agreements are handled directly between the buyer and seller. Both parties are responsible for verifying payment terms and completing transactions securely.',
  },
  {
    title: 'Information and enquiries',
    text: 'Information you submit is used to provide marketplace features, respond to enquiries, and support account or listing review. Share only information needed for your enquiry and verify a seller and equipment before arranging payment or collection.',
  },
]

export default function LegalInfo({ navigate }) {
  return (
    <main className="info-page legal-page">
      <section className="legal-hero">
        <div className="container legal-hero-content">
          <button className="legal-back" onClick={() => navigate('home')}>
            <ArrowLeft size={16} /> Back to home
          </button>
          <span className="info-eyebrow"><FileText size={15} /> Platform information</span>
          <h1>Legal Info</h1>
          <p>Clear guidance about how the EquipTrade marketplace works and what to keep in mind when using it.</p>
          <span className="legal-hero-gear" aria-hidden="true">⚙</span>
        </div>
      </section>

      <section className="container legal-content">
        <aside className="legal-notice">
          <ShieldCheck size={20} />
          <p>This page is a general summary for marketplace users, not legal advice or a substitute for a formal agreement.</p>
        </aside>
        <div className="legal-section-list">
          {legalSections.map(({ title, text }, index) => (
            <article className="legal-section" key={title}>
              <span className="legal-section-number">0{index + 1}</span>
              <div className="legal-section-copy">
                <span className="legal-section-kicker">Marketplace guidance</span>
                <h2>{title}</h2>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="legal-contact">
          <div>
            <span className="legal-contact-eyebrow">Need help?</span>
            <h2>Questions about using the platform ?</h2>
          </div>
          <a href="mailto:info@equiptradeindia.com">Contact EquipTrade <ArrowLeft size={16} /></a>
        </div>
      </section>
    </main>
  )
}
