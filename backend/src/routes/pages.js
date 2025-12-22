import express from 'express';
import { dbHelper, saveDatabase } from '../database/init.js';
import { parseNamuMark } from '../parser/namumark.js';

const router = express.Router();

/**
 * 문서 목록 조회
 */
router.get('/', (req, res) => {
    try {
        const { search, namespace = 'main', limit = 20, offset = 0 } = req.query;

        let sql = 'SELECT id, title, namespace, updated_at, view_count FROM pages WHERE 1=1';
        const params = [];

        if (search) {
            sql += ` AND title LIKE '%${search}%'`;
        }

        if (namespace !== 'all') {
            sql += ` AND namespace = '${namespace}'`;
        }

        sql += ` ORDER BY updated_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

        const pages = dbHelper.prepare(sql).all();

        // 전체 개수
        let countSql = 'SELECT COUNT(*) as total FROM pages WHERE 1=1';
        if (search) {
            countSql += ` AND title LIKE '%${search}%'`;
        }
        if (namespace !== 'all') {
            countSql += ` AND namespace = '${namespace}'`;
        }
        const countResult = dbHelper.prepare(countSql).get();
        const total = countResult?.total || 0;

        res.json({
            pages,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Error fetching pages:', error);
        res.status(500).json({ error: '문서 목록을 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 랜덤 문서
 */
router.get('/special/random', (req, res) => {
    try {
        const page = dbHelper.prepare(
            "SELECT title FROM pages WHERE namespace = 'main' ORDER BY RANDOM() LIMIT 1"
        ).get();

        if (!page) {
            return res.status(404).json({ error: '문서가 없습니다.' });
        }

        res.json({ title: page.title });
    } catch (error) {
        console.error('Error getting random page:', error);
        res.status(500).json({ error: '랜덤 문서를 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 최근 변경
 */
router.get('/special/recent', (req, res) => {
    try {
        const { limit = 50 } = req.query;

        const changes = dbHelper.prepare(`
      SELECT h.id, h.page_id, h.revision, h.title, h.edit_summary, h.edited_at, h.bytes_changed
      FROM page_history h
      ORDER BY h.edited_at DESC
      LIMIT ${parseInt(limit)}
    `).all();

        res.json({ changes });
    } catch (error) {
        console.error('Error getting recent changes:', error);
        res.status(500).json({ error: '최근 변경을 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 특정 문서 조회
 */
router.get('/:title', (req, res) => {
    try {
        const title = decodeURIComponent(req.params.title);

        const page = dbHelper.prepare(
            `SELECT * FROM pages WHERE title = ?`
        ).get(title);

        if (!page) {
            return res.status(404).json({
                error: '문서를 찾을 수 없습니다.',
                title,
                exists: false
            });
        }

        // 조회수 증가
        dbHelper.prepare('UPDATE pages SET view_count = view_count + 1 WHERE id = ?').run(page.id);

        // 리다이렉트 처리
        if (page.is_redirect && page.redirect_to) {
            return res.json({
                redirect: true,
                redirect_to: page.redirect_to,
                original_title: title
            });
        }

        // NamuMark 파싱
        const parsed = parseNamuMark(page.content || '', {
            baseUrl: '/w/'
        });

        // 분류 추출
        const categories = dbHelper.prepare(
            'SELECT category_name FROM categories WHERE page_id = ?'
        ).all(page.id).map(c => c.category_name);

        // 백링크
        const backlinks = dbHelper.prepare(`
      SELECT DISTINCT p.title 
      FROM backlinks b 
      JOIN pages p ON b.from_page_id = p.id 
      WHERE b.to_page_title = ?
      LIMIT 20
    `).all(title).map(b => b.title);

        res.json({
            ...page,
            html: parsed.html,
            toc: parsed.toc,
            categories,
            backlinks,
            exists: true
        });
    } catch (error) {
        console.error('Error fetching page:', error);
        res.status(500).json({ error: '문서를 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 문서 원본(Raw) 조회
 */
router.get('/:title/raw', (req, res) => {
    try {
        const title = decodeURIComponent(req.params.title);
        const page = dbHelper.prepare('SELECT content FROM pages WHERE title = ?').get(title);

        if (!page) {
            return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
        }

        res.json({ content: page.content, title });
    } catch (error) {
        console.error('Error fetching raw page:', error);
        res.status(500).json({ error: '문서 원본을 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 문서 생성/수정
 */
router.post('/:title', (req, res) => {
    try {
        const title = decodeURIComponent(req.params.title);
        const { content, edit_summary = '' } = req.body;

        if (typeof content !== 'string') {
            return res.status(400).json({ error: '문서 내용이 필요합니다.' });
        }

        const existingPage = dbHelper.prepare('SELECT * FROM pages WHERE title = ?').get(title);
        const bytesChanged = content.length - (existingPage?.content?.length || 0);

        if (existingPage) {
            // 기존 문서 수정
            dbHelper.prepare(
                `UPDATE pages SET content = ?, updated_at = datetime('now') WHERE id = ?`
            ).run(content, existingPage.id);

            // 히스토리 기록
            const lastRevision = dbHelper.prepare(
                'SELECT MAX(revision) as rev FROM page_history WHERE page_id = ?'
            ).get(existingPage.id);

            dbHelper.prepare(`
        INSERT INTO page_history (page_id, revision, title, content, edit_summary, bytes_changed)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
                existingPage.id,
                (lastRevision?.rev || 0) + 1,
                title,
                content,
                edit_summary,
                bytesChanged
            );

            // 백링크/분류 업데이트
            updateBacklinks(existingPage.id, content);
            updateCategories(existingPage.id, content);

            res.json({ success: true, message: '문서가 수정되었습니다.', id: existingPage.id });
        } else {
            // 새 문서 생성
            const result = dbHelper.prepare(`
        INSERT INTO pages (title, content, namespace)
        VALUES (?, ?, 'main')
      `).run(title, content);

            const pageId = result.lastInsertRowid;

            // 첫 히스토리 기록
            dbHelper.prepare(`
        INSERT INTO page_history (page_id, revision, title, content, edit_summary, bytes_changed)
        VALUES (?, 1, ?, ?, ?, ?)
      `).run(pageId, title, content, edit_summary || '새 문서 작성', content.length);

            // 백링크/분류 업데이트
            updateBacklinks(pageId, content);
            updateCategories(pageId, content);

            res.json({ success: true, message: '새 문서가 생성되었습니다.', id: pageId });
        }
    } catch (error) {
        console.error('Error saving page:', error);
        res.status(500).json({ error: '문서를 저장하는 중 오류가 발생했습니다.' });
    }
});

/**
 * 문서 삭제
 */
router.delete('/:title', (req, res) => {
    try {
        const title = decodeURIComponent(req.params.title);

        const page = dbHelper.prepare('SELECT id FROM pages WHERE title = ?').get(title);
        if (!page) {
            return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
        }

        dbHelper.prepare('DELETE FROM backlinks WHERE from_page_id = ?').run(page.id);
        dbHelper.prepare('DELETE FROM categories WHERE page_id = ?').run(page.id);
        dbHelper.prepare('DELETE FROM page_history WHERE page_id = ?').run(page.id);
        dbHelper.prepare('DELETE FROM pages WHERE id = ?').run(page.id);

        res.json({ success: true, message: '문서가 삭제되었습니다.' });
    } catch (error) {
        console.error('Error deleting page:', error);
        res.status(500).json({ error: '문서를 삭제하는 중 오류가 발생했습니다.' });
    }
});

/**
 * 백링크 업데이트
 */
function updateBacklinks(pageId, content) {
    dbHelper.prepare('DELETE FROM backlinks WHERE from_page_id = ?').run(pageId);

    const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let match;
    const links = new Set();

    while ((match = linkRegex.exec(content)) !== null) {
        let link = match[1].trim();
        if (!link.startsWith('http') &&
            !link.startsWith('파일:') &&
            !link.startsWith('File:') &&
            !link.startsWith('분류:') &&
            !link.startsWith('Category:') &&
            !link.startsWith('#')) {
            links.add(link);
        }
    }

    for (const link of links) {
        dbHelper.prepare(
            'INSERT INTO backlinks (from_page_id, to_page_title) VALUES (?, ?)'
        ).run(pageId, link);
    }
}

/**
 * 분류 업데이트
 */
function updateCategories(pageId, content) {
    dbHelper.prepare('DELETE FROM categories WHERE page_id = ?').run(pageId);

    const catRegex = /\[\[(분류|Category):([^\]|]+)(?:\|[^\]]+)?\]\]/gi;
    let match;
    const categories = new Set();

    while ((match = catRegex.exec(content)) !== null) {
        categories.add(match[2].trim());
    }

    for (const cat of categories) {
        dbHelper.prepare(
            'INSERT INTO categories (page_id, category_name) VALUES (?, ?)'
        ).run(pageId, cat);
    }
}

export default router;
