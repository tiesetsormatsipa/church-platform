import { ReadingContainer } from '@church/ui/container';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/content/page-header';
import { getOrganization } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The rules for using this website and your account.',
  alternates: { canonical: '/terms' },
};

// Plain-language terms; to be reviewed by the church before launch (docs/HANDOVER.md).
export default async function TermsPage() {
  const organization = await getOrganization();
  return (
    <>
      <PageHeader
        title="Terms of use"
        description={`Using the ${organization.shortName ?? organization.name} website.`}
      />
      <ReadingContainer className="py-10">
        <div className="prose-church">
          <p>
            This website is provided by {organization.name} to share news, events and sermons, and
            to help members stay connected with their branch. By creating an account you agree to
            these terms.
          </p>
          <h2>Your account</h2>
          <ul>
            <li>Give accurate details and keep your password to yourself.</li>
            <li>Tell us straight away if you think someone else has used your account.</li>
            <li>One account per person.</li>
          </ul>
          <h2>Using the site respectfully</h2>
          <p>
            Do not use the site to harass anyone, to share anything unlawful, or to try to get
            around its security. We may suspend accounts that are misused.
          </p>
          <h2>Content</h2>
          <p>
            Sermons, articles and photos on this site belong to the church or to the people who gave
            permission for them to be shared. You are welcome to share links to them; please ask
            before republishing them elsewhere.
          </p>
          <h2>Changes</h2>
          <p>
            We may update these terms from time to time. Significant changes will be announced on
            the site. How we handle personal information is described in the{' '}
            <Link href="/privacy">privacy notice</Link>.
          </p>
        </div>
      </ReadingContainer>
    </>
  );
}
