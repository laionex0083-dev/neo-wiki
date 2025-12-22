/**
 * 환경 설정 파일
 * 라즈베리 파이와 일반 환경 모두에서 동작
 */

const config = {
    // 서버 설정
    port: parseInt(process.env.PORT) || 3001,
    host: process.env.HOST || '0.0.0.0',  // 외부 접근 허용

    // JWT 설정
    jwtSecret: process.env.JWT_SECRET || 'neo-wiki-secret-key-change-in-production',
    jwtExpiry: process.env.JWT_EXPIRY || '7d',

    // 데이터베이스
    dbPath: process.env.DB_PATH || './data/wiki.db',

    // 업로드 설정
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB

    // 메모리 최적화 (라즈베리 파이용)
    enableMemoryOptimization: process.env.MEMORY_OPTIMIZE === 'true' || false,

    // 캐시 설정
    cacheEnabled: process.env.CACHE_ENABLED !== 'false',
    cacheTTL: parseInt(process.env.CACHE_TTL) || 300, // 5분

    // 로깅
    logLevel: process.env.LOG_LEVEL || 'info',

    // 위키 기본 설정
    wiki: {
        name: process.env.WIKI_NAME || 'Neo-Wiki',
        mainPage: process.env.WIKI_MAIN_PAGE || '대문',
        allowAnonymousEdit: process.env.ALLOW_ANONYMOUS_EDIT !== 'false',
        defaultSkin: process.env.DEFAULT_SKIN || 'default'
    }
};

export default config;
