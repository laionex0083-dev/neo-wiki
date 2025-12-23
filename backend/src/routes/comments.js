import express from 'express';
import { dbHelper } from '../database/init.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'neo-wiki-secret-key-change-in-production';

/**
 * JWT 토큰에서 사용자 정보 추출
 */
function getUserFromToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (error) {
        return null;
    }
}

/**
 * 인증 미들웨어
 */
function requireAuth(req, res, next) {
    const user = getUserFromToken(req);
    if (!user) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
    }
    req.user = user;
    next();
}

/**
 * 특정 문서의 코멘트 목록 조회
 * GET /api/comments/:pageTitle
 */
router.get('/:pageTitle', (req, res) => {
    try {
        const { pageTitle } = req.params;
        const decodedTitle = decodeURIComponent(pageTitle);

        // 문서 ID 조회
        const page = dbHelper.prepare('SELECT id FROM pages WHERE title = ?').get(decodedTitle);
        if (!page) {
            return res.json({ comments: [], count: 0 });
        }

        // 코멘트 목록 조회 (최신순, 삭제되지 않은 것만)
        const comments = dbHelper.prepare(`
            SELECT 
                c.id,
                c.content,
                c.created_at,
                c.updated_at,
                c.is_edited,
                c.user_id,
                u.username
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.page_id = ? AND c.is_deleted = 0
            ORDER BY c.created_at DESC
        `).all(page.id);

        res.json({
            comments,
            count: comments.length
        });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: '코멘트를 불러오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 코멘트 작성
 * POST /api/comments/:pageTitle
 */
router.post('/:pageTitle', requireAuth, (req, res) => {
    try {
        const { pageTitle } = req.params;
        const { content } = req.body;
        const decodedTitle = decodeURIComponent(pageTitle);

        if (!content || !content.trim()) {
            return res.status(400).json({ error: '코멘트 내용을 입력해주세요.' });
        }

        if (content.length > 2000) {
            return res.status(400).json({ error: '코멘트는 2000자 이내로 작성해주세요.' });
        }

        // 문서 ID 조회
        const page = dbHelper.prepare('SELECT id FROM pages WHERE title = ?').get(decodedTitle);
        if (!page) {
            return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
        }

        // 코멘트 저장
        const result = dbHelper.prepare(`
            INSERT INTO comments (page_id, user_id, content)
            VALUES (?, ?, ?)
        `).run(page.id, req.user.userId, content.trim());

        // 저장된 코멘트 반환
        const newComment = dbHelper.prepare(`
            SELECT 
                c.id,
                c.content,
                c.created_at,
                c.updated_at,
                c.is_edited,
                c.user_id,
                u.username
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json({
            success: true,
            message: '코멘트가 등록되었습니다.',
            comment: newComment
        });
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ error: '코멘트 등록 중 오류가 발생했습니다.' });
    }
});

/**
 * 코멘트 수정
 * PUT /api/comments/id/:commentId
 */
router.put('/id/:commentId', requireAuth, (req, res) => {
    try {
        const { commentId } = req.params;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: '코멘트 내용을 입력해주세요.' });
        }

        if (content.length > 2000) {
            return res.status(400).json({ error: '코멘트는 2000자 이내로 작성해주세요.' });
        }

        // 코멘트 조회
        const comment = dbHelper.prepare('SELECT * FROM comments WHERE id = ? AND is_deleted = 0').get(commentId);
        if (!comment) {
            return res.status(404).json({ error: '코멘트를 찾을 수 없습니다.' });
        }

        // 본인 코멘트인지 확인 (관리자 제외)
        const user = dbHelper.prepare('SELECT role FROM users WHERE id = ?').get(req.user.userId);
        const isAdmin = user && ['admin', 'owner', 'moderator'].includes(user.role);

        if (comment.user_id !== req.user.userId && !isAdmin) {
            return res.status(403).json({ error: '본인의 코멘트만 수정할 수 있습니다.' });
        }

        // 코멘트 수정
        dbHelper.prepare(`
            UPDATE comments 
            SET content = ?, updated_at = datetime('now'), is_edited = 1
            WHERE id = ?
        `).run(content.trim(), commentId);

        // 수정된 코멘트 반환
        const updatedComment = dbHelper.prepare(`
            SELECT 
                c.id,
                c.content,
                c.created_at,
                c.updated_at,
                c.is_edited,
                c.user_id,
                u.username
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        `).get(commentId);

        res.json({
            success: true,
            message: '코멘트가 수정되었습니다.',
            comment: updatedComment
        });
    } catch (error) {
        console.error('Error updating comment:', error);
        res.status(500).json({ error: '코멘트 수정 중 오류가 발생했습니다.' });
    }
});

/**
 * 코멘트 삭제
 * DELETE /api/comments/id/:commentId
 */
router.delete('/id/:commentId', requireAuth, (req, res) => {
    try {
        const { commentId } = req.params;

        // 코멘트 조회
        const comment = dbHelper.prepare('SELECT * FROM comments WHERE id = ? AND is_deleted = 0').get(commentId);
        if (!comment) {
            return res.status(404).json({ error: '코멘트를 찾을 수 없습니다.' });
        }

        // 본인 코멘트인지 확인 (관리자는 모든 코멘트 삭제 가능)
        const user = dbHelper.prepare('SELECT role FROM users WHERE id = ?').get(req.user.userId);
        const isAdmin = user && ['admin', 'owner', 'moderator'].includes(user.role);

        if (comment.user_id !== req.user.userId && !isAdmin) {
            return res.status(403).json({ error: '본인의 코멘트만 삭제할 수 있습니다.' });
        }

        // 소프트 삭제
        dbHelper.prepare(`
            UPDATE comments SET is_deleted = 1, updated_at = datetime('now')
            WHERE id = ?
        `).run(commentId);

        res.json({
            success: true,
            message: '코멘트가 삭제되었습니다.'
        });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: '코멘트 삭제 중 오류가 발생했습니다.' });
    }
});

export default router;
