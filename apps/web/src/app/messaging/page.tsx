// apps/web/src/app/messaging/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Send, Paperclip, MessageSquare, ShoppingBag,
  Briefcase, User, Clock, Check, CheckCheck, X, Plus,
  MoreVertical, Phone, Info,
} from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';

type MessagingTab = 'members' | 'market' | 'jobs';

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d))     return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'dd/MM/yyyy');
}

function ConversationItem({
  conv,
  isActive,
  onClick,
  currentUserId,
}: {
  conv: any;
  isActive: boolean;
  onClick: () => void;
  currentUserId: string;
}) {
  const otherParticipant = conv.participants?.find((p: any) => p.userId !== currentUserId);
  const lastMsg = conv.lastMessage;
  const unreadCount = conv.unreadCount || 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all duration-150',
        'border-b border-charcoal-50 hover:bg-gold/5',
        isActive ? 'bg-gold/8 border-l-2 border-l-gold' : '',
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-11 h-11 rounded-full bg-navy-gradient flex items-center justify-center overflow-hidden">
          {otherParticipant?.user?.profile?.profilePictureUrl ? (
            <img
              src={otherParticipant.user.profile.profilePictureUrl}
              className="w-full h-full object-cover"
              alt=""
            />
          ) : (
            <span className="text-white font-heading font-bold text-sm">
              {otherParticipant?.user?.profile?.firstName?.[0] || '?'}
            </span>
          )}
        </div>
        {/* Online indicator */}
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1 mb-0.5">
          <span className={cn('font-body font-semibold text-sm truncate', isActive ? 'text-navy' : 'text-charcoal-800')}>
            {conv.title || otherParticipant?.user?.profile?.firstName || 'Conversation'}
          </span>
          <span className="text-[11px] text-charcoal-400 font-body flex-shrink-0">
            {lastMsg ? formatMsgTime(lastMsg.createdAt) : ''}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs text-charcoal-400 font-body truncate">
            {lastMsg?.content || 'No messages yet'}
          </p>
          {unreadCount > 0 && (
            <span className="flex-shrink-0 min-w-[18px] h-[18px] bg-gold text-navy text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ message, isOwn, showAvatar }: { message: any; isOwn: boolean; showAvatar: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cn('flex items-end gap-2 mb-1', isOwn ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      {!isOwn && (
        <div className="w-7 h-7 rounded-full bg-navy/20 flex items-center justify-center flex-shrink-0 mb-1">
          {showAvatar ? (
            <span className="text-navy text-xs font-bold">
              {message.sender?.profile?.firstName?.[0] || '?'}
            </span>
          ) : (
            <div className="w-full h-full" />
          )}
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[72%] sm:max-w-[60%] px-4 py-2.5 rounded-2xl text-sm font-body',
          'shadow-sm relative',
          isOwn
            ? 'bg-navy text-white rounded-br-sm'
            : 'bg-white text-charcoal-800 border border-charcoal-100 rounded-bl-sm',
        )}
      >
        {/* System message */}
        {message.isSystem && (
          <span className="italic opacity-70">{message.content}</span>
        )}

        {/* Regular message */}
        {!message.isSystem && <p className="leading-relaxed">{message.content}</p>}

        {/* Attachment */}
        {message.attachments?.length > 0 && (
          <div className="mt-2 border-t border-white/10 pt-2">
            {message.attachments.map((att: any) => (
              <a
                key={att.id}
                href={att.mediaAsset?.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs hover:underline"
              >
                <Paperclip className="w-3 h-3" />
                {att.mediaAsset?.originalName}
              </a>
            ))}
          </div>
        )}

        {/* Timestamp + read state */}
        <div className={cn('flex items-center justify-end gap-1 mt-1', isOwn ? 'text-white/50' : 'text-charcoal-400')}>
          <span className="text-[10px]">{format(new Date(message.createdAt), 'HH:mm')}</span>
          {isOwn && (
            message.readAt
              ? <CheckCheck className="w-3 h-3 text-gold" />
              : <Check className="w-3 h-3" />
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function MessagingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const socket = useSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab]   = useState<MessagingTab>('members');
  const [search, setSearch]         = useState('');
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messageText, setMessageText]   = useState('');
  const [isTyping, setIsTyping]     = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Conversations list
  const { data: conversations } = useQuery({
    queryKey: ['conversations', activeTab, search],
    queryFn: () =>
      api.get('/api/v1/messaging/conversations', {
        params: { tab: activeTab, search: search || undefined },
      }).then((r) => r.data),
    refetchInterval: 30000,
  });

  // Messages for active conversation
  const { data: messages, isLoading: msgsLoading } = useQuery({
    queryKey: ['messages', activeConvId],
    queryFn: () =>
      api.get(`/api/v1/messaging/conversations/${activeConvId}/messages`).then((r) => r.data),
    enabled: !!activeConvId,
  });

  const sendMutation = useMutation({
    mutationFn: (data: { content: string; conversationId: string }) =>
      api.post('/api/v1/messaging/messages', data).then((r) => r.data),
    onSuccess: () => {
      setMessageText('');
      qc.invalidateQueries({ queryKey: ['messages', activeConvId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Real-time messages via socket
  useEffect(() => {
    if (!socket || !activeConvId) return;
    socket.on('new_message', (msg: any) => {
      if (msg.conversationId === activeConvId) {
        qc.invalidateQueries({ queryKey: ['messages', activeConvId] });
        // Mark as read
        socket.emit('mark_read', { conversationId: activeConvId });
      }
      qc.invalidateQueries({ queryKey: ['conversations'] });
    });
    return () => { socket.off('new_message'); };
  }, [socket, activeConvId, qc]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!messageText.trim() || !activeConvId) return;
    sendMutation.mutate({ content: messageText.trim(), conversationId: activeConvId });
  }, [messageText, activeConvId, sendMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeConv = conversations?.find((c: any) => c.id === activeConvId);
  const convMessages = messages || [];

  const TABS = [
    { key: 'members', label: 'Members',    icon: User       },
    { key: 'market',  label: 'Marketplace', icon: ShoppingBag },
    { key: 'jobs',    label: 'Jobs',        icon: Briefcase  },
  ];

  return (
    <div className="pt-16 h-screen flex flex-col bg-gray-50">
      <div className="flex-1 max-w-7xl mx-auto w-full px-0 sm:px-4 lg:px-6 py-0 sm:py-4 flex flex-col overflow-hidden">
        <div className="flex-1 flex rounded-none sm:rounded-2xl overflow-hidden border border-charcoal-100 shadow-card bg-white">
          {/* Left sidebar — conversation list */}
          <div
            className={cn(
              'w-full sm:w-80 lg:w-96 flex-shrink-0 border-r border-charcoal-100 flex flex-col',
              mobileView === 'chat' ? 'hidden sm:flex' : 'flex',
            )}
          >
            {/* Sidebar header */}
            <div className="px-4 pt-4 pb-2 border-b border-charcoal-50">
              <h2 className="font-heading font-bold text-navy text-xl mb-3">Messages</h2>

              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
                <input
                  type="text"
                  placeholder="Search messages, orders..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-charcoal-200 rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-gold/30"
                />
              </div>

              {/* Tabs */}
              <div className="flex gap-1">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as MessagingTab)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-body font-medium transition-all',
                        activeTab === tab.key
                          ? 'bg-navy text-white'
                          : 'text-charcoal-500 hover:bg-charcoal-50',
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Conversations list */}
            <div className="flex-1 overflow-y-auto">
              {(conversations || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <MessageSquare className="w-10 h-10 text-charcoal-200 mb-3" />
                  <p className="font-body text-charcoal-400 text-sm">No conversations yet</p>
                </div>
              ) : (
                (conversations || []).map((conv: any) => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    isActive={conv.id === activeConvId}
                    currentUserId={user?.id}
                    onClick={() => {
                      setActiveConvId(conv.id);
                      setMobileView('chat');
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right — chat area */}
          <div
            className={cn(
              'flex-1 flex flex-col',
              mobileView === 'list' ? 'hidden sm:flex' : 'flex',
            )}
          >
            {activeConvId && activeConv ? (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-charcoal-100 bg-white">
                  {/* Back button on mobile */}
                  <button
                    className="sm:hidden text-charcoal-500 hover:text-navy mr-1"
                    onClick={() => setMobileView('list')}
                  >
                    ←
                  </button>

                  <div className="w-9 h-9 rounded-full bg-navy-gradient flex items-center justify-center">
                    <span className="text-white text-sm font-bold">
                      {activeConv.title?.[0] || '?'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-body font-semibold text-navy text-sm truncate">
                      {activeConv.title || 'Conversation'}
                    </p>
                    {activeConv.orderId && (
                      <p className="text-xs text-charcoal-400 font-body">
                        Order #{activeConv.orderId?.slice(0, 8)}
                      </p>
                    )}
                    {activeConv.jobId && (
                      <p className="text-xs text-charcoal-400 font-body">
                        Job #{activeConv.jobId?.slice(0, 8)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button className="p-2 text-charcoal-400 hover:text-navy transition-colors rounded-lg hover:bg-charcoal-50">
                      <Info className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-charcoal-400 hover:text-navy transition-colors rounded-lg hover:bg-charcoal-50">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50/50">
                  {msgsLoading ? (
                    <div className="flex justify-center items-center h-full">
                      <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : convMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <MessageSquare className="w-10 h-10 text-charcoal-200 mb-2" />
                      <p className="font-body text-charcoal-400 text-sm">No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    <>
                      {convMessages.map((msg: any, i: number) => (
                        <MessageBubble
                          key={msg.id}
                          message={msg}
                          isOwn={msg.senderId === user?.id}
                          showAvatar={i === 0 || convMessages[i - 1]?.senderId !== msg.senderId}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Input area */}
                <div className="px-4 py-3 bg-white border-t border-charcoal-100">
                  <div className="flex items-end gap-2">
                    {/* Attachment — PDF only */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 text-charcoal-400 hover:text-navy transition-colors rounded-xl hover:bg-charcoal-50 flex-shrink-0"
                      title="Attach PDF (max 500 KB)"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                    />

                    {/* Text input */}
                    <div className="flex-1 relative">
                      <textarea
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        rows={1}
                        className="w-full px-4 py-2.5 border border-charcoal-200 rounded-xl text-sm font-body focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/50 resize-none overflow-hidden transition-all max-h-32"
                        style={{ minHeight: '44px' }}
                      />
                    </div>

                    {/* Send */}
                    <button
                      onClick={handleSend}
                      disabled={!messageText.trim() || sendMutation.isPending}
                      className={cn(
                        'p-2.5 rounded-xl transition-all flex-shrink-0',
                        messageText.trim()
                          ? 'bg-navy text-white hover:bg-navy-700 shadow-navy'
                          : 'bg-charcoal-100 text-charcoal-400 cursor-not-allowed',
                      )}
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-charcoal-300 font-body mt-1.5 text-center">
                    PDF attachments only · Max 500 KB
                  </p>
                </div>
              </>
            ) : (
              /* Empty state */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 rounded-2xl bg-navy/5 flex items-center justify-center mb-4">
                  <MessageSquare className="w-10 h-10 text-charcoal-200" />
                </div>
                <h3 className="font-heading text-xl text-navy mb-2">Your Messages</h3>
                <p className="font-body text-charcoal-400 text-sm max-w-xs">
                  Select a conversation from the list to start messaging, or connect with
                  members, buyers, and job applicants.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
