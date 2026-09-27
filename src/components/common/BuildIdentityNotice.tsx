import { useEffect, useState } from 'react';
import { checkServedBuild, currentBuild, shortBuildId, type BuildIdentity } from '../../utils/buildIdentity';

const describe = (build: BuildIdentity) => `v${build.version} ${build.mode} build ${shortBuildId(build.buildId)}`;

// Tells the user when this tab runs a different build from the local server. It never reloads or
// clears storage itself, so unsaved work stays in place until the user chooses to reload.
export function BuildIdentityNotice({ check = checkServedBuild }: { check?: typeof checkServedBuild }) {
  const [served, setServed] = useState<BuildIdentity | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    void check().then(result => { if (active && result.status === 'different') setServed(result.served); });
    return () => { active = false; };
  }, [check]);

  if (!served || dismissed) return null;
  return <aside className="studio-build-notice" role="status" aria-live="polite" data-build-status="different">
    <p><strong>This tab is running a different build from the local server.</strong> This tab: {describe(currentBuild)}. Server: {describe(served)}. Save or back up your work, then reload this page.</p>
    <button type="button" className="studio-button-secondary" onClick={() => setDismissed(true)}>Dismiss</button>
  </aside>;
}
