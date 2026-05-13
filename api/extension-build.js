import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    const metadataPath = path.join(process.cwd(), 'downloads', 'elevate-automation-extension-build.json');
    const downloadPath = '/downloads/elevate-automation-extension.zip';

    if (!fs.existsSync(metadataPath)) {
      return res.status(200).json({
        available: false,
        download_url: downloadPath,
        message: 'Extension build metadata has not been generated yet. Run the Vehicle Poster build workflow.'
      });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

    return res.status(200).json({
      available: true,
      download_url: downloadPath,
      cache_busted_download_url: `${downloadPath}?v=${Date.now()}`,
      build: metadata
    });
  } catch (error) {
    return res.status(500).json({
      available: false,
      error: 'EXTENSION_BUILD_METADATA_ERROR',
      message: error?.message || 'Unable to load extension build metadata.'
    });
  }
}
