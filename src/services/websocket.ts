import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from '../middleware/auth';
import Message from '../models/Message';

interface UserSocket extends Socket {
  userId?: string;
}

class WebSocketService {
  private io: SocketIOServer;
  private userSockets: Map<string, string> = new Map(); // userId -> socketId

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    this.io.use((socket: UserSocket, next) => {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      try {
        const decoded = verifyToken(token);
        socket.userId = decoded.id;
        next();
      } catch (error) {
        console.error('WebSocket authentication error:', error);
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: UserSocket) => {
      if (!socket.userId) return;

      console.log(`User ${socket.userId} connected with socket ${socket.id}`);
      this.userSockets.set(socket.userId, socket.id);

      // Join order rooms for real-time updates
      socket.on('joinOrder', (orderId: string) => {
        socket.join(orderId);
        console.log(`User ${socket.userId} joined order ${orderId}`);
      });

      // Leave order room
      socket.on('leaveOrder', (orderId: string) => {
        socket.leave(orderId);
        console.log(`User ${socket.userId} left order ${orderId}`);
      });

      // Typing indicator
      socket.on('typing', (data: { orderId: string; isTyping: boolean }) => {
        if (data.isTyping) {
          socket.to(data.orderId).emit('userTyping', {
            userId: socket.userId,
            isTyping: true,
          });
        } else {
          socket.to(data.orderId).emit('userTyping', {
            userId: socket.userId,
            isTyping: false,
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected`);
        if (socket.userId) {
          this.userSockets.delete(socket.userId);
        }
      });
    });
  }

  // Get the Socket.IO instance
  public getIO() {
    return this.io;
  }

  // Get socket ID for a user
  public getSocketId(userId: string): string | undefined {
    return this.userSockets.get(userId);
  }

  // Send a message to a specific user
  public sendToUser(userId: string, event: string, data: any) {
    const socketId = this.getSocketId(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  // Broadcast a message to all users in an order room
  public broadcastToOrder(orderId: string, event: string, data: any) {
    this.io.to(orderId).emit(event, data);
  }

  // Notify users about a new message
  public async notifyNewMessage(message: any) {
    const populatedMessage = await Message.findById(message._id).populate('sender', 'name avatar');
    this.broadcastToOrder(
      message.order.toString(),
      'newMessage',
      populatedMessage
    );
  }

  // Notify users about read receipts
  public notifyMessagesRead(orderId: string, messageIds: string[], readerId: string) {
    this.broadcastToOrder(orderId, 'messagesRead', {
      orderId,
      messageIds,
      readerId,
    });
  }

  // Notify users about typing status
  public notifyTyping(orderId: string, userId: string, isTyping: boolean) {
    this.broadcastToOrder(orderId, 'userTyping', {
      userId,
      isTyping,
    });
  }
}

export default WebSocketService;
