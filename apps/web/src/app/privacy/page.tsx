import { ReadingContainer } from '@church/ui/container';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/content/page-header';
import { getOrganization } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Privacy notice',
  description: 'What personal information the church collects on this site, why, and your rights.',
  alternates: { canonical: '/privacy' },
};

// Describes what the platform actually does. The church must review it (with its information
// officer) before launch; see docs/HANDOVER.md, open questions.
export default async function PrivacyPage() {
  const organization = await getOrganization();
  const contact = organization.email;
  return (
    <>
      <PageHeader
        title="Privacy notice"
        description={`How ${organization.name} looks after your personal information.`}
      />
      <ReadingContainer className="py-10">
        <div className="prose-church">
          <p>
            {organization.name} (“the church”, “we”) is the responsible party for personal
            information collected through this website. We process it in line with the Protection of
            Personal Information Act, 2013 (POPIA).
          </p>
          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Your account:</strong> name, e-mail address, password (stored only as a secure
              one-way hash), and anything you add to your profile such as a phone number or the
              branch you attend.
            </li>
            <li>
              <strong>Requests you send:</strong> for example a baptism enquiry (name, contact
              details, preferred date and your message) or a request to join a branch.
            </li>
            <li>
              <strong>Security records:</strong> the devices you sign in from (browser type and IP
              address) and a log of important account actions, used to protect your account.
            </li>
          </ul>
          <h2>Why we use it</h2>
          <ul>
            <li>To run your account and let you sign in securely.</li>
            <li>
              To pass your baptism enquiry or membership request to the branch you chose, so that
              someone can contact you.
            </li>
            <li>
              To send the notifications you have chosen. You can change these at any time in your
              account settings.
            </li>
            <li>To keep the site secure and prevent abuse.</li>
          </ul>
          <p>We do not sell your information and we do not use it for advertising.</p>
          <h2>Who can see it</h2>
          <p>
            Branch leaders and church administrators can see the details they need for their role,
            for example the leaders of the branch you asked to join. Our hosting and e-mail
            providers process information on our behalf under agreements that require them to
            protect it.
          </p>
          <h2>Cookies</h2>
          <p>
            We use only the cookies the site needs to work: one that keeps you signed in, one that
            protects forms against forgery, and preferences such as your chosen branch and light or
            dark theme. We do not use tracking or advertising cookies.
          </p>
          <h2>How long we keep it</h2>
          <p>
            We keep your account while it is active. Security records are kept for a limited time.
            Enquiries are kept for as long as the branch needs them to follow up.
          </p>
          <h2>Your rights</h2>
          <p>
            You may ask to see the personal information we hold about you, ask us to correct or
            delete it, or object to how we use it. You can update most details yourself in{' '}
            <Link href="/profile">your account</Link>.
            {contact ? (
              <>
                {' '}
                For anything else, write to <a href={`mailto:${contact}`}>{contact}</a>.
              </>
            ) : (
              ' For anything else, please speak to your branch.'
            )}{' '}
            You may also lodge a complaint with the Information Regulator of South Africa.
          </p>
        </div>
      </ReadingContainer>
    </>
  );
}
