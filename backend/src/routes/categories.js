import express from 'express';
import { dbHelper } from '../database/init.js';

const router = express.Router();

/**
 * 전체 분류 목록 조회
 * GET /api/categories
 */
router.get('/', (req, res) => {
    try {
        const { limit = 100, offset = 0 } = req.query;

        // 분류별 문서 수와 함께 조회
        const categories = dbHelper.prepare(`
            SELECT 
                category_name as name,
                COUNT(*) as page_count
            FROM categories
            GROUP BY category_name
            ORDER BY category_name COLLATE NOCASE
            LIMIT ? OFFSET ?
        `).all(parseInt(limit, 10), parseInt(offset, 10));

        // 전체 분류 수
        const countResult = dbHelper.prepare(`
            SELECT COUNT(DISTINCT category_name) as total FROM categories
        `).get();
        const total = countResult?.total || 0;

        res.json({ categories, total });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: '분류 목록을 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 특정 분류에 속한 문서 목록 조회
 * GET /api/categories/:name
 */
router.get('/:name', (req, res) => {
    try {
        const categoryName = decodeURIComponent(req.params.name);
        const { limit = 50, offset = 0, sort = 'title' } = req.query;

        // 정렬 옵션
        let orderBy = 'p.title COLLATE NOCASE';
        if (sort === 'updated') {
            orderBy = 'p.updated_at DESC';
        } else if (sort === 'created') {
            orderBy = 'p.created_at DESC';
        }

        // 해당 분류에 속한 문서 목록
        const pages = dbHelper.prepare(`
            SELECT 
                p.id,
                p.title,
                p.namespace,
                p.created_at,
                p.updated_at,
                p.view_count
            FROM pages p
            INNER JOIN categories c ON p.id = c.page_id
            WHERE c.category_name = ?
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?
        `).all(categoryName, parseInt(limit, 10), parseInt(offset, 10));

        // 해당 분류의 문서 수
        const countResult = dbHelper.prepare(`
            SELECT COUNT(*) as total 
            FROM categories 
            WHERE category_name = ?
        `).get(categoryName);
        const total = countResult?.total || 0;

        // 하위 분류 조회 (분류:상위분류/하위분류 형식 지원)
        const subcategories = dbHelper.prepare(`
            SELECT DISTINCT category_name as name
            FROM categories
            WHERE category_name LIKE ? || '/%'
            ORDER BY category_name COLLATE NOCASE
        `).all(categoryName);

        // 상위 분류 확인
        let parentCategory = null;
        if (categoryName.includes('/')) {
            parentCategory = categoryName.substring(0, categoryName.lastIndexOf('/'));
        }

        res.json({
            name: categoryName,
            pages,
            total,
            subcategories: subcategories.map(s => s.name),
            parentCategory
        });
    } catch (error) {
        console.error('Error fetching category pages:', error);
        res.status(500).json({ error: '분류 문서를 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 문서에 속한 분류 목록 조회
 * GET /api/categories/page/:title
 */
router.get('/page/:title', (req, res) => {
    try {
        const title = decodeURIComponent(req.params.title);

        // 문서 ID 조회
        const page = dbHelper.prepare('SELECT id FROM pages WHERE title = ?').get(title);
        if (!page) {
            return res.json({ categories: [] });
        }

        // 해당 문서의 분류 목록
        const categories = dbHelper.prepare(`
            SELECT category_name as name
            FROM categories
            WHERE page_id = ?
            ORDER BY category_name COLLATE NOCASE
        `).all(page.id);

        res.json({ categories: categories.map(c => c.name) });
    } catch (error) {
        console.error('Error fetching page categories:', error);
        res.status(500).json({ error: '문서 분류를 가져오는 중 오류가 발생했습니다.' });
    }
});

export default router;
