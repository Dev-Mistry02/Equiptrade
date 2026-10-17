import { ArrowLeft, ArrowRight, Clock3, LoaderCircle, Mail, MapPin, Phone, Send } from 'lucide-react'
import { useRef, useState } from 'react'
import { api } from '../api'

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
    phone: '',
    company: '',
    subject: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const requestKey = useRef(crypto.randomUUID())
  const submissionInProgress = useRef(false)

  const updateField = event => {
    setError('')
    setSuccess('')
    setForm(current => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const sendMessage = async event => {
    event.preventDefault()
    if (submissionInProgress.current) return

    const name = form.name.trim()
    const email = form.email.trim()
    const subject = form.subject.trim()
    const message = form.message.trim()
    const phone = form.phone.trim()

    if (!name || !email || !subject || !message) {
      setError('Please complete your name, email address, subject, and message.')
      return
    }
    if (phone && !/^[+()\d\s.-]{7,30}$/.test(phone)) {
      setError('Enter a valid phone number or leave the field blank.')
      return
    }

    setSubmitting(true)
    submissionInProgress.current = true
    setError('')
    setSuccess('')
    try {
      const result = await api.submitContactEnquiry({
        ...form,
        name,
        email,
        phone,
        subject,
        message,
      }, requestKey.current)
      setSuccess(`${result.message} Enquiry ID: ${result.leadId}`)
      setForm({ name: '', email: '', phone: '', company: '', subject: '', message: '' })
      requestKey.current = crypto.randomUUID()
    } catch (requestError) {
      console.error('Failed to submit contact enquiry:', requestError)
      setError(requestError.message || 'We could not submit your enquiry. Please try again.')
    } finally {
      setSubmitting(false)
      submissionInProgress.current = false
    }
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
            <p>Share a few details and our team will follow up with you.</p>
          </div>

          <div className="contact-form-row">
            <label>
              Full name
              <input name="name" value={form.name} onChange={updateField} autoComplete="name" maxLength={120} required placeholder="e.g. Aditi Sharma" />
            </label>
            <label>
              Email address
              <input name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" required placeholder="you@company.com" />
            </label>
          </div>

          <div className="contact-form-row">
            <label>
              Phone number (optional)
              <input name="phone" type="tel" value={form.phone} onChange={updateField} autoComplete="tel" maxLength={30} placeholder="+91 98765 43210" />
            </label>
            <label>
              Company name (optional)
              <input name="company" value={form.company} onChange={updateField} autoComplete="organization" maxLength={160} placeholder="Your company" />
            </label>
          </div>

          <label>
            Enquiry subject or equipment of interest
            <input name="subject" value={form.subject} onChange={updateField} maxLength={200} required placeholder="e.g. 500 kVA DG set or surplus spares" />
          </label>

          <label>
            Message
            <textarea name="message" value={form.message} onChange={updateField} required rows={5} maxLength={3000} placeholder="Tell us a little about your question..." />
          </label>

          {error && <p className="contact-form-error" role="alert">{error}</p>}
          {success && <p className="contact-form-success" role="status">{success}</p>}
          <button className="contact-submit" type="submit" disabled={submitting}>
            {submitting ? <><LoaderCircle className="action-spinner" size={16} /> Submitting…</> : <>Submit enquiry <ArrowRight size={16} /></>}
          </button>
          <span className="contact-form-footnote"><Mail size={13} /> Your message is sent securely to the EquipTrade India team.</span>
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
