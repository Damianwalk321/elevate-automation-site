# Downloads

This folder is the public delivery location for the Elevate Automation Vehicle Poster extension package.

Expected generated files:

- `elevate-automation-extension.zip`
- `elevate-automation-extension-build.json`

The Vehicle Poster extension repository workflow is responsible for creating the ZIP and syncing it here when the `SITE_REPO_SYNC_TOKEN` secret is configured in `Damianwalk321/elevate-automation-vehicle-poster`.

Dashboard download path:

```text
/downloads/elevate-automation-extension.zip
```

The dashboard appends a cache-busting query string so users do not receive stale browser-cached packages.
