/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'wesplit-rust.vercel.app' }],
        destination: 'https://wesplit-sg.vercel.app/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
