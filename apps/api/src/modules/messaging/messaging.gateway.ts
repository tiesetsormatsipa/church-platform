import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, WsException } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MessagingService } from './messaging.service';

@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }, namespace: '/messaging' })
export class MessagingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MessagingGateway.name);
  private server: Server;
  private userSocketMap = new Map<string, string[]>();

  constructor(private messagingService: MessagingService, private jwtService: JwtService) {}

  afterInit(server: Server) { this.server = server; this.logger.log('Messaging WebSocket gateway initialized'); }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) { client.disconnect(); return; }
      const payload = this.jwtService.verify(token) as any;
      client.data.userId = payload.sub;
      const existing = this.userSocketMap.get(payload.sub) || [];
      this.userSocketMap.set(payload.sub, [...existing, client.id]);
      const convIds = await this.messagingService.getUserConversationIds(payload.sub);
      for (const convId of convIds) client.join(`conversation:${convId}`);
      client.join(`user:${payload.sub}`);
      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub})`);
    } catch { client.disconnect(); }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      const sockets = (this.userSocketMap.get(userId) || []).filter((id) => id !== client.id);
      if (sockets.length === 0) this.userSocketMap.delete(userId);
      else this.userSocketMap.set(userId, sockets);
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string; content: string; type?: string }) {
    const userId = client.data.userId;
    if (!userId) throw new WsException('Unauthorized');
    const message = await this.messagingService.sendMessage({ ...body, senderId: userId });
    this.server.to(`conversation:${body.conversationId}`).emit('new_message', message);
    const participants = await this.messagingService.getConversationParticipants(body.conversationId);
    for (const p of participants) {
      if (p.userId !== userId) this.server.to(`user:${p.userId}`).emit('notification', { type: 'NEW_MESSAGE', conversationId: body.conversationId });
    }
    return message;
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }) {
    const userId = client.data.userId;
    if (!userId) throw new WsException('Unauthorized');
    await this.messagingService.markConversationRead(body.conversationId, userId);
    return { success: true };
  }

  @SubscribeMessage('typing')
  handleTyping(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string; isTyping: boolean }) {
    client.to(`conversation:${body.conversationId}`).emit('user_typing', { userId: client.data.userId, isTyping: body.isTyping });
  }

  emitToUser(userId: string, event: string, data: any) { this.server.to(`user:${userId}`).emit(event, data); }
}
