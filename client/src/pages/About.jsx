import { ArrowRight } from 'lucide-react'

const expertise = [
  {
    title: 'Power and distribution',
    text: 'Industrial electrical equipment, distribution systems, transformers, DG sets, panels, and switchgear.',
  },
  {
    title: 'Power plant operations',
    text: 'Utility changeovers, grid synchronization, captive power transitions, and AVR panel operations.',
  },
  {
    title: 'Smart systems and maintenance',
    text: 'Smart-grid integration and predictive maintenance approaches that support reliable plant operations.',
  },
  {
    title: 'Industrial products and assets',
    text: 'Heavy-duty components, machinery, spares, and surplus inventory for industrial businesses.',
  },
]

export default function About({ navigate }) {
  return (
    <main className="info-page about-page">
      <header className="about-intro">
        <div className="container about-copy">
          <span className="eyebrow">About EquipTrade India</span>
          <h1>Empowering industry with reliable power solutions.</h1>
          <p className="about-lead">A trusted partner for industrial products, heavy electrical equipment, and the businesses that keep essential operations running.</p>
        </div>
      </header>

      <section className="about-section about-mission container">
        <span className="eyebrow">Who we are</span>
        <h2>Industrial knowledge. Practical solutions.</h2>
        <p>EquipTrade India works in business development and distributorship for high-quality industrial products and heavy electrical equipment. With more than a decade of professional experience in the power plant sector, our expertise spans power and distribution systems, grid synchronization, utility changeovers, and AVR panel operations.</p>
        <p>We bring technical understanding and a practical marketplace together—helping businesses discover equipment, connect with buyers and sellers, and put idle or surplus assets back into productive use.</p>
      </section>

      <section className="about-expertise">
        <div className="container">
          <div className="about-section-heading">
            <span className="eyebrow">Our expertise</span>
            <h2>Supporting dependable industrial operations.</h2>
          </div>
          <div className="about-expertise-list">
            {expertise.map(({ title, text }, index) => (
              <article className="about-expertise-item" key={title}>
                <span className="about-expertise-number">0{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section container">
        <span className="eyebrow">Our mission</span>
        <h2>Improve infrastructure. Reduce avoidable downtime.</h2>
        <p>We aim to help industrial units strengthen their electrical infrastructure with dependable equipment and informed engineering support. Our work draws on modern engineering tools for predictive fault detection, automated maintenance planning, and better visibility into industrial inventory.</p>
        <p>From technical field verification to carefully managed transitions between utility supply and captive power plants, the focus is on efficient changeovers, reliable operation, and reduced avoidable downtime.</p>
      </section>

      <section className="about-distribution">
        <div className="container about-distribution-inner">
          <div>
            <span className="eyebrow">Distributorship and solutions</span>
            <h2>Bringing industrial products closer to the plant floor.</h2>
          </div>
          <p>EquipTrade India is developing business and distributorship partnerships for domestic and international industrial products. Our goal is to help businesses source reliable heavy-duty electrical components and equipment for their operational needs.</p>
        </div>
      </section>

      <section className="about-section container about-quality">
        <span className="eyebrow">Our commitment</span>
        <h2>Safety, quality, and engineered excellence.</h2>
        <div className="about-quality-copy">
          <p>We focus on solutions suited to industrial requirements: electrical systems, automated fault management, and power-asset controls. Technical evaluation and field verification help keep reliability and operational standards in view.</p>
          <p>Alongside engineering and distributorship, EquipTrade India provides a marketplace for discovering industrial equipment and connecting directly with buyers and sellers. Businesses can also list surplus goods and idle assets for a new opportunity.</p>
        </div>
        <button className="about-text-link" onClick={() => navigate('browse')}>Explore equipment <ArrowRight size={17} /></button>
      </section>
    </main>
  )
}
