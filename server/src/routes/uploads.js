import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { FileMetadata } from '../models/FileMetadata.js';
import { requireAuth, requireRole, STAFF } from '../middleware/auth.js';
import { ok, badRequest, notFound, forbidden } from '../errors.js';
import { resolveMember, enforceMemberAccess } from './helpers.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({ destination: uploadDir, filename: (req, file, cb) => { const ext = path.extname(file.originalname).toLowerCase(); cb(null, `${crypto.randomUUID()}${ext}`); } });
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { if (!ALLOWED.has(file.mimetype)) return cb(badRequest(`File type not allowed: ${file.mimetype}`)); cb(null, true); } });
const r = Router(); r.use(requireAuth);
r.post('/members/:memberId', requireRole(...STAFF), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw badRequest('No file uploaded');
    const member = await resolveMember(req.params.memberId);
    const kind = req.body.kind === 'document' ? 'document' : 'photo';
    const meta = await FileMetadata.create({ member: member._id, kind, originalName: req.file.originalname, storedName: req.file.filename, mimeType: req.file.mimetype, size: req.file.size, uploadedBy: req.user.id });
    ok(res, meta, 201);
  } catch (e) { next(e); }
});
r.get('/members/:memberId', async (req, res, next) => {
  try { const member = await resolveMember(req.params.memberId); await enforceMemberAccess(req, member); if (req.user.role !== 'MEMBER' && !STAFF.includes(req.user.role)) throw forbidden();
    const files = await FileMetadata.find({ member: member._id }).sort({ createdAt: -1 }).lean(); ok(res, files.map((f) => ({ ...f, downloadUrl: `/api/v1/uploads/${f._id}` }))); } catch (e) { next(e); }
});
r.get('/:id', async (req, res, next) => {
  try { const meta = await FileMetadata.findById(req.params.id); if (!meta) throw notFound('File not found');
    if (req.user.role === 'MEMBER' && String(meta.member) !== req.user.memberId) throw forbidden();
    if (req.user.role !== 'MEMBER' && !STAFF.includes(req.user.role)) throw forbidden();
    const filePath = path.join(uploadDir, meta.storedName);
    if (!fs.existsSync(filePath)) throw notFound('File missing from disk');
    res.setHeader('Content-Type', meta.mimeType); res.setHeader('Content-Disposition', `inline; filename="${meta.originalName.replace(/"/g, '')}"`); fs.createReadStream(filePath).pipe(res); } catch (e) { next(e); }
});
export default r;
