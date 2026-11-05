import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Card, Meta } from '../../components/ui';
import { IconClock } from '../../components/ui/icons';
import { GUIDES } from './content';
import { AdSlot, Prose, PublicPage } from './PublicLayout';
import { usePageMeta } from './usePageMeta';
import { NotFoundPage } from './InfoPages';

export const HelpIndexPage: React.FC = () => {
  usePageMeta({ title: 'Help and guides', description: 'Step-by-step guides for teachers and students: classrooms, tests, proctoring, attendance and results.', path: '/help' });
  return (
    <PublicPage wide title="Help and guides" intro="Short, practical guides to running a class with NeuroClass, whether you teach or study.">
      <ul className="grid gap-4 sm:grid-cols-2">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Card as="article" variant="interactive" className="relative flex h-full flex-col">
              <div className="flex items-center gap-2"><Badge tone={g.audience === 'Teachers' ? 'primary' : g.audience === 'Students' ? 'success' : 'neutral'}>{g.audience}</Badge><Meta icon={<IconClock size={16} />}>{g.minutes} min read</Meta></div>
              <h2 className="mt-3 text-card text-ink">
                <Link to={`/help/${g.slug}`} className="focus-ring rounded-control after:absolute after:inset-0 after:content-[''] hover:text-primary hover:underline">{g.title}</Link>
              </h2>
              <p className="mt-1 text-support text-ink-2">{g.description}</p>
            </Card>
          </li>
        ))}
      </ul>
    </PublicPage>
  );
};

export const GuidePage: React.FC = () => {
  const { slug } = useParams();
  const guide = GUIDES.find((g) => g.slug === slug);
  usePageMeta(guide ? { title: guide.title, description: guide.description, path: `/help/${guide.slug}`, type: 'article' } : { title: 'Page not found', noindex: true });
  if (!guide) return <NotFoundPage />;
  const others = GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 3);
  return (
    <PublicPage
      title={guide.title}
      intro={guide.description}
      crumbs={[{ label: 'Help', href: '/help' }, { label: guide.title }]}
      meta={<>For {guide.audience.toLowerCase()} · {guide.minutes} min read</>}
    >
      <Prose>
        {guide.sections.map((s, i) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            {s.paragraphs?.map((p) => <p key={p} className="mt-3">{p}</p>)}
            {s.steps && <ol className="mt-3">{s.steps.map((t) => <li key={t}>{t}</li>)}</ol>}
            {s.bullets && <ul className="mt-3">{s.bullets.map((t) => <li key={t}>{t}</li>)}</ul>}
            {i === 1 && <AdSlot />}
          </section>
        ))}
      </Prose>
      <nav aria-labelledby="more-guides" className="mt-12 border-t border-line pt-6">
        <h2 id="more-guides" className="text-card text-ink">More guides</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {others.map((g) => <li key={g.slug}><Link className="focus-ring rounded-control text-body text-primary hover:underline" to={`/help/${g.slug}`}>{g.title}</Link></li>)}
        </ul>
      </nav>
    </PublicPage>
  );
};
