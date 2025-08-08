import { getMDXComponents } from '@/mdx-components';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/page';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { source } from '../../../lib/source';
import { baseOptions } from '../../layout.config';

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

const Page = async (props: PageProps) => {
  const params = await props.params;
  
  // If no slug provided (i.e., visiting /docs), redirect to main docs page
  if (!params.slug || params.slug.length === 0) {
    const indexPage = source.getPage(['index']);
    if (indexPage) {
      const page = indexPage;
      const MDX = page.data.body;

      return (
        <DocsLayout
          {...baseOptions}
          tree={source.pageTree}
          sidebar={{
            collapsible: false,
          }}
          nav={{
            ...baseOptions.nav,
            mode: 'top',
          }}
        >
          <DocsPage
            toc={page.data.toc}
            full={page.data.full}
            tableOfContent={{ style: 'clerk' }}
          >
            <DocsTitle>{page.data.title}</DocsTitle>
            <DocsDescription>{page.data.description}</DocsDescription>
            <DocsBody>
              <MDX
                components={getMDXComponents({
                  a: createRelativeLink(source, page),
                })}
              />
            </DocsBody>
          </DocsPage>
        </DocsLayout>
      );
    }
  }
  
  const page = source.getPage(params.slug);

  if (!page) {
    notFound();
  }

  const MDX = page.data.body;

  return (
    <DocsLayout
      {...baseOptions}
      tree={source.pageTree}
      sidebar={{
        collapsible: false,
      }}
      nav={{
        ...baseOptions.nav,
        mode: 'top',
      }}
    >
      <DocsPage
        toc={page.data.toc}
        full={page.data.full}
        tableOfContent={{ style: 'clerk' }}
      >
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsDescription>{page.data.description}</DocsDescription>
        <DocsBody>
          <MDX
            components={getMDXComponents({
              a: createRelativeLink(source, page),
            })}
          />
        </DocsBody>
      </DocsPage>
    </DocsLayout>
  );
};

export const generateStaticParams = async () => source.generateParams();

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) {
    notFound();
  }

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      title: page.data.title,
      description: page.data.description,
      type: 'website',
      images: [
        {
          url: `/og?slug=docs/${params.slug?.join('/') ?? ''}`,
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

export default Page; 