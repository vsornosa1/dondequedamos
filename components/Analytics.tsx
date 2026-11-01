'use client';
// Visitas con Vercel Web Analytics (sin cookies). Antes de enviar nada, la URL pasa por redactUrl: las
// propuestas compartidas llevan en ella nombres, sitio y rutas, y a Analytics no llega nada personal.
import { Analytics as VercelAnalytics, type BeforeSendEvent } from '@vercel/analytics/next';
import { track as vercelTrack } from '@vercel/analytics';
import { redactUrl } from '@/lib/redact.js';

const redact = (e: BeforeSendEvent): BeforeSendEvent => ({ ...e, url: redactUrl(e.url) });

export default function Analytics() {
  return <VercelAnalytics beforeSend={redact} />;
}

// Eventos de uso, solo con datos que no identifican a nadie (plan, cuántos sois, cómo se comparte).
// Nunca direcciones, nombres ni sitios. Si algo falla al medir, la app sigue igual.
type Value = string | number | boolean | null;
export function track(name: string, data?: Record<string, Value>) {
  try { vercelTrack(name, data); } catch { /* medir nunca rompe nada */ }
}
