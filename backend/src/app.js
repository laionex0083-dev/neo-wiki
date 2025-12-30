import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase } from './database/init.js';
import { initTitleCache } from './titleCache.js';
import config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// ============================================
// 보안 미들웨어
// ============================================

// Helmet - HTTP 보안 헤더 설정
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:", "/uploads/*"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 전역 Rate Limiter - 모든 요청에 대해 15분당 1000개 제한
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 1000, // 최대 요청 수
    message: { error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use(globalLimiter);

// API 요청에 대한 더 엄격한 Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 300, // API는 더 엄격하게 제한
    message: { error: 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' },
    standardHeaders: true,
    legacyHeaders: false
});

// 문서 수정 요청에 대한 엄격한 Rate Limiter
const writeLimiter = rateLimit({
    windowMs: 60 * 1000, // 1분
    max: 10, // 분당 10개 수정 요청
    message: { error: '문서 수정 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
    standardHeaders: true,
    legacyHeaders: false
});

// 로그인/회원가입에 대한 Rate Limiter
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1시간
    max: 10, // 시간당 10회
    message: { error: '인증 요청이 너무 많습니다. 1시간 후 다시 시도해주세요.' },
    standardHeaders: true,
    legacyHeaders: false
});

// ============================================
// 일반 미들웨어
// ============================================

// CORS 설정 - 허용된 도메인만 접근 가능
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3001']; // 개발용 기본값

app.use(cors({
    origin: (origin, callback) => {
        // origin이 없는 경우 (same-origin 요청) 허용
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
        } else {
            callback(new Error('CORS 정책에 의해 차단되었습니다.'));
        }
    },
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 정적 파일 (업로드된 이미지)
app.use('/uploads', express.static(join(__dirname, '../uploads')));
app.use('/uploads/originals', express.static(join(__dirname, '../uploads/originals')));
app.use('/uploads/watermarked', express.static(join(__dirname, '../uploads/watermarked')));

// 프론트엔드 정적 파일 (프로덕션용)
const frontendDistPath = join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// API 라우트는 DB 초기화 후 로드
async function startServer() {
    try {
        // 데이터베이스 초기화 (better-sqlite3는 동기 API)
        initDatabase();

        // 제목 캐시 초기화
        initTitleCache();

        // 라우트 동적 로드
        const pagesRouter = (await import('./routes/pages.js')).default;
        const usersRouter = (await import('./routes/users.js')).default;
        const uploadRouter = (await import('./routes/upload.js')).default;
        const historyRouter = (await import('./routes/history.js')).default;
        const skinsRouter = (await import('./routes/skins.js')).default;
        const commentsRouter = (await import('./routes/comments.js')).default;
        const categoriesRouter = (await import('./routes/categories.js')).default;

        // API 라우트 (Rate Limiter 적용)
        app.use('/api/pages', apiLimiter, pagesRouter);
        app.use('/api/users', apiLimiter, usersRouter);  // authLimiter는 개별 라우트(register, login)에서 처리
        app.use('/api/upload', apiLimiter, uploadRouter);
        app.use('/api/history', apiLimiter, historyRouter);
        app.use('/api/skins', apiLimiter, skinsRouter);
        app.use('/api/comments', apiLimiter, commentsRouter);
        app.use('/api/categories', apiLimiter, categoriesRouter);

        // 기본 라우트
        app.get('/api', (req, res) => {
            res.json({
                name: config.wiki.name,
                version: '1.0.0',
                security: {
                    helmet: true,
                    rateLimiting: true,
                    xssSanitization: true
                },
                endpoints: {
                    pages: '/api/pages',
                    users: '/api/users',
                    upload: '/api/upload',
                    history: '/api/history',
                    skins: '/api/skins'
                }
            });
        });

        // SPA 폴백 (프론트엔드 라우팅 지원)
        app.get('*', (req, res, next) => {
            // API 요청이 아닌 경우 index.html 반환
            if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
                const indexPath = join(frontendDistPath, 'index.html');
                res.sendFile(indexPath, (err) => {
                    if (err) {
                        // 프론트엔드 빌드가 없으면 개발 모드로 안내
                        res.status(404).json({
                            error: '프론트엔드를 찾을 수 없습니다.',
                            hint: '개발 모드: npm run dev로 프론트엔드를 별도 실행하세요.',
                            apiUrl: `http://localhost:${config.port}/api`
                        });
                    }
                });
            } else {
                next();
            }
        });

        // 404 핸들러
        app.use((req, res) => {
            res.status(404).json({ error: '페이지를 찾을 수 없습니다.' });
        });

        // 에러 핸들러 - 프로덕션에서는 상세 에러 숨김
        app.use((err, req, res, next) => {
            console.error('Error:', err);

            // CORS 에러 처리
            if (err.message === 'CORS 정책에 의해 차단되었습니다.') {
                return res.status(403).json({ error: err.message });
            }

            // 프로덕션 환경에서는 상세 에러 메시지 숨김
            const errorMessage = process.env.NODE_ENV === 'production'
                ? '서버 오류가 발생했습니다.'
                : err.message || '서버 오류가 발생했습니다.';

            res.status(500).json({ error: errorMessage });
        });

        // 서버 시작
        app.listen(config.port, config.host, () => {
            console.log(`🌳 ${config.wiki.name} 서버가 http://${config.host}:${config.port} 에서 실행 중입니다.`);
            console.log(`📚 API 문서: http://localhost:${config.port}/api`);
            console.log(`🔒 보안 기능: Helmet, Rate Limiting, XSS 방지 활성화`);

            // 라즈베리 파이 감지
            if (process.arch === 'arm' || process.arch === 'arm64') {
                console.log(`🍓 라즈베리 파이 환경이 감지되었습니다. (${process.arch})`);
            }

            // 메모리 사용량 표시
            const memUsage = process.memoryUsage();
            console.log(`💾 메모리 사용: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
        });

        // 정상 종료 처리
        process.on('SIGTERM', () => {
            console.log('서버 종료 중...');
            process.exit(0);
        });

        process.on('SIGINT', () => {
            console.log('서버 종료 중...');
            process.exit(0);
        });

    } catch (error) {
        console.error('서버 시작 실패:', error);
        process.exit(1);
    }
}

startServer();

export { writeLimiter, authLimiter };
export default app;
