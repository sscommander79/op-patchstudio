import { useState } from 'react';
import { scrapePatreonPosts, type PatreonPost } from '../../utils/patreonPosts';

// Anchors reuse the studio button classes; these keep them laid out like the buttons they sit beside.
const linkButtonStyle = { display: 'inline-flex', alignItems: 'center', gap: '.5rem', textDecoration: 'none' } as const;

export function DonatePage() {
  const [patreonPosts, setPatreonPosts] = useState<PatreonPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [hasError, setHasError] = useState(false);

  const [requested,setRequested]=useState(false);
  const loadPosts=async()=>{if(isLoadingPosts)return;setRequested(true);setIsLoadingPosts(true);setHasError(false);try{setPatreonPosts(await scrapePatreonPosts());}catch{setHasError(true);}finally{setIsLoadingPosts(false);}};

  return (
    <div className="studio-shell-content">
      <a className="studio-back-link" href="#/studio/overview" style={{ display: 'inline-flex', alignItems: 'center' }}>← Back to the studio</a>
      <p className="studio-eyebrow">Optional</p>
      <h1>Support the project</h1>
      <p className="studio-shell-lead">
        OP-PatchStudio is a 100% free and <a href="https://github.com/sscommander79/op-patchstudio" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>open-source</a> tool for creating and editing drum and multisample presets for the OP-XY. Every feature works without paying.
      </p>

      <div style={{ display: 'grid', gap: '1rem' }}>
        <section className="studio-setup-panel" aria-labelledby="support-ways-heading">
          <h2 id="support-ways-heading">Ways to support</h2>
          <p>
            Most features have come from community ideas and requests. Joseph Holland's <a href="https://www.patreon.com/c/oppatchstudio" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>project Patreon</a> shares behind-the-scenes updates, roadmap voting, priority support, exclusive content, tutorials, and early access to preview features.
          </p>
          <p>These support links benefit the original project's creator, Joseph Holland, and help fund his continued project work.</p>
          <div className="studio-action-row">
            <a
              className="studio-button-primary"
              href="https://www.patreon.com/c/oppatchstudio"
              target="_blank"
              rel="noopener noreferrer"
              style={linkButtonStyle}
            >
              <i aria-hidden="true" className="fab fa-patreon"></i>
              Support on Patreon
            </a>
            <a
              className="studio-button-secondary"
              href="https://buymeacoffee.com/jxavierh"
              target="_blank"
              rel="noopener noreferrer"
              style={linkButtonStyle}
            >
              <i aria-hidden="true" className="fas fa-coffee"></i>
              Buy Joseph a coffee
            </a>
          </div>
          <p>
            These are outside services. Each link opens Patreon or Buy Me a Coffee in a new tab, and any payment or account is handled there under that service's terms, not by OP-PatchStudio.
          </p>
        </section>

        <section className="studio-setup-panel" aria-labelledby="support-posts-heading">
          <h2 id="support-posts-heading">Latest posts</h2>
          <p>
            To show this list, the page requests Patreon's public posts through a public relay service (allorigins.win, cors-anywhere.herokuapp.com, or thingproxy.freeboard.io). Those services can see that request. None of your presets, samples, or projects are included.
          </p>
          {!requested&&<button type="button" className="studio-button-secondary" onClick={()=>void loadPosts()}>Load project posts</button>}
          {isLoadingPosts ? (
            <p role="status">Loading posts…</p>
          ) : hasError ? (
            <p role="status" className="studio-message studio-message-warning">
              Live Patreon posts are unavailable.{' '}
              <a href="https://www.patreon.com/c/oppatchstudio/posts" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                View posts directly on Patreon.
              </a>
            </p>
          ) : patreonPosts.length > 0 ? (
            <>
              <div style={{ display: 'grid', gap: '.75rem' }}>
                {patreonPosts.map((post, index) => (
                  <article key={index} className="studio-empty-pad" style={{ borderStyle: 'solid' }}>
                    <h3 style={{ margin: '0 0 .5rem' }}>{post.title}</h3>
                    <p style={{ margin: '0 0 .75rem', lineHeight: 1.5 }}>{post.excerpt}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <span>{post.date}</span>
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Read more: ${post.title} (opens Patreon in a new tab)`}
                        style={{ color: 'inherit', textDecoration: 'underline' }}
                      >
                        Read more →
                      </a>
                    </div>
                  </article>
                ))}
              </div>
              <div className="studio-action-row">
                <a
                  className="studio-button-secondary"
                  href="https://www.patreon.com/c/oppatchstudio/posts"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkButtonStyle}
                >
                  <i aria-hidden="true" className="fab fa-patreon"></i>
                  Continue on Patreon
                </a>
              </div>
            </>
          ) : (
            <p role="status">No posts available.</p>
          )}
        </section>
      </div>
    </div>
  );
}
