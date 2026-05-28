import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class EmailAdapter {
  private readonly logger = new Logger(EmailAdapter.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService, private prisma: PrismaService) {
    this.transporter = nodemailer.createTransport({
      host:   this.config.get<string>('email.host',   'localhost'),
      port:   parseInt(this.config.get<string>('email.port', '1025'), 10),
      secure: this.config.get<boolean>('email.secure', false),
      auth: this.config.get<string>('email.user')
        ? { user: this.config.get<string>('email.user'), pass: this.config.get<string>('email.pass') }
        : undefined,
    } as any);
  }

  async sendFromTemplate(slug: string, to: string, variables: Record<string, string>, options?: { orderId?: string }) {
    const template = await this.prisma.emailTemplate.findUnique({ where: { slug } });
    if (!template) { this.logger.warn(`Email template not found: ${slug}`); return; }

    let subject = template.subject;
    let html    = template.htmlBody;
    for (const [key, val] of Object.entries(variables)) {
      subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), val);
      html    = html.replace(new RegExp(`{{${key}}}`, 'g'), val);
    }

    await this.send({ to, subject, html, templateSlug: slug, orderId: options?.orderId });
  }

  async send(payload: { to: string; subject: string; html: string; text?: string; templateSlug?: string; orderId?: string; attachments?: any[] }) {
    const from = `"${this.config.get('email.fromName', 'Church Platform')}" <${this.config.get('email.from', 'noreply@church.org')}>`;
    const log = await this.prisma.emailLog.create({
      data: { toEmail: payload.to, subject: payload.subject, templateSlug: payload.templateSlug, orderId: payload.orderId, status: 'QUEUED', attempts: 0 },
    });
    try {
      await this.transporter.sendMail({ from, to: payload.to, subject: payload.subject, html: payload.html, text: payload.text });
      await this.prisma.emailLog.update({ where: { id: log.id }, data: { status: 'SENT', sentAt: new Date(), attempts: 1 } });
      this.logger.log(`Email sent to ${payload.to}: ${payload.subject}`);
    } catch (err) {
      await this.prisma.emailLog.update({ where: { id: log.id }, data: { status: 'FAILED', failedAt: new Date(), error: String(err), attempts: 1 } });
      this.logger.error(`Failed to send email to ${payload.to}: ${err}`);
      throw err;
    }
  }
}
