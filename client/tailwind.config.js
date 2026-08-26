/** @type {import('tailwindcss').Config} */
export default { content: ['./index.html', './src/**/*.{ts,tsx}'], theme: { extend: { colors: { ink: '#17213a', brand: { 50: '#edf5ff', 500: '#2563eb', 600: '#1d4ed8', 700: '#1d3faf' }, mint: { 50: '#ecfdf5', 500: '#10b981', 600: '#059669' } }, boxShadow: { card: '0 8px 30px rgba(15, 23, 42, 0.08)' } } }, plugins: [] };
