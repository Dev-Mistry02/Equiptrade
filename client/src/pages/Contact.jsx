import { ArrowLeft, ArrowRight, Clock3, Mail, MapPin, Phone, Send } from 'lucide-react'
import { useState } from 'react'

const contactDetails = [
  {
    icon: Mail,
    label: 'Email us',
    value: 'info@equiptradeindia.com',
    href: 'mailto:info@equiptradeindia.com',
  },
  {
    icon: Phone,
    label: 'Call our team',
    value: '9274705046',
    href: 'tel:+919274705046',
  },
  {
    icon: MapPin,
    label: 'Where we work',
    value: 'Supporting businesses across India',
  },
]

export default function Contact({ navigate }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })

  const updateField = event => {
    setForm(current => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const sendMessage = event => {
    event.preventDefault()
    const subject = encodeURIComponent(form.subject || 'EquipTrade website enquiry')
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`
    )
    window.location.href = `mailto:info@equiptradeindia.com?subject=${subject}&body=${body}`
  }

  return (
    <main className="contact-page">
      <section className="contact-hero">
        <div className="container contact-hero-inner">
          <button className="contact-back" onClick={() => navigate('home')}>
            <ArrowLeft size={16} /> Back to home
          </button>
          <span className="contact-eyebrow"><Send size={14} /> We&apos;re here to help</span>
          <h1>Let&apos;s talk<br /><em>equipment.</em></h1>
          <p>Have a question about a listing, need help getting started, or want to work with us? Send us a note and our team will be glad to help.</p>
          <span className="contact-hero-gear" aria-hidden="true">⚙</span>
        </div>
      </section>

      <section className="container contact-content">
        <div className="contact-details">
          <span className="contact-section-kicker">GET IN TOUCH</span>
          <h2>Real people.<br />Straight answers.</h2>
          <p>Choose the channel that works best for you. We support buyers and sellers across India.</p>

          <div className="contact-detail-list">
            {contactDetails.map(({ icon: Icon, label, value, href }) => (
              <div className="contact-detail" key={label}>
                <span className="contact-detail-icon"><Icon size={18} /></span>
                <span>
                  <small>{label}</small>
                  {href ? <a href={href}>{value}</a> : <strong>{value}</strong>}
                </span>
                {href && <ArrowRight className="contact-detail-arrow" size={15} />}
              </div>
            ))}
          </div>

          <div className="contact-response-note">
            <Clock3 size={16} />
            <span><strong>We&apos;re listening</strong><small>Send us a message anytime and we&apos;ll get back to you as soon as we can.</small></span>
          </div>
        </div>

        <form className="contact-form" onSubmit={sendMessage}>
          <div className="contact-form-heading">
            <span className="contact-section-kicker">SEND A MESSAGE</span>
            <h2>How can we help?</h2>
            <p>Fill in the details below. Your email app will open with your message ready to send.</p>
          </div>

          <div className="contact-form-row">
            <label>
              Your name
              <input name="name" value={form.name} onChange={updateField} autoComplete="name" required placeholder="e.g. Aditi Sharma" />
            </label>
            <label>
              Email address
              <input name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" required placeholder="you@company.com" />
            </label>
          </div>

          <label>
            Subject
            <input name="subject" value={form.subject} onChange={updateField} required placeholder="What would you like help with?" />
          </label>

          <label>
            Message
            <textarea name="message" value={form.message} onChange={updateField} required rows={5} maxLength={3000} placeholder="Tell us a little about your question..." />
          </label>

          <button className="contact-submit" type="submit">
            Continue to email <ArrowRight size={16} />
          </button>
          <span className="contact-form-footnote"><Mail size={13} /> Opens your email app to send the message to info@equiptradeindia.com</span>
        </form>
      </section>

      <section className="contact-bottom">
        <div className="container">
          <span>Looking for equipment instead?</span>
          <button onClick={() => navigate('browse')}>Explore the marketplace <ArrowRight size={15} /></button>
        </div>
      </section>
    </main>
  )
}
