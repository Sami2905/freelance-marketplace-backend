import mongoose, { Document, Schema } from 'mongoose';

export interface IConversation extends Document {
  order: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[];
  lastMessage?: mongoose.Types.ObjectId;
  unreadCount: number;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true,
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Ensure each order has only one conversation
conversationSchema.index({ order: 1 }, { unique: true });

// Index for faster querying of conversations by participant
conversationSchema.index({ participants: 1, updatedAt: -1 });

// Update the unread count when a new message is added
conversationSchema.pre('save', async function (next) {
  if (this.isModified('lastMessage') && this.lastMessage) {
    const Message = mongoose.model('Message');
    this.unreadCount = await Message.countDocuments({
      order: this.order,
      _id: { $ne: this.lastMessage },
      readBy: { $ne: this.lastMessage.sender },
    });
  }
  next();
});

const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);

export default Conversation;
