/**
 * Renders every `EmailMessage` variant to a subject, plain text and HTML.
 *
 * Wording rules: address the person by first name, say plainly what happened and what to
 * do, and never include tokens in the visible text (only inside the action URL).
 */
import type { EmailMessage } from '@church/shared';
import { renderHtml, renderText, type LayoutOptions } from './layout.js';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export interface TemplateContext {
  /** Name of the church, used in the subject line and the e-mail header. */
  churchName: string;
}

type Content = Omit<LayoutOptions, 'churchName'> & { subject: string };

/** "there" keeps the greeting natural when a profile has no first name. */
function greet(firstName: string): string {
  const name = firstName.trim();
  return name ? `Hello ${name},` : 'Hello,';
}

function minutes(count: number): string {
  return count === 1 ? '1 minute' : `${count} minutes`;
}

function build(message: EmailMessage, church: string): Content {
  switch (message.template) {
    case 'verify-email': {
      const { firstName, verifyUrl } = message.data;
      return {
        subject: `Confirm your e-mail address`,
        heading: 'Confirm your e-mail address',
        paragraphs: [
          greet(firstName),
          `Welcome to ${church}. Please confirm this address so we know we can reach you.`,
        ],
        action: { label: 'Confirm my e-mail address', url: verifyUrl },
        footnotes: [
          'This link can be used once and expires after a day.',
          `If you did not create an account with ${church}, you can ignore this message.`,
        ],
      };
    }
    case 'account-exists': {
      const { firstName, signInUrl, resetUrl } = message.data;
      return {
        subject: 'You already have an account',
        heading: 'You already have an account',
        paragraphs: [
          greet(firstName),
          `Someone tried to create a ${church} account with this e-mail address, but it is already registered. You can sign in with your existing password.`,
          `If you have forgotten it, you can set a new one here: ${resetUrl}`,
        ],
        action: { label: 'Sign in', url: signInUrl },
        footnotes: ['If this was not you, nothing has changed and your account is unaffected.'],
      };
    }
    case 'password-reset': {
      const { firstName, resetUrl, expiresInMinutes } = message.data;
      return {
        subject: 'Reset your password',
        heading: 'Reset your password',
        paragraphs: [
          greet(firstName),
          `We received a request to reset the password for your ${church} account.`,
          `This link works once and expires in ${minutes(expiresInMinutes)}.`,
        ],
        action: { label: 'Choose a new password', url: resetUrl },
        footnotes: [
          'If you did not ask for this, you can ignore this message: your password stays as it is.',
        ],
      };
    }
    case 'password-changed': {
      const { firstName } = message.data;
      return {
        subject: 'Your password was changed',
        heading: 'Your password was changed',
        paragraphs: [
          greet(firstName),
          `The password for your ${church} account has just been changed, and you have been signed out everywhere else.`,
        ],
        footnotes: [
          'If this was not you, reset your password immediately and contact the church office.',
        ],
      };
    }
    case 'membership-decided': {
      const { firstName, branchName, approved, note } = message.data;
      const paragraphs = [
        greet(firstName),
        approved
          ? `Your request to join the ${branchName} branch has been approved. Welcome.`
          : `Your request to join the ${branchName} branch was not approved this time.`,
      ];
      if (note) paragraphs.push(`Message from the branch: ${note}`);
      if (!approved) {
        paragraphs.push(
          'If you think this was a mistake, please speak to someone at the branch and you can ask again.',
        );
      }
      return {
        subject: approved
          ? `You have joined ${branchName}`
          : `About your request to join ${branchName}`,
        heading: approved ? `Welcome to ${branchName}` : `Your ${branchName} membership request`,
        paragraphs,
        footnotes: ['You receive this because it concerns your account.'],
      };
    }
    case 'notification': {
      const { firstName, title, body, url, preferencesUrl } = message.data;
      const paragraphs = [greet(firstName), title];
      if (body) paragraphs.push(body);
      return {
        subject: title,
        heading: title,
        paragraphs,
        ...(url ? { action: { label: 'Read more', url } } : {}),
        footnotes: [`Choose which e-mails you receive: ${preferencesUrl}`],
      };
    }
  }
}

export function renderEmail(message: EmailMessage, context: TemplateContext): RenderedEmail {
  const { subject, ...content } = build(message, context.churchName);
  const layout: LayoutOptions = { churchName: context.churchName, ...content };
  return {
    subject: `${subject} · ${context.churchName}`,
    text: renderText(layout),
    html: renderHtml(layout),
  };
}
