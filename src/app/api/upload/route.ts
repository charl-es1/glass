import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Authenticate & Authorize
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }
    if (user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const field = formData.get('field') as string; // 'headerLogo' | 'footerLogo' | 'favicon'

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    if (!field || !['headerLogo', 'footerLogo', 'favicon'].includes(field)) {
      return NextResponse.json({ error: 'Invalid or missing field value' }, { status: 400 });
    }

    // 2. Validate file size and type
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileSize = buffer.length;
    const fileType = file.type || '';
    const fileName = file.name || 'image.png';
    const ext = path.extname(fileName).toLowerCase();

    if (field === 'favicon') {
      // Favicon validation: Recommended 16x16px. Accept PNG/ICO/SVG. Max 512KB
      const allowedTypes = ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml'];
      const allowedExts = ['.png', '.ico', '.svg'];
      if (!allowedTypes.includes(fileType) && !allowedExts.includes(ext)) {
        return NextResponse.json({ error: 'Invalid favicon type. Accepted: PNG, ICO, SVG' }, { status: 400 });
      }
      if (fileSize > 512 * 1024) {
        return NextResponse.json({ error: 'Favicon is too large. Max size: 512KB' }, { status: 400 });
      }
    } else {
      // Logo validation: Accept PNG, JPG, SVG, WebP. Max 2MB
      const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
      const allowedExts = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
      if (!allowedTypes.includes(fileType) && !allowedExts.includes(ext)) {
        return NextResponse.json({ error: 'Invalid logo type. Accepted: PNG, JPG, SVG, WebP' }, { status: 400 });
      }
      if (fileSize > 2 * 1024 * 1024) {
        return NextResponse.json({ error: 'Logo is too large. Max size: 2MB' }, { status: 400 });
      }
    }

    // 3. Save file locally in public folder
    const timestamp = Date.now();
    // Sanitize filename to prevent directory traversal
    const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const relativeDir = `/uploads/settings/${field}`;
    const uploadDir = path.join(process.cwd(), 'public', relativeDir);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uniqueFileName = `${timestamp}-${safeName}`;
    const filePath = path.join(uploadDir, uniqueFileName);
    fs.writeFileSync(filePath, buffer);

    const fileUrl = `${relativeDir}/${uniqueFileName}`;
    const storagePath = `public${fileUrl}`; // Store path relative to workspace root for deletion

    return NextResponse.json({
      url: fileUrl,
      storagePath: storagePath,
    });
  } catch (error: any) {
    console.error('API POST upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    // 1. Authenticate & Authorize
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }
    if (user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { storagePath } = await request.json();
    if (!storagePath) {
      return NextResponse.json({ error: 'Missing storagePath' }, { status: 400 });
    }

    // Security check: ensure storagePath stays inside public/uploads/settings
    const fullPath = path.resolve(process.cwd(), storagePath);
    const settingsUploadsRoot = path.resolve(process.cwd(), 'public/uploads/settings');

    if (!fullPath.startsWith(settingsUploadsRoot)) {
      return NextResponse.json({ error: 'Invalid file path restriction violated' }, { status: 400 });
    }

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return NextResponse.json({ success: true });
    } else {
      // Even if file doesn't exist, return success so frontend can proceed
      return NextResponse.json({ success: true, warning: 'File already deleted' });
    }
  } catch (error: any) {
    console.error('API DELETE upload error:', error);
    return NextResponse.json({ error: error.message || 'File deletion failed' }, { status: 500 });
  }
}
