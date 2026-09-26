/**
 * Messaging between members.
 *
 * Ported from the old platform, which had conversations, participants and messages with a
 * context per thread. The store context waits for the marketplace (ADR-016), so a thread is
 * either PERSONAL or about a JOB.
 */
import { z } from 'zod';
import { Cursor, IsoDateTime, text, Uuid } from '../common.js';
import { ConversationContext } from '../enums.js';

export const MESSAGE_MAX = 4000;

/** Someone in a thread. Name and picture only: the directory never exposes contact details. */
export const MessagePerson = z.object({
  id: Uuid,
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
});
export type MessagePerson = z.infer<typeof MessagePerson>;

export const MessageDto = z.object({
  id: Uuid,
  body: z.string(),
  /** Null when the account behind the message is gone. */
  sender: MessagePerson.nullable(),
  mine: z.boolean(),
  createdAt: IsoDateTime,
  editedAt: IsoDateTime.nullable(),
});
export type MessageDto = z.infer<typeof MessageDto>;

export const ConversationSummary = z.object({
  id: Uuid,
  context: ConversationContext.schema,
  subject: z.string().nullable(),
  /** Everyone in the thread except you. */
  others: z.array(MessagePerson),
  lastMessage: z.object({ body: z.string(), createdAt: IsoDateTime, mine: z.boolean() }).nullable(),
  unread: z.number().int(),
});
export type ConversationSummary = z.infer<typeof ConversationSummary>;

export const ConversationList = z
  .object({ items: z.array(ConversationSummary), unreadTotal: z.number().int() })
  .meta({ id: 'ConversationList' });
export type ConversationList = z.infer<typeof ConversationList>;

export const ConversationsQuery = z.object({
  context: ConversationContext.schema.optional(),
  q: text(100).optional(),
});
export type ConversationsQuery = z.input<typeof ConversationsQuery>;

export const MessagesPage = z
  .object({
    conversation: ConversationSummary,
    /** Oldest first, so the thread reads downwards. */
    items: z.array(MessageDto),
    /** Cursor for the page of older messages before these. */
    olderCursor: z.string().nullable(),
  })
  .meta({ id: 'MessagesPage' });
export type MessagesPage = z.infer<typeof MessagesPage>;

export const MessagesQuery = z.object({
  before: Cursor.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type MessagesQuery = z.input<typeof MessagesQuery>;

export const StartConversation = z
  .object({ userId: Uuid, body: text(MESSAGE_MAX) })
  .meta({ id: 'StartConversation' });
export type StartConversation = z.input<typeof StartConversation>;

export const SendMessageRequest = z
  .object({ body: text(MESSAGE_MAX) })
  .meta({ id: 'SendMessageRequest' });
export type SendMessageRequest = z.input<typeof SendMessageRequest>;

export const MessageResult = z
  .object({ conversationId: Uuid, message: MessageDto })
  .meta({ id: 'MessageResult' });
export type MessageResult = z.infer<typeof MessageResult>;

export const UnreadMessages = z.object({ unread: z.number().int() }).meta({ id: 'UnreadMessages' });
export type UnreadMessages = z.infer<typeof UnreadMessages>;

/** A member you may write to: someone who worships at a branch you belong to. */
export const DirectoryEntry = MessagePerson.extend({ branchName: z.string().nullable() });
export type DirectoryEntry = z.infer<typeof DirectoryEntry>;

export const DirectoryList = z
  .object({ items: z.array(DirectoryEntry) })
  .meta({ id: 'DirectoryList' });
export type DirectoryList = z.infer<typeof DirectoryList>;

export const DirectoryQuery = z.object({
  q: text(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type DirectoryQuery = z.input<typeof DirectoryQuery>;
