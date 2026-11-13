const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/sw.js', headers: [
      { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      { key: 'Service-Worker-Allowed', value: '/' },
      { key: 'Content-Type', value: 'application/javascript; charset=utf-8' }
    ] }, { source: '/offline-app.html', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }];
  }
};
export default nextConfig;
