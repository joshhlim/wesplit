import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WeSplit', short_name: 'WeSplit', description: 'Scan a receipt, split the bill, PayNow your friends.',
    start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait',
    background_color: '#FFFFFF', theme_color: '#0B7A5A',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
