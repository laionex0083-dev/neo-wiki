import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { dbHelper } from '../database/init.js';
import { writeLimiter } from '../app.js';
import { authenticateToken, optionalAuth, requireRole, ROLES, hasPermission } from './users.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// 업로드 디렉토리 설정
const UPLOAD_DIR = join(__dirname, '../../uploads');
const ORIGINALS_DIR = join(UPLOAD_DIR, 'originals');
const WATERMARKED_DIR = join(UPLOAD_DIR, 'watermarked');

// 디렉토리 생성
[UPLOAD_DIR, ORIGINALS_DIR, WATERMARKED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// 허용된 파일 타입 (SVG 제외 - XSS 취약점)
const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
];

// 매직넘버(파일 시그니처) 정의
const FILE_SIGNATURES = {
    'image/jpeg': [
        [0xFF, 0xD8, 0xFF]
    ],
    'image/png': [
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
    ],
    'image/gif': [
        [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
        [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]  // GIF89a
    ],
    'image/webp': [
        [0x52, 0x49, 0x46, 0x46] // RIFF (WebP는 RIFF 컨테이너 사용)
    ]
};

/**
 * 파일 매직넘버 검증
 * @param {Buffer} buffer - 파일 버퍼
 * @param {string} expectedMime - 예상 MIME 타입
 * @returns {boolean} 유효 여부
 */
function validateMagicNumber(buffer, expectedMime) {
    const signatures = FILE_SIGNATURES[expectedMime];
    if (!signatures) return false;

    for (const sig of signatures) {
        let match = true;
        for (let i = 0; i < sig.length; i++) {
            if (buffer[i] !== sig[i]) {
                match = false;
                break;
            }
        }
        if (match) return true;
    }
    return false;
}

/**
 * 워터마크 SVG 생성
 * @param {number} width - 이미지 너비
 * @param {number} height - 이미지 높이
 * @returns {Buffer} 워터마크 SVG 버퍼
 */
function createWatermarkSvg(width, height) {
    // 이미지 크기에 비례한 폰트 크기 (대각선 길이 기준)
    const diagonal = Math.sqrt(width * width + height * height);
    const fontSize = Math.max(diagonal * 0.15, 40); // 최소 40px

    const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <style>
                    .watermark {
                        font-family: Arial, Helvetica, sans-serif;
                        font-size: ${fontSize}px;
                        font-weight: bold;
                        fill: #808080;
                        fill-opacity: 0.50;
                    }
                </style>
            </defs>
            <text 
                x="50%" 
                y="50%" 
                class="watermark"
                text-anchor="middle"
                dominant-baseline="middle"
                transform="rotate(-45, ${width / 2}, ${height / 2})"
            >SAMPLE</text>
        </svg>
    `;

    return Buffer.from(svg);
}

/**
 * 이미지 처리 (재인코딩 + 워터마크)
 * @param {Buffer} inputBuffer - 원본 이미지 버퍼
 * @param {string} originalName - 원본 파일명 (확장자 확인용)
 * @returns {Promise<{original: Buffer, watermarked: Buffer, metadata: object}>}
 */
async function processImage(inputBuffer, originalName) {
    const ext = path.extname(originalName).toLowerCase();
    const isGif = ext === '.gif';

    // GIF는 첫 프레임만 처리됨 - 원본 유지 옵션 제공
    let sharpInstance = sharp(inputBuffer);
    const metadata = await sharpInstance.metadata();

    // 원본 재인코딩 (EXIF 제거, WebP 변환) - GIF 제외
    let originalBuffer;
    let outputFormat = 'webp';

    if (isGif) {
        // GIF는 원본 유지 (애니메이션 보존)
        originalBuffer = inputBuffer;
        outputFormat = 'gif';
    } else {
        // WebP로 변환 (EXIF 자동 제거)
        originalBuffer = await sharp(inputBuffer)
            .rotate() // EXIF 방향 정보 적용 후 제거
            .webp({ quality: 85 })
            .toBuffer();
    }

    // 워터마크 버전 생성
    let watermarkedBuffer;

    if (isGif) {
        // GIF는 워터마크 없이 원본 사용
        watermarkedBuffer = inputBuffer;
    } else {
        // 워터마크 SVG 생성
        const watermarkSvg = createWatermarkSvg(metadata.width, metadata.height);

        // 워터마크 합성
        watermarkedBuffer = await sharp(originalBuffer)
            .composite([{
                input: watermarkSvg,
                gravity: 'center'
            }])
            .webp({ quality: 85 })
            .toBuffer();
    }

    return {
        original: originalBuffer,
        watermarked: watermarkedBuffer,
        metadata: {
            width: metadata.width,
            height: metadata.height,
            format: outputFormat
        }
    };
}

// Multer 설정 (메모리 스토리지 - 처리 후 저장)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('허용되지 않는 파일 형식입니다. (JPEG, PNG, GIF, WebP만 허용)'), false);
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
 * 워터마크 버전 제공
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

        // 워터마크 버전으로 리다이렉트 (있으면)
        if (file.watermarked_stored_name) {
            res.redirect(`/uploads/watermarked/${file.watermarked_stored_name}`);
        } else {
            // 구버전 파일은 기존 경로 사용
            res.redirect(`/uploads/${file.stored_name}`);
        }
    } catch (error) {
        console.error('Error fetching file by name:', error);
        res.status(500).json({ error: '파일을 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 원본 이미지 다운로드 (관리자 이상만 가능)
 * GET /api/upload/:id/original
 */
router.get('/:id/original', authenticateToken, requireRole(ROLES.ADMIN), (req, res) => {
    try {
        const fileId = parseInt(req.params.id);

        const file = dbHelper.prepare('SELECT * FROM files WHERE id = ?').get(fileId);

        if (!file) {
            return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
        }

        // 원본 파일 경로
        let filePath;
        if (file.original_stored_name) {
            filePath = join(ORIGINALS_DIR, file.original_stored_name);
        } else {
            // 구버전 파일
            filePath = join(UPLOAD_DIR, file.stored_name);
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: '원본 파일을 찾을 수 없습니다.' });
        }

        // 다운로드 헤더 설정
        const downloadName = file.original_name.replace(/\.[^.]+$/, '') + '.' + (file.original_stored_name?.split('.').pop() || 'webp');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
        res.setHeader('Content-Type', file.mime_type || 'image/webp');

        // 파일 전송
        res.sendFile(filePath);
    } catch (error) {
        console.error('Error downloading original:', error);
        res.status(500).json({ error: '원본 다운로드 중 오류가 발생했습니다.' });
    }
});

/**
 * 이미지 업로드 (모더레이터 이상만 가능)
 */
router.post('/', authenticateToken, requireRole(ROLES.MODERATOR), writeLimiter, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '파일이 필요합니다.' });
        }

        const { originalname, mimetype, buffer, size } = req.file;
        const description = req.body.description || '';
        const userId = req.user?.userId || null;

        // 1. 매직넘버 검증
        if (!validateMagicNumber(buffer, mimetype)) {
            return res.status(400).json({
                error: '파일이 손상되었거나 확장자가 위조되었습니다.'
            });
        }

        // 2. 중복 체크
        if (checkDuplicateFilename(originalname)) {
            return res.status(409).json({
                error: `'${originalname}' 파일이 이미 존재합니다. 다른 이름으로 업로드해주세요.`
            });
        }

        // 3. 이미지 처리 (재인코딩 + 워터마크)
        const processed = await processImage(buffer, originalname);

        // 4. 파일명 생성
        const uniqueId = uuidv4();
        const ext = processed.metadata.format === 'gif' ? 'gif' : 'webp';
        const originalStoredName = `${uniqueId}.${ext}`;
        const watermarkedStoredName = `${uniqueId}.${ext}`;

        // 5. 파일 저장
        await fs.promises.writeFile(join(ORIGINALS_DIR, originalStoredName), processed.original);
        await fs.promises.writeFile(join(WATERMARKED_DIR, watermarkedStoredName), processed.watermarked);

        // 6. DB에 파일 정보 저장
        const result = dbHelper.prepare(`
            INSERT INTO files (
                original_name, stored_name, mime_type, size, description, uploaded_by,
                original_stored_name, watermarked_stored_name, has_watermark
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            originalname,
            watermarkedStoredName, // 기본 표시용은 워터마크 버전
            `image/${ext}`,
            size,
            description,
            userId,
            originalStoredName,
            watermarkedStoredName,
            processed.metadata.format === 'gif' ? 0 : 1 // GIF는 워터마크 없음
        );

        res.json({
            success: true,
            file: {
                id: result.lastInsertRowid,
                original_name: originalname,
                stored_name: watermarkedStoredName,
                url: `/uploads/watermarked/${watermarkedStoredName}`,
                mime_type: `image/${ext}`,
                size: processed.watermarked.length,
                has_watermark: processed.metadata.format !== 'gif'
            }
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: '파일 업로드 중 오류가 발생했습니다.' });
    }
});

/**
 * 다중 이미지 업로드 (모더레이터 이상만 가능)
 */
router.post('/multiple', authenticateToken, requireRole(ROLES.MODERATOR), writeLimiter, upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: '파일이 필요합니다.' });
        }

        const uploadedFiles = [];
        const errors = [];
        const userId = req.user?.userId || null;

        for (const file of req.files) {
            const { originalname, mimetype, buffer, size } = file;

            try {
                // 매직넘버 검증
                if (!validateMagicNumber(buffer, mimetype)) {
                    errors.push(`'${originalname}': 파일이 손상되었거나 확장자가 위조되었습니다.`);
                    continue;
                }

                // 중복 체크
                if (checkDuplicateFilename(originalname)) {
                    errors.push(`'${originalname}': 파일이 이미 존재합니다.`);
                    continue;
                }

                // 이미지 처리
                const processed = await processImage(buffer, originalname);

                // 파일명 생성 및 저장
                const uniqueId = uuidv4();
                const ext = processed.metadata.format === 'gif' ? 'gif' : 'webp';
                const originalStoredName = `${uniqueId}.${ext}`;
                const watermarkedStoredName = `${uniqueId}.${ext}`;

                await fs.promises.writeFile(join(ORIGINALS_DIR, originalStoredName), processed.original);
                await fs.promises.writeFile(join(WATERMARKED_DIR, watermarkedStoredName), processed.watermarked);

                // DB 저장
                const result = dbHelper.prepare(`
                    INSERT INTO files (
                        original_name, stored_name, mime_type, size, uploaded_by,
                        original_stored_name, watermarked_stored_name, has_watermark
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    originalname,
                    watermarkedStoredName,
                    `image/${ext}`,
                    size,
                    userId,
                    originalStoredName,
                    watermarkedStoredName,
                    processed.metadata.format === 'gif' ? 0 : 1
                );

                uploadedFiles.push({
                    id: result.lastInsertRowid,
                    original_name: originalname,
                    stored_name: watermarkedStoredName,
                    url: `/uploads/watermarked/${watermarkedStoredName}`,
                    mime_type: `image/${ext}`,
                    size: processed.watermarked.length
                });
            } catch (err) {
                console.error(`Error processing ${originalname}:`, err);
                errors.push(`'${originalname}': 처리 중 오류가 발생했습니다.`);
            }
        }

        if (uploadedFiles.length === 0 && errors.length > 0) {
            return res.status(400).json({
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
router.get('/', optionalAuth, (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const userRole = req.user?.role || ROLES.GUEST;
        const canViewOriginal = hasPermission(userRole, ROLES.ADMIN);

        const files = dbHelper.prepare(`
            SELECT * FROM files ORDER BY uploaded_at DESC LIMIT ? OFFSET ?
        `).all(parseInt(limit, 10), parseInt(offset, 10));

        const filesWithUrl = files.map(file => {
            const baseFile = {
                ...file,
                url: file.watermarked_stored_name
                    ? `/uploads/watermarked/${file.watermarked_stored_name}`
                    : `/uploads/${file.stored_name}`
            };

            // 모더레이터 이상에게는 원본 다운로드 가능 표시
            if (canViewOriginal && file.original_stored_name) {
                baseFile.originalUrl = `/api/upload/${file.id}/original`;
                baseFile.canDownloadOriginal = true;
            }

            return baseFile;
        });

        const countResult = dbHelper.prepare('SELECT COUNT(*) as total FROM files').get();
        const total = countResult?.total || 0;

        res.json({ files: filesWithUrl, total });
    } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({ error: '파일 목록을 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 파일 삭제 (관리자 이상만 가능)
 */
router.delete('/:identifier', authenticateToken, requireRole(ROLES.ADMIN), writeLimiter, (req, res) => {
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

        // 파일 시스템에서 삭제 (원본 + 워터마크)
        const filesToDelete = [
            join(UPLOAD_DIR, file.stored_name),
            join(ORIGINALS_DIR, file.original_stored_name || ''),
            join(WATERMARKED_DIR, file.watermarked_stored_name || '')
        ];

        for (const filePath of filesToDelete) {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
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
