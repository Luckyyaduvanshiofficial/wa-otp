import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyButton } from '@/features/landing/components/copy-button';
import { DialApparatus } from '@/features/landing/components/dial-apparatus';
import { GITHUB_URL } from '@/features/landing/components/github-star';
import { Ruler } from '@/features/landing/components/ruler';
import { SiteNav } from '@/features/landing/components/site-nav';

export const metadata: Metadata = {
  title: 'wa otp — open source whatsapp and telegram otp service',
  description:
    'an open source otp service you can self-host. one endpoint sends a code over whatsapp or telegram, a second verifies it. 500 free whatsapp codes a month, unmetered telegram. codes and api keys are stored as sha256 hashes.'
};

/*
 * Two calls, and that is the whole integration surface — the shapes below are
 * copied verbatim from backend/docs/api.md §1, with the host and key left as
 * shell variables because there is no canonical live host to print.
 */
const SEND_CALL = `curl -X POST "$WAOTP_API/v1/otp/send" \\
  -H "X-Api-Key: $WAOTP_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "919876543210", "channel": "whatsapp"}'`;

const VERIFY_CALL = `curl -X POST "$WAOTP_API/v1/otp/verify" \\
  -H "X-Api-Key: $WAOTP_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "919876543210", "code": "123456"}'`;

const STATS = [
  { fig: '500', label: 'free whatsapp codes a month' },
  { fig: '300 s', label: 'before a code expires' },
  { fig: '3', label: 'guesses, then it burns' }
];

const FACTS = [
  {
    key: 'stack',
    value:
      'python, fastapi and pocketbase. pocketbase is both the database and the back office, so there is no separate admin panel to build.'
  },
  {
    key: 'limits are data',
    value:
      'quota, expiry, attempts and throttles live in a row you edit — not in code you redeploy.'
  },
  {
    key: 'providers',
    value:
      'meta cloud api, or the telegram bot api. telegram is unmetered; whatsapp carries the 500 free sends a month.'
  },
  {
    key: 'dry run',
    value:
      'set WAOTP_MOCK_DELIVERY=1 to fake delivery while every database row stays real, so the whole flow is testable with no provider credentials.'
  }
];

export default function LandingPage() {
  return (
    <div className='lm lm-shell'>
      <div className='lm-blueprint' aria-hidden='true' />

      <SiteNav />

      <header className='lm-hero'>
        <div className='lm-hero__body'>
          <p className='lm-eyebrow'>01 · open source otp service</p>
          <h1 className='lm-display'>
            <em>send</em> otp on whatsapp with two api calls.
          </h1>
          <p className='lm-lede'>
            self-host it, or sign up free — 500 whatsapp codes a month, telegram unmetered.
          </p>
          <div className='lm-actions'>
            <Link href='/signup' className='lm-actions__primary'>
              start free
            </Link>
            <Link href='/docs' className='lm-actions__ghost'>
              read the docs
            </Link>
          </div>
        </div>
        <div className='lm-hero__foot'>
          <Ruler />
          <DialApparatus />
        </div>
      </header>

      <main>
        <section className='lm-section' id='calls' aria-labelledby='calls-h'>
          <div className='lm-head'>
            <p className='lm-eyebrow'>02 · how it works</p>
            <h2 className='lm-h2' id='calls-h'>
              one endpoint sends a code. one endpoint checks it.
            </h2>
            <p className='lm-lede'>
              both take json and return json. your api key rides in a header, never in a url, so it
              stays out of logs and referrers.
            </p>
          </div>

          <div className='lm-specs'>
            <article className='lm-spec'>
              <div className='lm-spec__head'>
                <h3 className='lm-spec__route'>post /v1/otp/send</h3>
                <p className='lm-spec__note'>expires_in 300</p>
              </div>
              <pre className='lm-code'>{SEND_CALL}</pre>
              <CopyButton value={SEND_CALL} label='copy the send call' />
            </article>

            <article className='lm-spec'>
              <div className='lm-spec__head'>
                <h3 className='lm-spec__route'>post /v1/otp/verify</h3>
                <p className='lm-spec__note'>verified true</p>
              </div>
              <pre className='lm-code'>{VERIFY_CALL}</pre>
              <CopyButton value={VERIFY_CALL} label='copy the verify call' />
            </article>
          </div>
        </section>

        <section className='lm-section' id='limits' aria-labelledby='limits-h'>
          <div className='lm-head'>
            <p className='lm-eyebrow'>03 · what it costs</p>
            <h2 className='lm-h2' id='limits-h'>
              500 whatsapp codes a month, free. telegram is unmetered.
            </h2>
            <p className='lm-lede'>
              the limits are data, not code. quota, expiry, attempts and throttles all live in one
              settings row you can edit without a redeploy.
            </p>
          </div>

          <div className='lm-stats'>
            {STATS.map(({ fig, label }) => (
              <div key={label}>
                <p className='lm-stat__fig'>{fig}</p>
                <p className='lm-stat__label'>{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className='lm-section' id='storage' aria-labelledby='storage-h'>
          <div className='lm-head'>
            <p className='lm-eyebrow'>04 · your data</p>
            <h2 className='lm-h2' id='storage-h'>
              codes and api keys are hashed. the phone number is not.
            </h2>
            <p className='lm-lede'>
              the one-time code and every api key go in as sha256 digests, so an operator reading
              the back office sees hashes, not secrets. the meta token and the telegram bot token
              are fernet-encrypted in the settings row. the phone number is not hashed, because the
              gateway has to match it on the next call.
            </p>
          </div>
        </section>

        <section className='lm-section' id='selfhost' aria-labelledby='selfhost-h'>
          <div className='lm-head'>
            <p className='lm-eyebrow'>05 · open source</p>
            <h2 className='lm-h2' id='selfhost-h'>
              run the whole thing on your own server.
            </h2>
            <p className='lm-lede'>
              one repository, two processes. bring your own meta and telegram credentials and the
              gateway never has to leave the machine you chose.
            </p>
          </div>

          <dl className='lm-facts'>
            {FACTS.map(({ key, value }) => (
              <div className='lm-facts__item' key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className='lm-section lm-section--close' aria-labelledby='start-h'>
          <h2 className='lm-h2' id='start-h'>
            sign up and send a code, or clone it and run it yourself.
          </h2>
          <div className='lm-actions'>
            <Link href='/signup' className='lm-actions__primary'>
              start free
            </Link>
            <Link href='/docs' className='lm-actions__ghost'>
              read the docs
            </Link>
          </div>
        </section>
      </main>

      <footer className='lm-foot'>
        <p className='lm-foot__stmt'>send a code. check a code. keep the data.</p>
        <div className='lm-foot__meta'>
          <span>wa otp</span>
          <span>built in india</span>
          <span>open source</span>
          {GITHUB_URL ? (
            <a href={GITHUB_URL} target='_blank' rel='noreferrer'>
              github
            </a>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
