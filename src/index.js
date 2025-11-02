export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle Chrome DevTools requests gracefully
    if (url.pathname.startsWith('/.well-known/')) {
      return new Response(null, { status: 204 });
    }

    // Clean URL redirects
    const redirects = {
      '/index.html': '/',
      '/optimizer.html': '/optimizer',
      '/documentation.html': '/documentation',
      '/about.html': '/about',
      '/contact.html': '/contact',
      '/privacy.html': '/privacy',
      '/test-optimizer.html': '/test',
      '/anonymizer-guide.html': '/anonymizer-guide',
      '/optimizer-guide.html': '/optimizer-guide'
    };

    if (redirects[url.pathname]) {
      url.pathname = redirects[url.pathname];
      return Response.redirect(url.toString(), 301);
    }

    // Handle clean URLs by mapping them to .html files
    const cleanUrls = {
      '/optimizer': '/optimizer.html',
      '/documentation': '/documentation.html',
      '/about': '/about.html',
      '/contact': '/contact.html',
      '/privacy': '/privacy.html',
      '/test': '/test-optimizer.html',
      '/anonymizer-guide': '/anonymizer-guide.html',
      '/optimizer-guide': '/optimizer-guide.html'
    };

    if (cleanUrls[url.pathname]) {
      url.pathname = cleanUrls[url.pathname];
      return env.ASSETS.fetch(new Request(url.toString(), request));
    }

    // Serve all static assets and HTML from the assets binding (dist/)
    return env.ASSETS.fetch(request);
  }
};