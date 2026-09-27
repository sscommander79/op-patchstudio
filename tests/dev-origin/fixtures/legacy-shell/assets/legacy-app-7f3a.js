// Legacy app behaviour kept for the fixture: read the version from /manifest.json (0.0.0 on failure)
// and register the production worker at /sw.js, as the old build did. No build-identity check.
fetch('/manifest.json')
  .then(response => response.json())
  .then(manifest => manifest.version || '0.0.0')
  .catch(() => '0.0.0')
  .then(version => { document.getElementById('legacy-version').textContent = `v${version}`; });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/' });
