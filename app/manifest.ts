import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '¿Dónde quedamos?',
    short_name: 'Dónde quedamos',
    description: 'El sitio donde todos tardáis lo mismo en llegar, cada uno con su transporte.',
    lang: 'es',
    start_url: '/',
    display: 'standalone',
    background_color: '#F0F0EA',
    theme_color: '#F0F0EA',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
