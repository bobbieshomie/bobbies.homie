import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bobbies Homie',
    short_name: 'Bobbies Homie',
    description: 'Shared household management web-app',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#FDFBF7',
    theme_color: '#5D4037',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
