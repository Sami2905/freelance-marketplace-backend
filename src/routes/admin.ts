import express from 'express';
import { verifyToken, isAdmin } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = express.Router();

// Apply auth middleware to all admin routes
router.use(verifyToken, isAdmin);

// Get dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalGigs,
      totalOrders,
      totalRevenue,
      recentUsers,
      recentOrders,
      popularCategories,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          lastActive: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
      prisma.gig.count({
        where: { status: 'ACTIVE' },
      }),
      prisma.order.count({
        where: { status: 'COMPLETED' },
      }),
      prisma.order.aggregate({
        _sum: { amount: true },
        where: { status: 'COMPLETED' },
      }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          avatar: true,
        },
      }),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          gig: {
            select: { title: true },
          },
          buyer: {
            select: { name: true, email: true },
          },
        },
      }),
      prisma.category.findMany({
        take: 5,
        orderBy: {
          gigs: {
            _count: 'desc',
          },
        },
        select: {
          id: true,
          name: true,
          _count: {
            select: { gigs: true },
          },
        },
      }),
    ]);

    res.json({
      stats: {
        totalUsers,
        activeUsers,
        totalGigs,
        totalOrders,
        totalRevenue: totalRevenue._sum.amount || 0,
      },
      recentUsers,
      recentOrders,
      popularCategories,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Error fetching dashboard stats' });
  }
});

// Get revenue analytics
router.get('/analytics/revenue', async (req, res) => {
  try {
    const { range = 'week' } = req.query;
    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'week':
      default:
        startDate.setDate(now.getDate() - 7);
        break;
    }

    const revenueData = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', "createdAt") as date,
        COALESCE(SUM(amount), 0) as revenue
      FROM "Order"
      WHERE 
        status = 'COMPLETED' 
        AND "createdAt" >= ${startDate}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    res.json(revenueData);
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    res.status(500).json({ message: 'Error fetching revenue analytics' });
  }
});

// Get user growth analytics
router.get('/analytics/users', async (req, res) => {
  try {
    const { range = 'week' } = req.query;
    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'week':
      default:
        startDate.setDate(now.getDate() - 7);
        break;
    }

    const userData = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', "createdAt") as date,
        COUNT(*) as users
      FROM "User"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    res.json(userData);
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    res.status(500).json({ message: 'Error fetching user analytics' });
  }
});

// Get category distribution
router.get('/analytics/categories', async (req, res) => {
  try {
    const categoryData = await prisma.$queryRaw`
      SELECT 
        c.name as name,
        COUNT(o.id) as value
      FROM "Category" c
      LEFT JOIN "Gig" g ON g."categoryId" = c.id
      LEFT JOIN "Order" o ON o."gigId" = g.id
      WHERE o."createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY c.id, c.name
      HAVING COUNT(o.id) > 0
      ORDER BY value DESC
      LIMIT 5
    `;

    res.json(categoryData);
  } catch (error) {
    console.error('Error fetching category analytics:', error);
    res.status(500).json({ message: 'Error fetching category analytics' });
  }
});

// Get recent activities
router.get('/activities', async (req, res) => {
  try {
    const [recentOrders, recentUsers, recentReviews] = await Promise.all([
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          gig: {
            select: { title: true },
          },
          buyer: {
            select: { name: true, email: true },
          },
        },
      }),
      prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
      prisma.review.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          gig: {
            select: { title: true },
          },
          user: {
            select: { name: true },
          },
        },
      }),
    ]);

    res.json({
      recentOrders,
      recentUsers,
      recentReviews,
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ message: 'Error fetching activities' });
  }
});

export default router;
