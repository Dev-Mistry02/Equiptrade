import { ArrowRight, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'

export default function Footer({ navigate, notify }) {
  return <footer className="site-footer">
    <div className="container footer-grid">
      <div className="footer-intro">
        <button className="brand footer-brand" onClick={() => navigate('home')} aria-label="EquipTrade India home"><span className="brand-mark"><ShieldCheck size={19} /></span><span>equip<span>trade</span><small>INDIA</small></span></button>
        <p>India's trusted marketplace for verified industrial equipment, machinery and business vehicles.</p>
        <span className="footer-trust"><ShieldCheck size={15} /> Human-reviewed listings</span>
      </div>
      <div className="footer-links">
        <strong>Marketplace</strong>
        <button onClick={() => navigate('browse')}>Buy equipment <ArrowRight size={14} /></button>
        <button onClick={() => navigate('sell')}>Sell equipment <ArrowRight size={14} /></button>
        <button onClick={() => notify('Our equipment specialists are here to help.')}>Contact support <ArrowRight size={14} /></button>
      </div>
      <div className="footer-contact">
        <strong>Get in touch</strong>
        <a href="mailto:hello@equiptrade.in"><Mail size={15} /> hello@equiptrade.in</a>
        <a href="tel:+919876543210"><Phone size={15} /> +91 98765 43210</a>
        <span><MapPin size={15} /> Pan-India network</span>
      </div>
    </div>
    <div className="container footer-bottom"><span>© {new Date().getFullYear()} EquipTrade India. All rights reserved.</span><span>Built for confident decisions.</span></div>
  </footer>
}
