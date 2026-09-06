import type { Metadata } from 'next';
import { ArrowLeft, ArrowDownRight, Plane, Sun, Stamp } from 'lucide-react';
export const metadata: Metadata = {
  title: 'Holidays Mode — Brand kit',
  alternates: { canonical: '/brand-kit' },
};
const colors = [
  ['Vacation cream', '#FFF7E8', 'The canvas'],
  ['Passport navy', '#17223B', 'The words'],
  ['Sunset orange', '#FF805F', 'The action'],
  ['Holiday sky', '#68C7E8', 'The open air'],
  ['Tropical green', '#8ECF93', 'Mode: ON'],
];
export default function BrandKit() {
  return (
    <main className="brand-kit">
      <header>
        <a href="/">
          <ArrowLeft size={16} />
          BACK TO THE HOLIDAYS
        </a>
        <span>BRAND KIT · EDITION 01</span>
      </header>
      <section className="brand-kit-title">
        <span className="eyebrow">GOOD PEOPLE. BETTER PLACES.</span>
        <h1>
          HOLIDAYS
          <br />
          MODE
        </h1>
        <p>A small break goes a long way.</p>
      </section>
      <section className="brand-assets">
        <a href="/brand/holidays-mode-icon.png" download>
          <img
            src="/brand/holidays-mode-icon.png"
            alt="Holidays Mode puzzle grid icon"
            width="400"
            height="400"
          />
          <span>
            THE ICON · ORIGINAL PNG <ArrowDownRight />
          </span>
        </a>
        <a href="/brand/holidays-mode-banner.png" download>
          <img
            src="/brand/holidays-mode-banner.png"
            alt="Holidays Mode X banner with Bali, Tokyo, Ibiza and Rio boarding cards"
            width="1500"
            height="500"
          />
          <span>
            THE X BANNER · ORIGINAL PNG <ArrowDownRight />
          </span>
        </a>
      </section>
      <section className="brand-atlas-download">
        <img
          src="/brand/postcard-atlas.png"
          alt="Original retro travel illustrations of Bali, Tokyo, Ibiza and Rio"
          width="1536"
          height="1024"
          loading="lazy"
        />
        <div>
          <span className="eyebrow">THE DESTINATION POSTCARDS</span>
          <p>Four little escapes, in one illustration system.</p>
          <a className="text-link" href="/brand/postcard-atlas.png" download>
            DOWNLOAD THE ATLAS <ArrowDownRight size={17} />
          </a>
          <a
            className="text-link"
            href="/brand/postcard-art-prompt.txt"
            download
          >
            ART DIRECTION & GENERATION PROMPT <ArrowDownRight size={17} />
          </a>
        </div>
      </section>
      <section>
        <div className="brand-kit-heading">
          <span>01 / PALETTE</span>
          <h2>Instant holiday recognition.</h2>
        </div>
        <div className="brand-swatches">
          {colors.map(([name, hex, use]) => (
            <div key={hex}>
              <div
                style={{
                  background: hex,
                  color: hex === '#17223B' ? '#FFF7E8' : '#17223B',
                }}
              >
                <span>{hex}</span>
                <Sun size={27} />
              </div>
              <h3>{name}</h3>
              <p>{use}</p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="brand-kit-heading">
          <span>02 / TYPE</span>
          <h2>Big words. Small breaks.</h2>
        </div>
        <div className="brand-type-samples">
          <article>
            <span className="eyebrow">ARCHIVO · 850–900</span>
            <h3>
              OUT OF
              <br />
              OFFICE.
            </h3>
            <p>Geometric, bold headlines. Short lines, close spacing.</p>
          </article>
          <article>
            <span className="eyebrow">NUNITO SANS · 400–850</span>
            <h3>
              Pick a destination.
              <br />
              Beat your best.
            </h3>
            <p>Friendly labels, clear rules and satisfying scores.</p>
            <strong>
              1,420 <small>NEW PERSONAL BEST</small>
            </strong>
          </article>
          <article>
            <span className="eyebrow">SPACE MONO · 400 / 700</span>
            <h3>
              HM-001
              <br />
              DPS → HND
            </h3>
            <p>Boarding details, destination codes and passport dates.</p>
            <span className="mode-badge">
              MODE: ON <span />
            </span>
          </article>
        </div>
      </section>
      <section>
        <div className="brand-kit-heading">
          <span>03 / THE SYSTEM</span>
          <h2>Travel. Play. Collect. Repeat.</h2>
        </div>
        <div className="brand-patterns">
          <article>
            <Plane />
            <h3>Boarding cards</h3>
            <p>
              Destination name + airport code, a landscape, personal best and a
              perforated ticket edge. Bali and Ibiza lead with orange, Tokyo
              with blue, Rio with green.
            </p>
          </article>
          <article>
            <Stamp />
            <h3>Passport stamps</h3>
            <p>
              Outlined before completion, colored and stamped after a full
              puzzle. Slight rotations and a short stamp animation make each
              arrival feel earned.
            </p>
          </article>
          <article>
            <Sun />
            <h3>Social language</h3>
            <p>
              One destination or one message per post. Keep the puzzle matrix
              visible. Use “MODE: ON”, “OUT OF OFFICE.” and the same four
              boarding cards.
            </p>
          </article>
        </div>
      </section>
      <section className="brand-voice">
        <span className="eyebrow">04 / VOICE</span>
        <h2>Your inbox can wait.</h2>
        <p>
          Optimistic. Relaxed. A little ironic. The vacation comes first; crypto
          stays secondary.
        </p>
        <div>
          <span>ONE LAST PUZZLE.</span>
          <span>PASSPORT STAMPED.</span>
          <span>MORE HOLIDAYS, PLEASE.</span>
        </div>
      </section>
      <footer>
        <a href="/">HOLIDAYS MODE</a>
        <span>Travel light. Play more.</span>
      </footer>
    </main>
  );
}
