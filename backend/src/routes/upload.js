import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { dbHelper } from '../database/init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// 업로드 디렉토리 설정
const UPLOAD_DIR = join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 허용된 파일 타입
const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
];

// Multer 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uniqueName = `${uuidv4()}${ext}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('허용되지 않는 파일 형식입니다.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

/**
 * 중복 파일명 확인
 */
function checkDuplicateFilename(originalName) {
    const existing = dbHelper.prepare(
        'SELECT id FROM files WHERE original_name = ?'
    ).get(originalName);
    return !!existing;
}

/**
 * 중복 검사용 엔드포인트
 * GET /api/upload/check/:filename
 */
router.get('/check/:filename', (req, res) => {
    try {
        const filename = decodeURIComponent(req.params.filename);
        const isDuplicate = checkDuplicateFilename(filename);
        res.json({ duplicate: isDuplicate });
    } catch (error) {
        console.error('Error checking duplicate:', error);
        res.status(500).json({ error: '중복 확인 중 오류가 발생했습니다.' });
    }
});

/**
 * 파일명으로 이미지 조회 (문서에서 이미지 불러오기용)
 * GET /api/upload/file/:originalname
 */
router.get('/file/:originalname', (req, res) => {
    try {
        const originalName = decodeURIComponent(req.params.originalname);

        const file = dbHelper.prepare(
            'SELECT * FROM files WHERE original_name = ?'
        ).get(originalName);

        if (!file) {
            return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
        }

        // 실제 파일로 리다이렉트
        res.redirect(`/uploads/${file.stored_name}`);
    } catch (error) {
        console.error('Error fetching file by name:', error);
        res.status(500).json({ error: '파일을 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 이미지 업로드
 */
router.post('/', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '파일이 필요합니다.' });
        }

        const { originalname, filename, mimetype, size } = req.file;
        const description = req.body.description || '';

        // 중복 체크
        if (checkDuplicateFilename(originalname)) {
            // 업로드된 파일 삭제
            const filePath = join(UPLOAD_DIR, filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return res.status(409).json({
                error: `'${originalname}' 파일이 이미 존재합니다. 다른 이름으로 업로드해주세요.`
            });
        }

        // DB에 파일 정보 저장
        const result = dbHelper.prepare(`
      INSERT INTO files (original_name, stored_name, mime_type, size, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(originalname, filename, mimetype, size, description);

        res.json({
            success: true,
            file: {
                id: result.lastInsertRowid,
                original_name: originalname,
                stored_name: filename,
                url: `/uploads/${filename}`,
                mime_type: mimetype,
                size
            }
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: '파일 업로드 중 오류가 발생했습니다.' });
    }
});

/**
 * 다중 이미지 업로드
 */
router.post('/multiple', upload.array('files', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: '파일이 필요합니다.' });
        }

        const uploadedFiles = [];
        const errors = [];

        for (const file of req.files) {
            const { originalname, filename, mimetype, size } = file;

            // 중복 체크
            if (checkDuplicateFilename(originalname)) {
                // 업로드된 파일 삭제
                const filePath = join(UPLOAD_DIR, filename);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                errors.push(`'${originalname}' 파일이 이미 존재합니다.`);
                continue;
            }

            const result = dbHelper.prepare(`
        INSERT INTO files (original_name, stored_name, mime_type, size)
        VALUES (?, ?, ?, ?)
      `).run(originalname, filename, mimetype, size);

            uploadedFiles.push({
                id: result.lastInsertRowid,
                original_name: originalname,
                stored_name: filename,
                url: `/uploads/${filename}`,
                mime_type: mimetype,
                size
            });
        }

        // 모든 파일이 중복인 경우
        if (uploadedFiles.length === 0 && errors.length > 0) {
            return res.status(409).json({
                error: errors.join('\n'),
                errors
            });
        }

        res.json({
            success: true,
            files: uploadedFiles,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({ error: '파일 업로드 중 오류가 발생했습니다.' });
    }
});

/**
 * 파일 목록 조회
 */
router.get('/', (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const files = dbHelper.prepare(`
      SELECT * FROM files ORDER BY uploaded_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `).all();

        const filesWithUrl = files.map(file => ({
            ...file,
            url: `/uploads/${file.stored_name}`
        }));

        const countResult = dbHelper.prepare('SELECT COUNT(*) as total FROM files').get();
        const total = countResult?.total || 0;

        res.json({ files: filesWithUrl, total });
    } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({ error: '파일 목록을 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 파일 삭제 (stored_name 또는 id로 삭제)
 */
router.delete('/:identifier', (req, res) => {
    try {
        const identifier = req.params.identifier;

        // ID로 먼저 시도, 실패하면 stored_name으로 시도
        let file;
        if (/^\d+$/.test(identifier)) {
            file = dbHelper.prepare('SELECT * FROM files WHERE id = ?').get(parseInt(identifier));
        }

        if (!file) {
            file = dbHelper.prepare('SELECT * FROM files WHERE stored_name = ?').get(identifier);
        }

        if (!file) {
            return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
        }

        // 파일 시스템에서 삭제
        const filePath = join(UPLOAD_DIR, file.stored_name);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // DB에서 삭제
        dbHelper.prepare('DELETE FROM files WHERE id = ?').run(file.id);

        res.json({ success: true, message: '파일이 삭제되었습니다.' });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: '파일 삭제 중 오류가 발생했습니다.' });
    }
});

// 에러 핸들러
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: '파일 크기가 너무 큽니다. (최대 10MB)' });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

export default router;
