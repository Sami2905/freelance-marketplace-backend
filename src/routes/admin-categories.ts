import express from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken, isAdmin } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Apply auth middleware to all routes
router.use(verifyToken, isAdmin);

// Get all categories with optional filtering
router.get('/', async (req, res) => {
  try {
    const { 
      page = '1', 
      limit = '100',
      status,
      parentId,
      includeInactive = 'false',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    
    // Filter by status if provided
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    } else if (includeInactive === 'false') {
      // Default to only active categories if not specified
      where.isActive = true;
    }

    // Filter by parent ID
    if (parentId === 'null' || parentId === '') {
      where.parentId = null;
    } else if (parentId) {
      where.parentId = parentId;
    }

    // Get categories with count of gigs and subcategories
    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        include: {
          _count: {
            select: {
              gigs: true,
              children: true,
            },
          },
          parent: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: [
          { parentId: 'asc' },
          { name: 'asc' },
        ],
        skip,
        take: limitNum,
      }),
      prisma.category.count({ where }),
    ]);

    res.json({
      data: categories,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories' });
  }
});

// Get a single category by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            gigs: true,
            children: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            _count: {
              select: {
                gigs: true,
                children: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Error fetching category' });
  }
});

// Create a new category
router.post('/', async (req, res) => {
  try {
    const { name, slug, description, parentId, isActive = true } = req.body;

    // Validate required fields
    if (!name || !slug) {
      return res.status(400).json({ message: 'Name and slug are required' });
    }

    // Check if slug is already taken
    const existingSlug = await prisma.category.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existingSlug) {
      return res.status(400).json({ message: 'Slug is already in use' });
    }

    // If parentId is provided, verify it exists
    if (parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: parentId },
        select: { id: true },
      });

      if (!parent) {
        return res.status(400).json({ message: 'Parent category not found' });
      }
    }

    // Create the category
    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        parentId: parentId || null,
        isActive: Boolean(isActive),
      },
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Error creating category' });
  }
});

// Update a category
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, parentId, isActive } = req.body;

    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // If slug is being updated, check if it's available
    if (slug && slug !== existingCategory.slug) {
      const existingSlug = await prisma.category.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (existingSlug) {
        return res.status(400).json({ message: 'Slug is already in use' });
      }
    }

    // If parentId is provided, verify it exists and is not the same as the current category
    if (parentId !== undefined) {
      if (parentId === id) {
        return res.status(400).json({ message: 'Category cannot be its own parent' });
      }

      if (parentId) {
        const parent = await prisma.category.findUnique({
          where: { id: parentId },
          select: { id: true },
        });

        if (!parent) {
          return res.status(400).json({ message: 'Parent category not found' });
        }

        // Check for circular references (category cannot be a child of its own descendant)
        const checkCircular = async (categoryId: string): Promise<boolean> => {
          const children = await prisma.category.findMany({
            where: { parentId: categoryId },
            select: { id: true },
          });
          
          for (const child of children) {
            if (child.id === id) return true;
            const hasCircular = await checkCircular(child.id);
            if (hasCircular) return true;
          }
          return false;
        };

        const hasCircular = await checkCircular(id);
        if (hasCircular) {
          return res.status(400).json({ message: 'Cannot set parent as it would create a circular reference' });
        }
      }
    }

    // Update the category
    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(description !== undefined && { description }),
        ...(parentId !== undefined && { parentId: parentId || null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    res.json(updatedCategory);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Error updating category' });
  }
});

// Delete a category
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            gigs: true,
            children: true,
          },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if category has gigs or subcategories
    if (category._count.gigs > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete category with active gigs. Please reassign or delete the gigs first.',
      });
    }

    if (category._count.children > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete category with subcategories. Please delete or move the subcategories first.',
      });
    }

    // Delete the category
    await prisma.category.delete({
      where: { id },
    });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Error deleting category' });
  }
});

// Get category statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const [
      totalCategories,
      activeCategories,
      topCategories,
      categoriesWithGigs,
    ] = await Promise.all([
      prisma.category.count(),
      prisma.category.count({ where: { isActive: true } }),
      prisma.category.findMany({
        include: {
          _count: {
            select: { gigs: true },
          },
        },
        orderBy: {
          gigs: {
            _count: 'desc',
          },
        },
        take: 5,
      }),
      prisma.category.groupBy({
        by: ['isActive'],
        _count: {
          _all: true,
        },
        _sum: {
          gigs: true,
        },
      }),
    ]);

    res.json({
      totalCategories,
      activeCategories,
      inactiveCategories: totalCategories - activeCategories,
      topCategories: topCategories.map(cat => ({
        id: cat.id,
        name: cat.name,
        gigCount: cat._count.gigs,
      })),
      statsByStatus: categoriesWithGigs.map(group => ({
        isActive: group.isActive,
        count: group._count._all,
        gigCount: group._sum.gigs || 0,
      })),
    });
  } catch (error) {
    console.error('Error fetching category statistics:', error);
    res.status(500).json({ message: 'Error fetching category statistics' });
  }
});

// Reorder categories
router.post('/reorder', async (req, res) => {
  try {
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ message: 'Invalid order data' });
    }

    // Update the order of categories
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.category.update({
          where: { id },
          data: { order: index },
        })
      )
    );

    res.json({ message: 'Categories reordered successfully' });
  } catch (error) {
    console.error('Error reordering categories:', error);
    res.status(500).json({ message: 'Error reordering categories' });
  }
});

export default router;
