import express from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken, isAdmin } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Apply auth middleware to all routes
router.use(verifyToken, isAdmin);

// Get all gigs with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const { 
      page = '1', 
      limit = '10', 
      search = '',
      status,
      category,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      // Only show non-deleted gigs by default
      deletedAt: null,
    };
    
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = {
        slug: category as string,
      };
    }

    const [gigs, total] = await Promise.all([
      prisma.gig.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              orders: true,
              reviews: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { [sortBy as string]: sortOrder },
      }),
      prisma.gig.count({ where }),
    ]);

    res.json({
      data: gigs,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching gigs:', error);
    res.status(500).json({ message: 'Error fetching gigs' });
  }
});

// Get a single gig by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const gig = await prisma.gig.findUnique({
      where: { id },
      include: {
        user: {
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
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        packages: true,
        faqs: true,
        requirements: true,
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
          take: 5,
        },
        _count: {
          select: {
            orders: true,
            reviews: true,
          },
        },
      },
    });

    if (!gig) {
      return res.status(404).json({ message: 'Gig not found' });
    }

    res.json(gig);
  } catch (error) {
    console.error('Error fetching gig:', error);
    res.status(500).json({ message: 'Error fetching gig' });
  }
});

// Update gig status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['draft', 'pending', 'active', 'paused', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Check if gig exists
    const existingGig = await prisma.gig.findUnique({
      where: { id },
    });

    if (!existingGig) {
      return res.status(404).json({ message: 'Gig not found' });
    }

    // If rejecting, require a reason
    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    // Update status
    const updatedGig = await prisma.gig.update({
      where: { id },
      data: { 
        status,
        rejectionReason: status === 'rejected' ? rejectionReason : null,
        publishedAt: status === 'active' && !existingGig.publishedAt 
          ? new Date() 
          : existingGig.publishedAt,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // TODO: Send notification to the gig owner about status change

    res.json(updatedGig);
  } catch (error) {
    console.error('Error updating gig status:', error);
    res.status(500).json({ message: 'Error updating gig status' });
  }
});

// Delete a gig (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if gig exists
    const existingGig = await prisma.gig.findUnique({
      where: { id },
    });

    if (!existingGig) {
      return res.status(404).json({ message: 'Gig not found' });
    }

    // Soft delete the gig
    await prisma.gig.update({
      where: { id },
      data: { 
        status: 'deleted',
        deletedAt: new Date(),
      },
    });

    res.json({ message: 'Gig deleted successfully' });
  } catch (error) {
    console.error('Error deleting gig:', error);
    res.status(500).json({ message: 'Error deleting gig' });
  }
});

// Get gig statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const [
      totalGigs,
      activeGigs,
      pendingGigs,
      totalEarnings,
      gigsByCategory,
      gigsByStatus,
    ] = await Promise.all([
      prisma.gig.count({ where: { deletedAt: null } }),
      prisma.gig.count({ where: { status: 'active', deletedAt: null } }),
      prisma.gig.count({ where: { status: 'pending', deletedAt: null } }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: 'completed' },
      }),
      prisma.$queryRaw`
        SELECT c.name, c.slug, COUNT(g.id) as count
        FROM "Category" c
        LEFT JOIN "Gig" g ON g."categoryId" = c.id AND g.deleted_at IS NULL
        GROUP BY c.id, c.name, c.slug
        ORDER BY count DESC
        LIMIT 5
      `,
      prisma.gig.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
        where: { deletedAt: null },
      }),
    ]);

    res.json({
      totalGigs,
      activeGigs,
      pendingGigs,
      totalEarnings: totalEarnings._sum.total || 0,
      gigsByCategory,
      gigsByStatus,
    });
  } catch (error) {
    console.error('Error fetching gig statistics:', error);
    res.status(500).json({ message: 'Error fetching gig statistics' });
  }
});

export default router;
