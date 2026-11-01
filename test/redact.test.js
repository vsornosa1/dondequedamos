// A Vercel Analytics no le llega nada personal desde la URL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactUrl } from '../lib/redact.js';

test('las propuestas compartidas no mandan nombres, sitio ni rutas', () => {
  assert.equal(redactUrl('https://dondequedamos.app/p/QmFyIFRvbnlpbmF-Mzk0NjE2fi0zNzQ5~Laura.T13~Pablo.B14'), 'https://dondequedamos.app/p/[propuesta]');
  assert.equal(redactUrl('https://dondequedamos.app/p/k3X9aQ2b'), 'https://dondequedamos.app/p/[propuesta]');
});

test('fuera # y parámetros, menos los utm_; el resto de páginas, tal cual', () => {
  assert.equal(redactUrl('https://dondequedamos.app/?utm_source=linkedin&fbclid=x#q=abc'), 'https://dondequedamos.app/?utm_source=linkedin');
  assert.equal(redactUrl('https://dondequedamos.app/p/abc?utm_source=whatsapp'), 'https://dondequedamos.app/p/[propuesta]?utm_source=whatsapp');
  assert.equal(redactUrl('https://dondequedamos.app/'), 'https://dondequedamos.app/');
  assert.equal(redactUrl('no es una url'), 'no es una url');
});
