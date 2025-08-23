export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Canonical redirect
    if (url.pathname === '/index.html') {
      url.pathname = '/';
      return Response.redirect(url.toString(), 301);
    }

    // Serve all static assets and HTML from the assets binding (dist/)
    return env.ASSETS.fetch(request);
  }
};