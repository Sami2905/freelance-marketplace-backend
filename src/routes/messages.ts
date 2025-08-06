import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from '../middleware/auth';
import { uploadToS3 } from '../utils/s3';
import Message from '../models/Message';
import Conversation from '../models/Conversation';
import { Types } from 'mongoose';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Send a message
router.post(
  '/',
  verifyToken,
  upload.array('attachments', 5),
  async (req: any, res) => {
    try {
      const { content, orderId } = req.body;
      const senderId = req.user.id;

      if (!content && (!req.files || req.files.length === 0)) {
        return res.status(400).json({ message: 'Message content or attachment is required' });
      }

      // Process attachments if any
      let attachments = [];
      if (req.files && req.files.length > 0) {
        const uploadPromises = req.files.map(async (file: Express.Multer.File) => {
          const fileKey = `messages/${orderId}/${uuidv4()}-${file.originalname}`;
          const fileUrl = await uploadToS3(file.buffer, fileKey, file.mimetype);
          
          return {
            url: fileUrl,
            type: file.mimetype.startsWith('image/') ? 'image' :
                  file.mimetype.includes('pdf') || 
                  file.mimetype.includes('word') ? 'document' : 'other',
            name: file.originalname,
            size: file.size
          };
        });

        attachments = await Promise.all(uploadPromises);
      }

      // Create message
      const message = new Message({
        content: content || '',
        sender: senderId,
        order: orderId,
        attachments,
        readBy: [senderId]
      });

      await message.save();

      // Update conversation
      const conversation = await Conversation.findOneAndUpdate(
        { order: orderId },
        {
          $set: { lastMessage: message._id, updatedAt: new Date() },
          $addToSet: { participants: { $each: [senderId, req.body.recipientId] } },
          $inc: { unreadCount: 1 }
        },
        { upsert: true, new: true }
      );

      // Emit WebSocket event
      const populatedMessage = await Message.findById(message._id).populate('sender', 'name avatar');
      req.app.get('io').to(orderId).emit('newMessage', populatedMessage);

      res.status(201).json(populatedMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ message: 'Error sending message' });
    }
  }
);

// Get messages for a conversation
router.get('/', verifyToken, async (req: any, res) => {
  try {
    const { orderId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const messages = await Message.find({ order: orderId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string) + 1) // Fetch one extra to check if there are more
      .populate('sender', 'name avatar')
      .lean();

    const hasMore = messages.length > parseInt(limit as string);
    if (hasMore) {
      messages.pop(); // Remove the extra item
    }

    // Mark messages as read
    const unreadMessageIds = messages
      .filter((msg: any) => 
        !msg.readBy.includes(new Types.ObjectId(req.user.id)) && 
        msg.sender._id.toString() !== req.user.id
      )
      .map((msg: any) => msg._id);

    if (unreadMessageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadMessageIds } },
        { $addToSet: { readBy: req.user.id } }
      );

      // Update conversation unread count
      await Conversation.updateOne(
        { order: orderId },
        { $inc: { unreadCount: -unreadMessageIds.length } }
      );

      // Emit read receipt
      req.app.get('io').to(orderId).emit('messagesRead', {
        orderId,
        messageIds: unreadMessageIds,
        readerId: req.user.id
      });
    }

    res.json({
      messages: messages.reverse(), // Return in chronological order
      hasMore
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Get all conversations for the current user
router.get('/conversations', verifyToken, async (req: any, res) => {
  try {
    const conversations = await Conversation.aggregate([
      { $match: { participants: new Types.ObjectId(req.user.id) } },
      {
        $lookup: {
          from: 'messages',
          localField: 'lastMessage',
          foreignField: '_id',
          as: 'lastMessage'
        }
      },
      { $unwind: { path: '$lastMessage', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'participants',
          foreignField: '_id',
          as: 'participantsData'
        }
      },
      {
        $addFields: {
          otherUser: {
            $filter: {
              input: '$participantsData',
              as: 'user',
              cond: { $ne: ['$$user._id', new Types.ObjectId(req.user.id)] }
            }
          },
          lastMessage: {
            $ifNull: [
              {
                $mergeObjects: [
                  '$lastMessage',
                  {
                    sender: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$participantsData',
                            as: 'user',
                            cond: { $eq: ['$$user._id', '$lastMessage.sender'] }
                          }
                        },
                        0
                      ]
                    }
                  }
                ]
              },
              null
            ]
          }
        }
      },
      {
        $project: {
          _id: 1,
          order: 1,
          unreadCount: 1,
          updatedAt: 1,
          'lastMessage._id': 1,
          'lastMessage.content': 1,
          'lastMessage.sender._id': 1,
          'lastMessage.sender.name': 1,
          'lastMessage.sender.avatar': 1,
          'lastMessage.createdAt': 1,
          'otherUser._id': 1,
          'otherUser.name': 1,
          'otherUser.avatar': 1
        }
      },
      { $sort: { updatedAt: -1 } }
    ]);

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Error fetching conversations' });
  }
});

// Mark messages as read
router.post('/mark-as-read', verifyToken, async (req: any, res) => {
  try {
    const { orderId, messageIds } = req.body;
    
    if (!orderId || !messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    // Mark messages as read
    await Message.updateMany(
      { _id: { $in: messageIds }, sender: { $ne: req.user.id } },
      { $addToSet: { readBy: req.user.id } }
    );

    // Update conversation unread count
    const unreadCount = await Message.countDocuments({
      order: orderId,
      readBy: { $ne: req.user.id },
      sender: { $ne: req.user.id }
    });

    await Conversation.updateOne(
      { order: orderId },
      { $set: { unreadCount } }
    );

    // Emit WebSocket event
    req.app.get('io').to(orderId).emit('messagesRead', {
      orderId,
      messageIds,
      readerId: req.user.id
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Error marking messages as read' });
  }
});

export default router;
