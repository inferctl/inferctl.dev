import { siteConfig } from './site-config';

export async function fetchChangelog(): Promise<string | null> {
  const repo = process.env.INFERCTL_DOCS_REPO ?? siteConfig.docsRepo;
  const ref = process.env.INFERCTL_DOCS_REF ?? siteConfig.docsRef;
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/${repo}/${ref}/CHANGELOG.md`,
    );
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}
