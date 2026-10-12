// Genera index.html: la versión publicable de proposio en UN SOLO ARCHIVO.
//
// Por qué: GitHub Pages (y cualquier alojamiento estático) sirve los archivos tal cual,
// sin "construir" el proyecto. Un navegador no puede ejecutar .jsx directamente, así que
// se publica un index.html que ya lleva dentro todo el código y los estilos.
//
// Uso (desde esta carpeta):  npm run build
// Después, sube el index.html nuevo a GitHub.

import { readFileSync, writeFileSync } from 'node:fs'
import * as esbuild from 'esbuild'

// Versión fija de jsPDF que se descarga desde cdnjs al pulsar «Descargar PDF».
const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'

// Sustituye jspdfLoader.js por un cargador que trae jsPDF desde el CDN.
const cdnJsPdf = {
  name: 'jspdf-cdn',
  setup(build) {
    build.onResolve({ filter: /^\.\/jspdfLoader\.js$/ }, () => ({ path: 'jspdf-cdn', namespace: 'jspdf-cdn' }))
    build.onLoad({ filter: /.*/, namespace: 'jspdf-cdn' }, () => ({
      loader: 'js',
      contents: `
        let pending = null
        export function loadJsPDF() {
          if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF)
          if (!pending) {
            pending = new Promise((resolve, reject) => {
              const script = document.createElement('script')
              script.src = ${JSON.stringify(JSPDF_CDN)}
              script.async = true
              script.crossOrigin = 'anonymous'
              script.referrerPolicy = 'no-referrer'
              const fail = () => {
                pending = null
                script.remove()
                const error = new Error('No se pudo cargar jsPDF')
                error.userMessage = 'No se pudo cargar el generador de PDF. Comprueba tu conexión a internet y vuelve a intentarlo.'
                reject(error)
              }
              script.onload = () => (window.jspdf && window.jspdf.jsPDF ? resolve(window.jspdf.jsPDF) : fail())
              script.onerror = fail
              document.head.appendChild(script)
            })
          }
          return pending
        }`,
    }))
  },
}

const result = await esbuild.build({
  entryPoints: ['main.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  write: false,
  outdir: 'build-tmp', // no se escribe en disco: write: false
  plugins: [cdnJsPdf],
  logLevel: 'warning',
})

const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script')
const css = result.outputFiles.find((f) => f.path.endsWith('.css')).text

const template = readFileSync('dev.html', 'utf8')
const devScript = '<script type="module" src="./main.jsx"></script>'
if (!template.includes(devScript)) throw new Error('dev.html no contiene el script de desarrollo esperado')

// Se usan funciones en replace() para que los "$" del código minificado no se interpreten como patrones.
const html = template
  .replace('<head>', () => '<head>\n    <!-- ARCHIVO GENERADO con "npm run build". No lo edites a mano: edita los .jsx/.js/.css y vuelve a generarlo. -->')
  .replace('</head>', () => `    <style>${css}</style>\n  </head>`)
  .replace(devScript, () => `<script>${js}</script>`)

if (html.includes(devScript)) throw new Error('No se pudo sustituir el script de dev.html')
writeFileSync('index.html', html)
console.log(`index.html generado (${Math.round(html.length / 1024)} KB)`)
