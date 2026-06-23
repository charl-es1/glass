'use server';

import prisma from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { initializeGlazingCatalog } from '@/lib/glazing-seed';

// Utility helper to authorize administrators
async function requireAdmin() {
  const user = await getAuthUser();
  if (!user) {
    throw new Error('Unauthenticated');
  }
  if (user.role.toUpperCase() !== 'ADMIN') {
    throw new Error('Unauthorized: Admin access required');
  }
  return user;
}

// Convert a name to a URL/ID safe slug
function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '_')
    .replace(/^-+|-+$/g, '');
}

// Read the complete Glazing Configuration Catalog
export async function getCatalog() {
  await requireAdmin();
  
  // Lazy initialize if catalog table is empty
  await initializeGlazingCatalog();

  const categories = await prisma.category.findMany({
    include: {
      subtypes: {
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  return categories;
}

// Category CRUD Actions
export async function addCategory(name: string) {
  await requireAdmin();

  if (!name || name.trim() === '') {
    throw new Error('Category name is required');
  }

  const slug = slugify(name);

  try {
    const existing = await prisma.category.findFirst({
      where: {
        OR: [{ name: name.trim() }, { slug }],
      },
    });

    if (existing) {
      throw new Error('A category with this name or slug already exists');
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        slug,
      },
    });

    return { success: true, category };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create category' };
  }
}

export async function updateCategory(id: string, name: string) {
  await requireAdmin();

  if (!name || name.trim() === '') {
    throw new Error('Category name is required');
  }

  const slug = slugify(name);

  try {
    const existing = await prisma.category.findFirst({
      where: {
        OR: [{ name: name.trim() }, { slug }],
        NOT: { id },
      },
    });

    if (existing) {
      throw new Error('Another category with this name or slug already exists');
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: name.trim(),
        slug,
      },
    });

    return { success: true, category };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update category' };
  }
}

export async function deleteCategory(id: string) {
  await requireAdmin();

  try {
    // Cascade delete is configured on DB level for subtypes, but let's double check historical invoice warning.
    const invoiceCount = await prisma.invoice.count();
    
    // Check if there are subtypes under this category
    const subtypes = await prisma.subType.findMany({
      where: { categoryId: id },
    });

    if (subtypes.length > 0 && invoiceCount > 0) {
      // Deleting a category with subtypes could affect active drawings views on existing invoices
      return {
        success: false,
        warning: `This category contains ${subtypes.length} sub-types. Deleting it will permanently remove these design configurations, impacting technical drawing renders on the system's ${invoiceCount} historical invoices.`,
        invoiceCount,
      };
    }

    await prisma.category.delete({
      where: { id },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete category' };
  }
}

// Force delete Category bypassing safety checks
export async function forceDeleteCategory(id: string) {
  await requireAdmin();
  try {
    await prisma.category.delete({
      where: { id },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to force delete category' };
  }
}

// Sub-type CRUD Actions
export async function addSubType(data: {
  name: string;
  categoryId: string;
  defaultWidth: number;
  defaultHeight: number;
  operationalType: 'sliding' | 'hinged' | 'fixed' | 'awning';
}) {
  await requireAdmin();

  const { name, categoryId, defaultWidth, defaultHeight, operationalType } = data;

  if (!name || name.trim() === '') throw new Error('Product sub-type name is required');
  if (!categoryId) throw new Error('Parent category is required');
  if (!operationalType) throw new Error('Operational type is required');

  // Strictly positive integer validation
  if (!Number.isInteger(defaultWidth) || defaultWidth <= 0) {
    throw new Error('Default Width must be a positive integer in mm');
  }
  if (!Number.isInteger(defaultHeight) || defaultHeight <= 0) {
    throw new Error('Default Height must be a positive integer in mm');
  }

  const slug = slugify(name);

  try {
    const existing = await prisma.subType.findFirst({
      where: {
        OR: [{ name: name.trim() }, { slug }],
      },
    });

    if (existing) {
      throw new Error('A sub-type style with this name or slug already exists');
    }

    const subType = await prisma.subType.create({
      data: {
        name: name.trim(),
        slug,
        categoryId,
        defaultWidth,
        defaultHeight,
        operationalType,
      },
    });

    return { success: true, subType };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create sub-type' };
  }
}

export async function updateSubType(
  id: string,
  data: {
    name: string;
    categoryId: string;
    defaultWidth: number;
    defaultHeight: number;
    operationalType: 'sliding' | 'hinged' | 'fixed' | 'awning';
  }
) {
  await requireAdmin();

  const { name, categoryId, defaultWidth, defaultHeight, operationalType } = data;

  if (!name || name.trim() === '') throw new Error('Product sub-type name is required');
  if (!categoryId) throw new Error('Parent category is required');
  if (!operationalType) throw new Error('Operational type is required');

  // Strictly positive integer validation
  if (!Number.isInteger(defaultWidth) || defaultWidth <= 0) {
    throw new Error('Default Width must be a positive integer in mm');
  }
  if (!Number.isInteger(defaultHeight) || defaultHeight <= 0) {
    throw new Error('Default Height must be a positive integer in mm');
  }

  const slug = slugify(name);

  try {
    const existing = await prisma.subType.findFirst({
      where: {
        OR: [{ name: name.trim() }, { slug }],
        NOT: { id },
      },
    });

    if (existing) {
      throw new Error('Another sub-type style with this name or slug already exists');
    }

    const subType = await prisma.subType.update({
      where: { id },
      data: {
        name: name.trim(),
        slug,
        categoryId,
        defaultWidth,
        defaultHeight,
        operationalType,
      },
    });

    return { success: true, subType };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update sub-type' };
  }
}

export async function deleteSubType(id: string, force: boolean = false) {
  await requireAdmin();

  try {
    const invoiceCount = await prisma.invoice.count();

    if (!force && invoiceCount > 0) {
      // Return a warning indicating it affects historical invoices
      return {
        success: false,
        warning: `Deleting this design style will impact any historical invoices currently referenced. There are ${invoiceCount} active/past invoices recorded in the database.`,
        invoiceCount,
      };
    }

    await prisma.subType.delete({
      where: { id },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete sub-type' };
  }
}
