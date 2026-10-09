import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Mail,
  ShieldCheck,
  Wrench,
} from 'lucide-react'

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
}) {
  return (
    <main className="verification-page">
      <div className="verification-layout">
        <div className="verification-intro">
          <div className="auth-brand">
            <span className="brand-mark">
              <Wrench size={17} />
            </span>
            equip<span>trade</span>
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
              <span className="eyebrow">Step 1 of 2</span>
              <h2>Tell us about yourself.</h2>
              <p>We’ll send a one-time code to verify your email address.</p>

              <form onSubmit={onSend}>
                <label>
                  Your name
                  <input
                    required
                    value={data.name}
                    onChange={event => setData(current => ({ ...current, name: event.target.value }))}
                    placeholder="Your full name"
                  />
                </label>

                <label>
                  Mobile number
                  <input
                    required
                    type="tel"
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
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={event => setOtp(event.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  autoFocus
                />

                {error && <p className="verification-error" role="alert">{error}</p>}

                <button className="button button-dark full-button" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify & continue'}
                  <BadgeCheck size={17} />
                </button>
              </form>

              <p className="verification-note">
                After verification, you’ll stay signed in for 30 days on this device.
              </p>

              <button
                type="button"
                className="resend"
                onClick={onSend}
                disabled={loading}
              >
                Didn’t receive it? <strong>Resend code</strong>
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
