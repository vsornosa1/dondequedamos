// Lo que se manda a Vercel Analytics no lleva nada personal: las propuestas compartidas (/p/…) llevan en la
// URL los nombres, el sitio y las rutas, así que se quedan en /p/[propuesta]; fuera el # y los parámetros,
// menos los utm_ (para saber, p. ej., cuántos llegan desde el post de LinkedIn).
export function redactUrl(url) {
  try {
    const u = new URL(url);
    if (u.pathname.startsWith('/p/')) u.pathname = '/p/[propuesta]';
    for (const k of [...u.searchParams.keys()]) if (!k.startsWith('utm_')) u.searchParams.delete(k);
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}
