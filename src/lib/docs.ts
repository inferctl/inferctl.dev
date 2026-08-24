import { getCollection } from 'astro:content';

export const bucketInfo = {
  guides: {
    label: 'Guides',
    description: 'Installation, commands, agent workflows, and examples.',
  },
  concepts: {
    label: 'Concepts',
    description: 'How inferctl fits into a local inference stack.',
  },
  project: {
    label: 'Project',
    description: 'Project status, security, releases, and comparison notes.',
  },
} as const;

export async function getDocs() {
  return (await getCollection('docs')).sort((a, b) =>
    a.data.bucket.localeCompare(b.data.bucket) ||
    a.data.order - b.data.order ||
    a.data.title.localeCompare(b.data.title),
  );
}

export async function getDocsByBucket() {
  const docs = await getDocs();
  return Object.entries(bucketInfo).map(([id, info]) => ({
    id,
    ...info,
    docs: docs.filter((doc) => doc.data.bucket === id),
  }));
}
