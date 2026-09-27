import { useState, useEffect } from 'react';
import { getAppVersion } from '../../utils/version';
import { currentBuild, shortBuildId } from '../../utils/buildIdentity';

export function Footer() {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    getAppVersion().then(setVersion);
  }, []);

  return (
    <footer style={{
      textAlign: 'center',
      marginTop: '3rem',
      padding: '20px',
      fontSize: '0.9rem',
      color: 'var(--color-text-tertiary)'
    }}>
      <div style={{ marginBottom: '1rem', color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>
        OP-PatchStudio is an unofficial tool not affiliated with or endorsed by teenage engineering.<br />
        this software is provided "as is" without warranty of any kind. use at your own risk. for educational and personal use only.<br />
        OP-XY, OP-1 and OP-Z are registered trademarks of teenage engineering.<br />
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5em',
        fontSize: '0.98em'
      }}>
        <span style={{ color: 'var(--color-text-tertiary)' }}>proudly open source</span>
        <span style={{ color: 'var(--color-text-tertiary)' }}>|</span>
        <a
          href="https://github.com/sscommander79/op-patchstudio"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          github fork
        </a>
        <span style={{ color: 'var(--color-text-tertiary)' }}>|</span>
        {version ? (
          <span style={{ color: 'var(--color-text-secondary)' }} data-opstudio-build={currentBuild.buildId} data-opstudio-mode={currentBuild.mode}>
            v{version} · {currentBuild.mode === 'development' ? 'dev ' : ''}build {shortBuildId(currentBuild.buildId)}
          </span>
        ) : (
          <span style={{ color: 'var(--color-text-secondary)' }}>loading version...</span>
        )}

      </div>
      <div style={{ marginTop: '0.5rem' }}>
        fork maintained by sscommander79 · original project by{' '}
        <a
          href="https://github.com/joseph-holland"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          joseph-holland
        </a>
      </div>
      <div style={{ marginTop: '0.5rem' }}>
        inspired by the awesome{' '}
        <a
          href="https://buba447.github.io/opxy-drum-tool/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          opxy-drum-tool
        </a>
        {' '} by zeitgeese
      </div>
    </footer>
  );
}
