import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbHelper } from '../database/init.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'neo-wiki-secret-key-change-in-production';

/**
 * 회원가입
 */
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '사용자명과 비밀번호는 필수입니다.' });
        }

        if (username.length < 2 || username.length > 20) {
            return res.status(400).json({ error: '사용자명은 2~20자 사이여야 합니다.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' });
        }

        // 중복 확인
        const existingUser = dbHelper.prepare(
            'SELECT id FROM users WHERE username = ?'
        ).get(username);

        if (existingUser) {
            return res.status(409).json({ error: '이미 존재하는 사용자명입니다.' });
        }

        // 비밀번호 해시
        const passwordHash = await bcrypt.hash(password, 10);

        // 첫 번째 사용자는 관리자
        const userCount = dbHelper.prepare('SELECT COUNT(*) as count FROM users').get();
        const role = (userCount?.count || 0) === 0 ? 'admin' : 'user';

        // 사용자 생성
        const result = dbHelper.prepare(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run(username, email || null, passwordHash, role);

        // JWT 토큰 발급
        const token = jwt.sign(
            { userId: result.lastInsertRowid, username, role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: '회원가입이 완료되었습니다.',
            user: { id: result.lastInsertRowid, username, role },
            token
        });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.' });
    }
});

/**
 * 로그인
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '사용자명과 비밀번호를 입력해주세요.' });
        }

        const user = dbHelper.prepare(
            'SELECT * FROM users WHERE username = ?'
        ).get(username);

        if (!user) {
            return res.status(401).json({ error: '잘못된 사용자명 또는 비밀번호입니다.' });
        }

        // 차단 확인
        if (user.is_blocked) {
            return res.status(403).json({
                error: '차단된 사용자입니다.',
                reason: user.block_reason
            });
        }

        // 비밀번호 확인
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: '잘못된 사용자명 또는 비밀번호입니다.' });
        }

        // 마지막 로그인 시간 업데이트
        dbHelper.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);

        // JWT 토큰 발급
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                edit_count: user.edit_count
            },
            token
        });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
    }
});

/**
 * 현재 사용자 정보
 */
router.get('/me', authenticateToken, (req, res) => {
    try {
        const user = dbHelper.prepare(`
      SELECT id, username, email, role, created_at, last_login, edit_count
      FROM users WHERE id = ?
    `).get(req.user.userId);

        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: '사용자 정보를 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 사용자 프로필 조회
 */
router.get('/:username', (req, res) => {
    try {
        const user = dbHelper.prepare(`
      SELECT id, username, role, created_at, edit_count
      FROM users WHERE username = ?
    `).get(req.params.username);

        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: '사용자 프로필을 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * JWT 인증 미들웨어
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
        }
        req.user = user;
        next();
    });
}

export { authenticateToken };
export default router;
