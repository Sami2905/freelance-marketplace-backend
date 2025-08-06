import express from 'express';
import { PrismaClient, OrderStatus, Prisma } from '@prisma/client';
import { verifyToken, isAdmin } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Apply auth middleware to all routes
router.use(verifyToken, isAdmin);

// Get all orders with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const { 
      page = '1', 
      limit = '10', 
      search = '',
      status,
      paymentStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      startDate,
      endDate,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.OrderWhereInput = {};
    
    // Search by order ID, buyer name/email, or gig title
    if (search) {
      where.OR = [
        { id: { contains: search as string, mode: 'insensitive' } },
        { orderNumber: { contains: search as string, mode: 'insensitive' } },
        { buyer: { name: { contains: search as string, mode: 'insensitive' } } },
        { buyer: { email: { contains: search as string, mode: 'insensitive' } } },
        { gig: { title: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    // Filter by status
    if (status) {
      where.status = status as OrderStatus;
    }

    // Filter by payment status
    if (paymentStatus) {
      where.paymentStatus = paymentStatus as string;
    }

    // Filter by date range
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Get orders with related data
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          buyer: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          seller: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          gig: {
            select: {
              id: true,
              title: true,
              slug: true,
              images: true,
              price: true,
            },
          },
          package: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
          _count: {
            select: {
              disputes: true,
              reviews: true,
            },
          },
        },
        orderBy: { [sortBy as string]: sortOrder },
        skip,
        take: limitNum,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      data: orders,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Error fetching orders' });
  }
});

// Get a single order by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            _count: {
              select: {
                orders: true,
                reviews: true,
              },
            },
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            _count: {
              select: {
                gigs: true,
                reviews: true,
              },
            },
          },
        },
        gig: {
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            images: true,
            price: true,
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        package: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            deliveryTime: true,
            revisions: true,
          },
        },
        disputes: {
          orderBy: { createdAt: 'desc' },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 5,
            },
          },
          take: 1,
        },
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            disputes: true,
            reviews: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ message: 'Error fetching order' });
  }
});

// Update order status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    // Validate status
    if (!Object.values(OrderStatus).includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        buyer: {
          select: { id: true, name: true, email: true },
        },
        seller: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!existingOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { 
        status,
        updatedAt: new Date(),
        // If status is completed, set completedAt
        ...(status === 'completed' && { completedAt: new Date() }),
        // If status is cancelled, set cancelledAt
        ...(status === 'cancelled' && { cancelledAt: newDate() }),
      },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create order activity log
    await prisma.orderActivity.create({
      data: {
        orderId: id,
        userId: req.user.id,
        action: `Status changed to ${status}`,
        note,
        metadata: {
          previousStatus: existingOrder.status,
          newStatus: status,
          updatedBy: req.user.id,
        },
      },
    });

    // TODO: Send notification to buyer and seller about status change
    // This would typically be handled by a notification service

    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Error updating order status' });
  }
});

// Refund an order
router.post('/:id/refund', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    if (!amount || !reason) {
      return res.status(400).json({ message: 'Amount and reason are required' });
    }

    // Check if order exists and is eligible for refund
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        buyer: {
          select: { id: true, name: true, email: true },
        },
        seller: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status === 'cancelled' || order.status === 'refunded') {
      return res.status(400).json({ message: `Order is already ${order.status}` });
    }

    // In a real app, this would integrate with a payment provider
    // For now, we'll just update the order status
    
    // Update order status to refunded
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { 
        status: 'refunded',
        paymentStatus: 'refunded',
        refundedAt: new Date(),
        refundAmount: parseFloat(amount),
      },
    });

    // Create refund record
    await prisma.refund.create({
      data: {
        orderId: id,
        amount: parseFloat(amount),
        reason,
        processedBy: req.user.id,
        status: 'completed',
      },
    });

    // Create order activity log
    await prisma.orderActivity.create({
      data: {
        orderId: id,
        userId: req.user.id,
        action: 'Order refunded',
        note: `Refunded $${amount}: ${reason}`,
        metadata: {
          refundAmount: amount,
          reason,
          processedBy: req.user.id,
        },
      },
    });

    // TODO: Send notification to buyer and seller about refund
    // This would typically be handled by a notification service

    res.json(updatedOrder);
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ message: 'Error processing refund' });
  }
});

// Get order statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter: Prisma.OrderWhereInput = {};
    
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.lte = end;
      }
    }
    
    const [
      totalOrders,
      totalRevenue,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      ordersByStatus,
      ordersByMonth,
      topSellingGigs,
      topBuyers,
      topSellers,
    ] = await Promise.all([
      // Total orders
      prisma.order.count({ where: dateFilter }),
      
      // Total revenue (only from completed orders)
      prisma.order.aggregate({
        _sum: { amount: true },
        where: { 
          ...dateFilter,
          status: 'completed',
          paymentStatus: 'paid',
        },
      }),
      
      // Pending orders
      prisma.order.count({ 
        where: { 
          ...dateFilter,
          status: 'pending',
        },
      }),
      
      // Completed orders
      prisma.order.count({ 
        where: { 
          ...dateFilter,
          status: 'completed',
        },
      }),
      
      // Cancelled orders
      prisma.order.count({ 
        where: { 
          ...dateFilter,
          status: 'cancelled',
        },
      }),
      
      // Orders by status
      prisma.order.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
        where: dateFilter,
      }),
      
      // Orders by month (for chart)
      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', "createdAt") as month,
          COUNT(*) as count,
          SUM(CASE WHEN status = 'completed' AND "paymentStatus" = 'paid' THEN amount ELSE 0 END) as revenue
        FROM "Order"
        ${startDate || endDate ? Prisma.sql`WHERE "createdAt" >= ${new Date(startDate as string)} AND "createdAt" <= ${new Date(endDate as string)}` : Prisma.empty}
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY month ASC
      `,
      
      // Top selling gigs
      prisma.$queryRaw`
        SELECT 
          g.id,
          g.title,
          COUNT(o.id) as order_count,
          SUM(o.amount) as total_revenue
        FROM "Order" o
        JOIN "Gig" g ON o."gigId" = g.id
        ${startDate || endDate ? Prisma.sql`WHERE o."createdAt" >= ${new Date(startDate as string)} AND o."createdAt" <= ${new Date(endDate as string)}` : Prisma.empty}
        GROUP BY g.id, g.title
        ORDER BY order_count DESC
        LIMIT 5
      `,
      
      // Top buyers
      prisma.$queryRaw`
        SELECT 
          u.id,
          u.name,
          u.email,
          COUNT(o.id) as order_count,
          SUM(o.amount) as total_spent
        FROM "Order" o
        JOIN "User" u ON o."buyerId" = u.id
        ${startDate || endDate ? Prisma.sql`WHERE o."createdAt" >= ${new Date(startDate as string)} AND o."createdAt" <= ${new Date(endDate as string)}` : Prisma.empty}
        GROUP BY u.id, u.name, u.email
        ORDER BY total_spent DESC
        LIMIT 5
      `,
      
      // Top sellers
      prisma.$queryRaw`
        SELECT 
          u.id,
          u.name,
          u.email,
          COUNT(o.id) as order_count,
          SUM(o.amount) as total_earnings
        FROM "Order" o
        JOIN "User" u ON o."sellerId" = u.id
        ${startDate || endDate ? Prisma.sql`WHERE o."createdAt" >= ${new Date(startDate as string)} AND o."createdAt" <= ${new Date(endDate as string)}` : Prisma.empty}
        GROUP BY u.id, u.name, u.email
        ORDER BY total_earnings DESC
        LIMIT 5
      `,
    ]);

    res.json({
      totalOrders,
      totalRevenue: totalRevenue._sum.amount || 0,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      ordersByStatus,
      ordersByMonth,
      topSellingGigs,
      topBuyers,
      topSellers,
    });
  } catch (error) {
    console.error('Error fetching order statistics:', error);
    res.status(500).json({ message: 'Error fetching order statistics' });
  }
});

export default router;
