import { ArrowRight, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'
import BrandLogo from './BrandLogo'

export default function Footer({ navigate, notify }) {
  return <footer className="site-footer">
    <div className="container footer-grid">
      <div className="footer-intro">
        <button className="brand footer-brand" onClick={() => navigate('home')} aria-label="EquipTrade India home"><BrandLogo /></button>
        <p>India's marketplace for industrial equipment, surplus spares, machinery and business vehicles.</p>
        <span className="footer-trust"><ShieldCheck size={15} /> Human-reviewed listings</span>
      </div>
      <div className="footer-links">
        <strong>Explore</strong>
        <button onClick={() => navigate('browse')}>Buy equipment <ArrowRight size={14} /></button>
        <button onClick={() => navigate('sell')}>Sell equipment <ArrowRight size={14} /></button>
        <button onClick={() => navigate('about')}>About EquipTrade <ArrowRight size={14} /></button>
        <button onClick={() => navigate('legal-info')}>Legal Info <ArrowRight size={14} /></button>
        <button onClick={() => navigate('contact')}>Contact support <ArrowRight size={14} /></button>
      </div>
      <div className="footer-contact">
        <strong>Get in touch</strong>
        <a href="mailto:info@equiptradeindia.com"><Mail size={15} /> info@equiptradeindia.com</a>
        <a href="tel:+919274705046"><Phone size={15} /> 9274705046</a>
        <span><MapPin size={15} /> Pan-India network</span>
      </div>
    </div>
    <div className="container footer-bottom"><span>© {new Date().getFullYear()} EquipTrade India. All rights reserved.</span><span>Built for confident decisions.</span></div>
  </footer>
}
