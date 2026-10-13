import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import BrandLogo from '../components/BrandLogo'

export default function Verification({
  step,
  data,
  setData,
  otp,
  setOtp,
  onSend,
  onVerify,
  onChangeEmail,
  loading,
  error,
  resendSeconds,
}) {
  return (
    <main className="verification-page">
      <div className="verification-layout">
        <div className="verification-intro">
          <div className="auth-brand">
            <BrandLogo />
          </div>

          <div className="verification-kicker">
            <span className="eyebrow">Private and secure</span>
            <span className="verification-step-label">
              {step === 'details' ? '01 / 02' : '02 / 02'}
            </span>
          </div>

          <h1>
            One secure step
            <br />
            <em>to get started.</em>
          </h1>

          <p>
            Verify your identity once and unlock a trusted marketplace
            built for serious equipment decisions.
          </p>

          <div className="verification-points">
            <span><ShieldCheck size={17} /> Verified marketplace access</span>
            <span><BadgeCheck size={17} /> Secure buyer enquiries</span>
            <span><Building2 size={17} /> Built for Indian businesses</span>
          </div>

          <div className="verification-note">
            Your information is used only to protect the marketplace.
          </div>
        </div>

        <section className="verification-card">
          {step === 'details' ? (
            <>
              <div className="verification-progress" aria-hidden="true">
                <span className="is-current" />
                <span />
              </div>
              <span className="eyebrow">Step 1 of 2</span>
              <h2>Tell us about yourself.</h2>
              <p>We’ll send a one-time code to verify your email address.</p>

              <form onSubmit={onSend}>
                <label>
                  Your name
                  <input
                    required
                    value={data.name}
                    autoComplete="name"
                    onChange={event => setData(current => ({ ...current, name: event.target.value }))}
                    placeholder="Your full name"
                  />
                </label>

                <label>
                  Mobile number
                  <input
                    required
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    value={data.mobileNumber}
                    onChange={event => setData(current => ({ ...current, mobileNumber: event.target.value }))}
                    placeholder="Your mobile number"
                  />
                </label>

                <label>
                  Email address
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={data.email}
                    onChange={event => setData(current => ({ ...current, email: event.target.value }))}
                    placeholder="you@company.com"
                  />
                </label>

                {error && <p className="verification-error" role="alert">{error}</p>}

                <button className="button button-dark full-button" disabled={loading}>
                  {loading ? 'Sending code...' : 'Send verification code'}
                  <ArrowRight size={17} />
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="otp-icon"><Mail size={23} /></div>
              <div className="verification-progress" aria-hidden="true">
                <span className="is-complete" />
                <span className="is-current" />
              </div>

              <div className="otp-heading-row">
                <span className="eyebrow">Step 2 of 2</span>
                <button
                  type="button"
                  className="change-email"
                  onClick={onChangeEmail}
                  disabled={loading}
                >
                  Change details
                </button>
              </div>

              <h2>Enter your code.</h2>
              <p>
                We sent a 6-digit code to <strong>{data.email}</strong>.
              </p>

              <form onSubmit={onVerify}>
                <input
                  className="otp-input"
                  type="text"
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  maxLength={6}
                  minLength={6}
                  pattern="[0-9]{6}"
                  required
                  value={otp}
                  onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  aria-label="6-digit verification code"
                />

                {error && <p className="verification-error" role="alert">{error}</p>}

                <button className="button button-dark full-button" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify & continue'}
                  <BadgeCheck size={17} />
                </button>
              </form>

              <p className="verification-note">
                Earlier codes remain valid for up to 10 minutes after they’re sent.{' '}
                After verification, you’ll stay signed in for 30 days on this device.
              </p>

              <button
                type="button"
                className="resend"
                onClick={onSend}
                disabled={loading || resendSeconds > 0}
              >
                Didn’t receive it?{' '}
                <strong>
                  {resendSeconds > 0
                    ? `Resend in ${resendSeconds}s`
                    : 'Resend code'}
                </strong>
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
