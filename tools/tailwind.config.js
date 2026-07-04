/** @type {import('tailwindcss').Config} */
// Build-time replacement for the former Tailwind Play runtime (Play scanned the
// live DOM, so scripts that add utility classes at runtime must be scanned too).
module.exports = {
    content: [
        './src/pages/*.html',
        './src/scripts/*.js',
        './dev/*.html'
    ],
    theme: {
        extend: {}
    },
    plugins: []
};
