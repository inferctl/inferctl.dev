import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './.docs-build' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    bucket: z.enum(['guides', 'concepts', 'project']),
    order: z.number(),
  }),
});

export const collections = { docs };
