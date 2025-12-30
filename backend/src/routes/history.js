import express from 'express';
import { dbHelper } from '../database/init.js';
import { authenticateToken, requireRole, ROLES } from './users.js';

const router = express.Router();

/**
 * 문서 히스토리 목록
 */
router.get('/:title', (req, res) => {
    try {
        const title = decodeURIComponent(req.params.title);
        const { limit = 50, offset = 0 } = req.query;

        const page = dbHelper.prepare('SELECT id FROM pages WHERE title = ?').get(title);
        if (!page) {
            return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
        }

        const history = dbHelper.prepare(`
      SELECT h.id, h.page_id, h.revision, h.title, h.edit_summary, h.edited_at, h.bytes_changed, h.edited_by,
             u.username as editor_name
      FROM page_history h
      LEFT JOIN users u ON h.edited_by = u.id
      WHERE h.page_id = ?
      ORDER BY h.revision DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `).all(page.id);

        const countResult = dbHelper.prepare(
            'SELECT COUNT(*) as total FROM page_history WHERE page_id = ?'
        ).get(page.id);
        const total = countResult?.total || 0;

        res.json({ title, history, total });
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: '히스토리를 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 특정 리비전 조회
 */
router.get('/:title/:revision', (req, res) => {
    try {
        const title = decodeURIComponent(req.params.title);
        const revision = parseInt(req.params.revision);

        const page = dbHelper.prepare('SELECT id FROM pages WHERE title = ?').get(title);
        if (!page) {
            return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
        }

        const rev = dbHelper.prepare(`
      SELECT * FROM page_history WHERE page_id = ? AND revision = ?
    `).get(page.id, revision);

        if (!rev) {
            return res.status(404).json({ error: '리비전을 찾을 수 없습니다.' });
        }

        res.json({ title, revision: rev });
    } catch (error) {
        console.error('Error fetching revision:', error);
        res.status(500).json({ error: '리비전을 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 리비전으로 되돌리기 (모더레이터 이상만 가능)
 */
router.post('/:title/revert/:revision', authenticateToken, requireRole(ROLES.MODERATOR), (req, res) => {
    try {
        const title = decodeURIComponent(req.params.title);
        const revision = parseInt(req.params.revision);
        const { reason = '되돌리기' } = req.body;

        const page = dbHelper.prepare('SELECT * FROM pages WHERE title = ?').get(title);
        if (!page) {
            return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
        }

        const targetRevision = dbHelper.prepare(
            'SELECT content FROM page_history WHERE page_id = ? AND revision = ?'
        ).get(page.id, revision);

        if (!targetRevision) {
            return res.status(404).json({ error: '리비전을 찾을 수 없습니다.' });
        }

        // 현재 내용 업데이트
        dbHelper.prepare(
            `UPDATE pages SET content = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(targetRevision.content, page.id);

        // 새 히스토리 기록
        const lastRevision = dbHelper.prepare(
            'SELECT MAX(revision) as rev FROM page_history WHERE page_id = ?'
        ).get(page.id);

        const bytesChanged = (targetRevision.content || '').length - (page.content || '').length;

        dbHelper.prepare(`
      INSERT INTO page_history (page_id, revision, title, content, edit_summary, bytes_changed)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
            page.id,
            (lastRevision?.rev || 0) + 1,
            title,
            targetRevision.content,
            `r${revision}으로 되돌림: ${reason}`,
            bytesChanged
        );

        res.json({ success: true, message: `r${revision}으로 되돌렸습니다.` });
    } catch (error) {
        console.error('Error reverting:', error);
        res.status(500).json({ error: '되돌리기 중 오류가 발생했습니다.' });
    }
});

export default router;
