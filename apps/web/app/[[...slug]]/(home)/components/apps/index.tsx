import { cn } from '@/lib/utils';
import React from 'react';
import {
  BookIcon,
  CurlyBracesIcon,
  DatabaseIcon,
  GlobeIcon,
  LaptopIcon,
  MailIcon,
  ServerIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import ApiImage from './api.png';
import AppImage from './app.png';
import DocsImage from './docs.png';
import EmailImage from './email.png';
import StorybookImage from './storybook.png';
import StudioImage from './studio.png';
import WebImage from './web.png';

const apps: AppType[] = [
  {
    icon: DatabaseIcon,
    name: 'analytics',
    title: 'Analytics Dashboard',
    description:
      'Create custom analytics cards for specific tables and columns. Set up intelligent alerts and webhook triggers to Slack or Discord when your data hits important milestones or thresholds.',
  },
  {
    icon: CurlyBracesIcon,
    name: 'ai-queries',
    title: 'AI-Powered SQL Generation',
    description:
      'Write natural language prompts and watch them transform into optimized SQL queries. Perfect for both beginners learning SQL and experts who want to speed up their workflow.',
  },
  {
    icon: BookIcon,
    name: 'schema-explorer',
    title: 'Visual Schema Explorer',
    description:
      'Navigate your database structure with an intuitive visual interface. Explore table relationships, constraints, and indexes with interactive diagrams and real-time schema insights.',
  },
  {
    icon: ServerIcon,
    name: 'multi-platform',
    title: 'Universal Database Support',
    description:
      'Seamlessly connect to any database provider including Neon, Supabase, PlanetScale, AWS RDS, and VPS-hosted databases. One platform, all your data sources.',
  },
  {
    icon: GlobeIcon,
    name: 'real-time-monitoring',
    title: 'Real-Time Query Monitoring',
    description:
      'Monitor database performance with live query execution tracking, slow query detection, and automated performance optimization suggestions for your production databases.',
  },
  {
    icon: MailIcon,
    name: 'collaboration',
    title: 'Team Collaboration Hub',
    description:
      'Share queries, dashboards, and insights with your team. Comment on analyses, create shared workspaces, and maintain a centralized knowledge base of your database operations.',
    status: 'coming-soon',
  },
  {
    icon: LaptopIcon,
    name: 'insights-engine',
    title: 'Smart Data Insights',
    description:
      'Automatically discover patterns, anomalies, and trends in your data. Get intelligent recommendations for database optimization and data quality improvements.',
  },
];

type AppType = {
  icon: React.ComponentType<{ size?: number }>;
  name: string;
  title: string;
  description: string;
  status?: 'coming-soon';
};

const App = ({ app }: { app: AppType }) => (
  <div className="relative flex flex-col gap-8 overflow-hidden p-8 pb-5">
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <app.icon size={14} />
        <small>/features/{app.name}</small>
        {app.status === 'coming-soon' && (
            <Badge variant="secondary" className="text-[10px] bg-neutral-900/50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-500 border-neutral-800/90">
              Coming Soon
            </Badge>
          )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-2xl sm:truncate">{app.title}</h2>
        </div>
        <p className="text-balance text-muted-foreground sm:line-clamp-2">
          {app.description}
        </p>
      </div>
    </div>
    {/* <div className="h-48 overflow-hidden md:h-80">
      <Image
        alt=""
        src={app.image}
        className="h-auto w-full overflow-hidden rounded-md border object-cover object-left shadow-sm"
      />
    </div> */}
  </div>
);

export const Apps = () => (
  <section className="grid sm:grid-cols-2" id="apps">
    {apps.map((app, index) => (
      <div
        className={cn(
          index % 2 && 'sm:border-l',
          index > 0 && 'border-t sm:border-t-0',
          index > 1 && '!border-t'
        )}
        key={index}
      >
        <App app={app} />
      </div>
    ))}
    {apps.length % 2 === 1 && (
      <div className="h-full w-full border-t border-l bg-dashed" />
    )}
  </section>
);
