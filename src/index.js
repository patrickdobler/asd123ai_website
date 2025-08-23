// Import static assets
import indexHtml from '../dist/index.html';
import optimizerHtml from '../dist/optimizer.html';
import documentationHtml from '../dist/documentation.html';
import testOptimizerHtml from '../dist/test-optimizer.html';

// Asset mapping for static files
const ASSETS = {
  '/': 'index.html',
  '/optimizer': 'optimizer.html',
  '/documentation': 'documentation.html',
  '/test': 'test-optimizer.html',
  '/robots.txt': 'robots.txt',
  '/sitemap.xml': 'sitemap.xml'
};

// MIME types for different file extensions
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

// Clean URL redirects
const REDIRECTS = {
  '/index.html': '/',
  '/optimizer.html': '/optimizer',
  '/documentation.html': '/documentation',
  '/test-optimizer.html': '/test'
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle redirects for clean URLs
    if (REDIRECTS[pathname]) {
      return Response.redirect(`https://asd123.ai${REDIRECTS[pathname]}`, 301);
    }

    // Handle clean URLs
    if (ASSETS[pathname]) {
      const assetName = ASSETS[pathname];
      
      try {
        let content;
        
        // Serve HTML content
        switch (assetName) {
          case 'index.html':
            content = indexHtml;
            break;
          case 'optimizer.html':
            content = optimizerHtml;
            break;
          case 'documentation.html':
            content = documentationHtml;
            break;
          case 'test-optimizer.html':
            content = testOptimizerHtml;
            break;
          default:
            // For other assets, try to fetch from the environment
            const asset = await env.ASSETS.get(assetName);
            if (!asset) {
              return new Response('Not Found', { status: 404 });
            }
            content = asset;
        }
        
        const mimeType = MIME_TYPES['.html'] || 'text/html';
        
        return new Response(content, {
          headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=3600',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self';"
          }
        });
      } catch (error) {
        console.error('Error serving asset:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    }

    // Handle static assets (CSS, JS, images, etc.)
    if (pathname.startsWith('/styles/') || pathname.startsWith('/scripts/') || pathname.startsWith('/components/')) {
      try {
        const assetPath = pathname.substring(1); // Remove leading slash
        const asset = await env.ASSETS.get(assetPath);
        
        if (!asset) {
          return new Response('Not Found', { status: 404 });
        }
        
        const extension = pathname.substring(pathname.lastIndexOf('.'));
        const mimeType = MIME_TYPES[extension] || 'application/octet-stream';
        
        return new Response(asset, {
          headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
            'X-Content-Type-Options': 'nosniff'
          }
        });
      } catch (error) {
        console.error('Error serving static asset:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    }

    // Handle robots.txt and sitemap.xml
    if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
      try {
        const asset = await env.ASSETS.get(pathname.substring(1));
        
        if (!asset) {
          return new Response('Not Found', { status: 404 });
        }
        
        const mimeType = pathname.endsWith('.xml') ? MIME_TYPES['.xml'] : MIME_TYPES['.txt'];
        
        return new Response(asset, {
          headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=3600'
          }
        });
      } catch (error) {
        console.error('Error serving special file:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    }

    // 404 for all other routes
    return new Response('Not Found', { status: 404 });
  }
};