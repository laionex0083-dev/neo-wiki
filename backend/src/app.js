import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase } from './database/init.js';
import config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// 미들웨어
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 정적 파일 (업로드된 이미지)
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// 프론트엔드 정적 파일 (프로덕션용)
const frontendDistPath = join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// API 라우트는 DB 초기화 후 로드
async function startServer() {
    try {
        // 데이터베이스 초기화 (비동기)
        await initDatabase();

        // 라우트 동적 로드
        const pagesRouter = (await import('./routes/pages.js')).default;
        const usersRouter = (await import('./routes/users.js')).default;
        const uploadRouter = (await import('./routes/upload.js')).default;
        const historyRouter = (await import('./routes/history.js')).default;
        const skinsRouter = (await import('./routes/skins.js')).default;

        // API 라우트
        app.use('/api/pages', pagesRouter);
        app.use('/api/users', usersRouter);
        app.use('/api/upload', uploadRouter);
        app.use('/api/history', historyRouter);
        app.use('/api/skins', skinsRouter);

        // 기본 라우트
        app.get('/api', (req, res) => {
            res.json({
                name: config.wiki.name,
                version: '1.0.0',
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

        // 에러 핸들러
        app.use((err, req, res, next) => {
            console.error('Error:', err);
            res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        });

        // 서버 시작
        app.listen(config.port, config.host, () => {
            console.log(`🌳 ${config.wiki.name} 서버가 http://${config.host}:${config.port} 에서 실행 중입니다.`);
            console.log(`📚 API 문서: http://localhost:${config.port}/api`);

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

export default app;
