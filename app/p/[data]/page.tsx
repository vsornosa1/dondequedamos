import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SharedProposal from '@/components/SharedProposal';
import { decodeProposal } from '@/lib/share.js';
import type { Proposal } from '@/lib/types';

type Params = { params: Promise<{ data: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = decodeProposal((await params).data) as Proposal | null;
  if (!p) return { title: '¿Dónde quedamos?' };
  const title = `¿Quedamos en ${p.name}?`;
  const description = `${p.people.map((x) => `${x.name}: ${x.min} min`).join(', ')}. El sitio más justo para todos.`;
  return { title, description, openGraph: { title, description, type: 'website', locale: 'es_ES' }, robots: { index: false } };
}

export default async function SharedPage({ params }: Params) {
  const p = decodeProposal((await params).data) as Proposal | null;
  if (!p) notFound();
  return <SharedProposal p={p} />;
}
