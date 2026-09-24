import { describe, expect, it } from 'vitest';
import { EmailMessage } from '@church/shared';
import { escapeHtml } from './layout.js';
import { renderEmail } from './templates.js';

const context = { churchName: 'First Church' };

/** One valid message per template, so the table below covers the whole union. */
const MESSAGES = {
  'verify-email': {
    template: 'verify-email',
    to: 'sam@example.org',
    data: { firstName: 'Sam', verifyUrl: 'https://church.example/verify-email?token=abc' },
  },
  'account-exists': {
    template: 'account-exists',
    to: 'sam@example.org',
    data: {
      firstName: 'Sam',
      signInUrl: 'https://church.example/sign-in',
      resetUrl: 'https://church.example/forgot-password',
    },
  },
  'password-reset': {
    template: 'password-reset',
    to: 'sam@example.org',
    data: {
      firstName: 'Sam',
      resetUrl: 'https://church.example/reset-password?token=abc',
      expiresInMinutes: 60,
    },
  },
  'password-changed': {
    template: 'password-changed',
    to: 'sam@example.org',
    data: { firstName: 'Sam' },
  },
  'membership-decided': {
    template: 'membership-decided',
    to: 'sam@example.org',
    data: { firstName: 'Sam', branchName: 'Johannesburg', approved: true, note: null },
  },
  'baptism-request-confirmation': {
    template: 'baptism-request-confirmation',
    to: 'sam@example.org',
    data: { fullName: 'Sam Dlamini', branchName: 'Johannesburg' },
  },
  'baptism-request-received': {
    template: 'baptism-request-received',
    to: 'admin@example.org',
    data: {
      branchName: 'Johannesburg',
      fullName: 'Sam Dlamini',
      manageUrl: 'https://church.example/admin/baptism',
    },
  },
  notification: {
    template: 'notification',
    to: 'sam@example.org',
    data: {
      firstName: 'Sam',
      title: 'Annual convention announced',
      body: 'Join us in September.',
      url: 'https://church.example/events/annual-convention',
      preferencesUrl: 'https://church.example/profile/notifications',
    },
  },
} as const satisfies Record<EmailMessage['template'], EmailMessage>;

describe('renderEmail', () => {
  it('covers every template in the EmailMessage union', () => {
    const covered = Object.keys(MESSAGES).sort();
    const defined = EmailMessage.options.map((o) => o.shape.template.value).sort();
    expect(covered).toEqual(defined);
  });

  it.each(Object.entries(MESSAGES))('renders %s', (name, message) => {
    const rendered = renderEmail(EmailMessage.parse(message), context);
    expect(rendered.subject).toContain('First Church');
    expect(rendered.subject.length).toBeLessThanOrEqual(300);
    expect(rendered.text.trim()).not.toBe('');
    expect(rendered.html).toContain('<!doctype html>');
    expect(rendered.html).toContain('First Church');
    // The text version must carry the same information, including any action link.
    if ('verifyUrl' in message.data) expect(rendered.text).toContain(message.data.verifyUrl);
    expect(name).toBe(message.template);
  });

  it('greets a person without a first name without a dangling space', () => {
    const rendered = renderEmail(
      EmailMessage.parse({
        template: 'password-changed',
        to: 'sam@example.org',
        data: { firstName: '' },
      }),
      context,
    );
    expect(rendered.text).toContain('Hello,');
    expect(rendered.text).not.toContain('Hello ,');
  });

  it('includes the decision note when a membership is declined', () => {
    const rendered = renderEmail(
      EmailMessage.parse({
        template: 'membership-decided',
        to: 'sam@example.org',
        data: {
          firstName: 'Sam',
          branchName: 'Cape Town',
          approved: false,
          note: 'Please speak to Pastor N first.',
        },
      }),
      context,
    );
    expect(rendered.text).toContain('Please speak to Pastor N first.');
    expect(rendered.text).not.toContain('Welcome');
  });

  it('escapes HTML in values that come from people', () => {
    const rendered = renderEmail(
      EmailMessage.parse({
        template: 'membership-decided',
        to: 'sam@example.org',
        data: {
          firstName: '<script>alert(1)</script>',
          branchName: 'Durban',
          approved: true,
          note: null,
        },
      }),
      context,
    );
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;');
  });
});

describe('escapeHtml', () => {
  it('escapes the five significant characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
});
