import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SharedProposal from '@/components/SharedProposal';
import { loadProposal } from '@/lib/shortlinks';
import type { Proposal } from '@/lib/types';

type Params = { params: Promise<{ data: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = (await loadProposal((await params).data)) as Proposal | null;
  if (!p) return { title: '¿Dónde quedamos?' };
  const title = `¿Quedamos en ${p.name}?`;
  const times = p.people.map((x) => `${x.name}: ${x.min} min`).join(', ');
  const description = p.trip?.min
    ? `${times}. Y luego, ${p.trip.min} min juntos hasta ${p.trip.name}.`
    : `${times}. El sitio más justo para todos.`;
  return { title, description, openGraph: { title, description, type: 'website', locale: 'es_ES' }, robots: { index: false } };
}

export default async function SharedPage({ params }: Params) {
  const p = (await loadProposal((await params).data)) as Proposal | null;
  if (!p) notFound();
  return <SharedProposal p={p} />;
}
