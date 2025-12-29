import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbHelper } from '../database/init.js';
import { authLimiter } from '../app.js';

const router = express.Router();

// JWT 비밀키 - 프로덕션 환경에서는 반드시 환경변수 설정 필요
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다. 프로덕션 환경에서는 필수입니다.');
    }
    console.warn('⚠️ JWT_SECRET이 설정되지 않았습니다. 개발용 기본값을 사용합니다.');
}
const SECRET_KEY = JWT_SECRET || 'dev-only-secret-key-do-not-use-in-production';

// 사용자 권한 레벨 정의
const ROLES = {
    BLOCKED: 'blocked',    // 차단된 사용자
    GUEST: 'guest',        // 비로그인 사용자
    USER: 'user',          // 일반 사용자
    VERIFIED: 'verified',  // 인증된 사용자
    MODERATOR: 'moderator', // 모더레이터
    ADMIN: 'admin',        // 관리자
    OWNER: 'owner'         // 오너 (최고 권한)
};

// 권한 레벨 순서 (높을수록 강력)
const ROLE_LEVELS = {
    [ROLES.BLOCKED]: -1,
    [ROLES.GUEST]: 0,
    [ROLES.USER]: 1,
    [ROLES.VERIFIED]: 2,
    [ROLES.MODERATOR]: 3,
    [ROLES.ADMIN]: 4,
    [ROLES.OWNER]: 5
};

/**
 * 권한 확인 함수
 */
function hasPermission(userRole, requiredRole) {
    return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
}

/**
 * 회원가입
 */
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '사용자명과 비밀번호는 필수입니다.' });
        }

        if (username.length < 2 || username.length > 20) {
            return res.status(400).json({ error: '사용자명은 2~20자 사이여야 합니다.' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: '비밀번호는 최소 8자 이상이어야 합니다.' });
        }

        // 비밀번호 복잡성 검증 (대문자, 소문자, 숫자, 특수문자 중 3가지 이상)
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        const complexityScore = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;

        if (complexityScore < 3) {
            return res.status(400).json({
                error: '비밀번호는 대문자, 소문자, 숫자, 특수문자 중 3가지 이상을 포함해야 합니다.'
            });
        }

        // 예약된 사용자명 확인
        const reservedNames = ['admin', 'administrator', 'system', 'root', 'moderator'];
        if (reservedNames.includes(username.toLowerCase())) {
            return res.status(400).json({ error: '사용할 수 없는 사용자명입니다.' });
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

        // 첫 번째 사용자는 오너(owner)
        const userCount = dbHelper.prepare('SELECT COUNT(*) as count FROM users').get();
        const role = (userCount?.count || 0) === 0 ? ROLES.OWNER : ROLES.USER;

        // 사용자 생성
        const result = dbHelper.prepare(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run(username, email || null, passwordHash, role);

        // JWT 토큰 발급
        const token = jwt.sign(
            { userId: result.lastInsertRowid, username, role },
            SECRET_KEY,
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
router.post('/login', authLimiter, async (req, res) => {
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
        if (user.is_blocked || user.role === ROLES.BLOCKED) {
            const blockInfo = dbHelper.prepare(
                'SELECT * FROM user_blocks WHERE user_id = ? AND is_active = 1 ORDER BY blocked_at DESC LIMIT 1'
            ).get(user.id);

            return res.status(403).json({
                error: '차단된 사용자입니다.',
                reason: blockInfo?.reason || user.block_reason,
                expires_at: blockInfo?.expires_at || user.blocked_until
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
            SECRET_KEY,
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
      SELECT id, username, email, role, created_at, last_login, edit_count, is_blocked
      FROM users WHERE id = ?
    `).get(req.user.userId);

        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        res.json({
            user,
            permissions: {
                canEdit: !user.is_blocked && hasPermission(user.role, ROLES.USER),
                canDelete: hasPermission(user.role, ROLES.ADMIN),
                canBlock: hasPermission(user.role, ROLES.MODERATOR),
                canProtect: hasPermission(user.role, ROLES.MODERATOR),
                canManageUsers: hasPermission(user.role, ROLES.ADMIN),
                isAdmin: hasPermission(user.role, ROLES.ADMIN)
            }
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: '사용자 정보를 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 사용자 프로필 조회
 */
router.get('/profile/:username', (req, res) => {
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

// ============================================
// 관리자 기능
// ============================================

/**
 * 사용자 목록 조회 (관리자 전용)
 */
router.get('/admin/users', authenticateToken, requireRole(ROLES.ADMIN), (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const users = dbHelper.prepare(`
            SELECT id, username, email, role, created_at, last_login, edit_count, is_blocked, blocked_until, block_reason
            FROM users
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).all(parseInt(limit, 10), parseInt(offset, 10));

        const total = dbHelper.prepare('SELECT COUNT(*) as count FROM users').get();

        res.json({ users, total: total?.count || 0 });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: '사용자 목록을 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 사용자 권한 변경 (관리자 전용)
 */
router.post('/admin/users/:userId/role', authenticateToken, requireRole(ROLES.ADMIN), (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        // 유효한 역할인지 확인
        if (!Object.values(ROLES).includes(role)) {
            return res.status(400).json({ error: '유효하지 않은 권한입니다.' });
        }

        // 자신의 권한은 변경 불가
        if (parseInt(userId) === req.user.userId) {
            return res.status(400).json({ error: '자신의 권한은 변경할 수 없습니다.' });
        }

        const targetUser = dbHelper.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!targetUser) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // 오너는 다른 오너만 변경 가능
        if (targetUser.role === ROLES.OWNER && req.user.role !== ROLES.OWNER) {
            return res.status(403).json({ error: '오너 권한은 변경할 수 없습니다.' });
        }

        dbHelper.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);

        // 관리자 로그 기록
        dbHelper.prepare(`
            INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
            VALUES (?, ?, ?, ?, ?)
        `).run(req.user.userId, 'change_role', 'user', userId, JSON.stringify({ oldRole: targetUser.role, newRole: role }));

        res.json({ success: true, message: '권한이 변경되었습니다.' });
    } catch (error) {
        console.error('Error changing user role:', error);
        res.status(500).json({ error: '권한 변경 중 오류가 발생했습니다.' });
    }
});

/**
 * 사용자 차단 (중재자 이상)
 */
router.post('/admin/users/:userId/block', authenticateToken, requireRole(ROLES.MODERATOR), (req, res) => {
    try {
        const { userId } = req.params;
        const { reason, duration } = req.body; // duration: 분 단위 (null이면 무기한)

        const targetUser = dbHelper.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!targetUser) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // 자신보다 높은 권한은 차단 불가
        if (ROLE_LEVELS[targetUser.role] >= ROLE_LEVELS[req.user.role]) {
            return res.status(403).json({ error: '이 사용자를 차단할 권한이 없습니다.' });
        }

        let expiresAt = null;
        if (duration) {
            const expireDate = new Date(Date.now() + duration * 60 * 1000);
            expiresAt = expireDate.toISOString();
        }

        // 차단 기록 생성
        dbHelper.prepare(`
            INSERT INTO user_blocks (user_id, blocked_by, expires_at, reason)
            VALUES (?, ?, ?, ?)
        `).run(userId, req.user.userId, expiresAt, reason || '규정 위반');

        // 사용자 차단 상태 업데이트
        dbHelper.prepare(`
            UPDATE users SET is_blocked = 1, blocked_until = ?, block_reason = ? WHERE id = ?
        `).run(expiresAt, reason || '규정 위반', userId);

        // 관리자 로그 기록
        dbHelper.prepare(`
            INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
            VALUES (?, ?, ?, ?, ?)
        `).run(req.user.userId, 'block_user', 'user', userId, JSON.stringify({ reason, duration, expiresAt }));

        res.json({ success: true, message: '사용자가 차단되었습니다.' });
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).json({ error: '사용자 차단 중 오류가 발생했습니다.' });
    }
});

/**
 * 사용자 차단 해제 (중재자 이상)
 */
router.post('/admin/users/:userId/unblock', authenticateToken, requireRole(ROLES.MODERATOR), (req, res) => {
    try {
        const { userId } = req.params;

        // 기존 차단 기록 비활성화
        dbHelper.prepare('UPDATE user_blocks SET is_active = 0 WHERE user_id = ?').run(userId);

        // 사용자 차단 상태 해제
        dbHelper.prepare(`
            UPDATE users SET is_blocked = 0, blocked_until = NULL, block_reason = NULL WHERE id = ?
        `).run(userId);

        // 관리자 로그 기록
        dbHelper.prepare(`
            INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
            VALUES (?, ?, ?, ?, ?)
        `).run(req.user.userId, 'unblock_user', 'user', userId, '{}');

        res.json({ success: true, message: '사용자 차단이 해제되었습니다.' });
    } catch (error) {
        console.error('Error unblocking user:', error);
        res.status(500).json({ error: '차단 해제 중 오류가 발생했습니다.' });
    }
});

/**
 * 문서 보호 설정 (중재자 이상)
 */
router.post('/admin/pages/:title/protect', authenticateToken, requireRole(ROLES.MODERATOR), (req, res) => {
    try {
        const title = decodeURIComponent(req.params.title);
        const { editRequire = 'user', reason, expiresAt } = req.body;

        const page = dbHelper.prepare('SELECT id FROM pages WHERE title = ?').get(title);
        if (!page) {
            return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
        }

        // 기존 보호 설정 확인
        const existingAcl = dbHelper.prepare('SELECT id FROM page_acl WHERE page_id = ?').get(page.id);

        if (existingAcl) {
            dbHelper.prepare(`
                UPDATE page_acl SET
                    edit_require = ?,
                    protected_by = ?,
                    protected_at = datetime('now'),
                    expires_at = ?,
                    reason = ?
                WHERE page_id = ?
            `).run(editRequire, req.user.userId, expiresAt || null, reason, page.id);
        } else {
            dbHelper.prepare(`
                INSERT INTO page_acl (page_id, page_title, edit_require, protected_by, expires_at, reason)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(page.id, title, editRequire, req.user.userId, expiresAt || null, reason);
        }

        // 관리자 로그 기록
        dbHelper.prepare(`
            INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
            VALUES (?, ?, ?, ?, ?)
        `).run(req.user.userId, 'protect_page', 'page', page.id, JSON.stringify({ editRequire, reason }));

        res.json({ success: true, message: '문서가 보호되었습니다.' });
    } catch (error) {
        console.error('Error protecting page:', error);
        res.status(500).json({ error: '문서 보호 중 오류가 발생했습니다.' });
    }
});

/**
 * 문서 보호 해제 (중재자 이상)
 */
router.post('/admin/pages/:title/unprotect', authenticateToken, requireRole(ROLES.MODERATOR), (req, res) => {
    try {
        const title = decodeURIComponent(req.params.title);

        const page = dbHelper.prepare('SELECT id FROM pages WHERE title = ?').get(title);
        if (!page) {
            return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
        }

        dbHelper.prepare('DELETE FROM page_acl WHERE page_id = ?').run(page.id);

        // 관리자 로그 기록
        dbHelper.prepare(`
            INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
            VALUES (?, ?, ?, ?, ?)
        `).run(req.user.userId, 'unprotect_page', 'page', page.id, '{}');

        res.json({ success: true, message: '문서 보호가 해제되었습니다.' });
    } catch (error) {
        console.error('Error unprotecting page:', error);
        res.status(500).json({ error: '문서 보호 해제 중 오류가 발생했습니다.' });
    }
});

/**
 * 관리자 로그 조회 (관리자 전용)
 */
router.get('/admin/logs', authenticateToken, requireRole(ROLES.ADMIN), (req, res) => {
    try {
        const { limit = 100, offset = 0 } = req.query;

        const logs = dbHelper.prepare(`
            SELECT al.*, u.username as admin_username
            FROM admin_logs al
            LEFT JOIN users u ON al.admin_id = u.id
            ORDER BY al.created_at DESC
            LIMIT ? OFFSET ?
        `).all(parseInt(limit, 10), parseInt(offset, 10));

        res.json({ logs });
    } catch (error) {
        console.error('Error fetching admin logs:', error);
        res.status(500).json({ error: '관리자 로그를 가져오는 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 미들웨어
// ============================================

/**
 * JWT 인증 미들웨어
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
        }
        req.user = user;
        next();
    });
}

/**
 * 선택적 인증 미들웨어 (비로그인도 허용)
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        jwt.verify(token, SECRET_KEY, (err, user) => {
            if (!err) {
                req.user = user;
            }
        });
    }
    next();
}

/**
 * 권한 요구 미들웨어
 */
function requireRole(requiredRole) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: '인증이 필요합니다.' });
        }

        if (!hasPermission(req.user.role, requiredRole)) {
            return res.status(403).json({ error: '권한이 부족합니다.' });
        }

        next();
    };
}

/**
 * 문서 편집 권한 확인 미들웨어
 */
async function canEditPage(req, res, next) {
    try {
        const title = decodeURIComponent(req.params.title);

        // 문서 ACL 확인
        const acl = dbHelper.prepare(`
            SELECT * FROM page_acl 
            WHERE page_title = ? 
            AND (expires_at IS NULL OR expires_at > datetime('now'))
        `).get(title);

        if (!acl) {
            // ACL이 없으면 모든 사용자 편집 가능
            return next();
        }

        const userRole = req.user?.role || ROLES.GUEST;

        if (!hasPermission(userRole, acl.edit_require)) {
            return res.status(403).json({
                error: '이 문서를 편집할 권한이 없습니다.',
                required: acl.edit_require,
                reason: acl.reason
            });
        }

        next();
    } catch (error) {
        console.error('Error checking page ACL:', error);
        res.status(500).json({ error: '권한 확인 중 오류가 발생했습니다.' });
    }
}

export { authenticateToken, optionalAuth, requireRole, canEditPage, ROLES, hasPermission };
export default router;
