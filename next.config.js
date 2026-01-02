/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfkit/fontkit sollen im Server-Build externalisiert werden, damit keine SWC-Helper fehlen
  serverExternalPackages: ['pdfkit', 'fontkit'],
  // Leere turbopack-Config, um die Turbopack-Warnung (webpack override) zu vermeiden
  turbopack: {},
}

module.exports = nextConfig

