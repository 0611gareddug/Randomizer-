// 빌드: 번들 → 난독화 → 단일 HTML (dist/index.html)
import { build, transform } from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const dev = process.argv.includes('--dev');
const out = dev ? '.dev' : 'dist';
mkdirSync(out, { recursive: true });

const js = await build({
  entryPoints: ['src/main.js'], bundle: true, format: 'iife', target: 'es2019', minify: true, write: false,
  legalComments: 'none', drop: dev ? [] : ['console'], define: { 'process.env.NODE_ENV': '"production"' },
});
let code = js.outputFiles[0].text;
if (!dev) {
  code = JavaScriptObfuscator.obfuscate(code, {
    compact: true, simplify: true, identifierNamesGenerator: 'hexadecimal', renameGlobals: false,
    stringArray: true, stringArrayEncoding: ['base64'], stringArrayThreshold: 0.6, stringArrayRotate: true, stringArrayShuffle: true,
    stringArrayIndexShift: true, stringArrayWrappersCount: 1, stringArrayWrappersType: 'variable',
    controlFlowFlattening: false, deadCodeInjection: false, selfDefending: false, debugProtection: false,
    disableConsoleOutput: true, transformObjectKeys: false, unicodeEscapeSequence: false, splitStrings: false, numbersToExpressions: false,
    target: 'browser', seed: 20261116,
  }).getObfuscatedCode();
}
const css = (await transform(readFileSync('src/style.css', 'utf8'), { loader: 'css', minify: true })).code;
let html = readFileSync('src/index.html', 'utf8');
html = html.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => code.replace(/<\/script/gi, '<\\/script'));
html = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\n\s*/g, '\n');
writeFileSync(`${out}/index.html`, html);
console.log(`${out}/index.html`, (html.length / 1024).toFixed(1) + ' KB');
