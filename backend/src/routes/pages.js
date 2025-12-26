import express from 'express';
import { dbHelper, saveDatabase } from '../database/init.js';
import { parseNamulike } from '../parser/namulike.js';
import { optionalAuth, canEditPage, ROLES, hasPermission } from './users.js';
import { searchTitles, addToTitleCache, removeFromTitleCache } from '../titleCache.js';
import { writeLimiter } from '../app.js';

const router = express.Router();

/**
 * LIKE 검색어 내의 특수문자(%, _, \)를 일반 문자로 인식하게 하는 이스케이프 함수
 * 백슬래시를 먼저 이스케이프한 후 %와 _를 이스케이프합니다.
 * @param {string} str - 이스케이프할 검색어
 * @returns {string} 이스케이프된 검색어
 */
const escapeLike = (str) => str.replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&');

/**
 * 틀(템플릿) 삽입 처리 함수
 * [include(틀:이름)] 또는 [include(이름)] 문법을 처리하여 해당 틀의 내용을 삽입
 * @param {string} content - 원본 문서 내용
 * @param {Set} processedTemplates - 이미 처리된 틀 목록 (순환 참조 방지)
 * @param {number} depth - 현재 재귀 깊이 (무한 루프 방지)
 * @returns {string} 틀이 삽입된 내용
 */
function processTemplates(content, processedTemplates = new Set(), depth = 0) {
    // 최대 재귀 깊이 제한 (무한 루프 방지)
    const MAX_DEPTH = 10;
    if (depth > MAX_DEPTH) {
        return content;
    }

    // [include(틀이름)] 또는 [include(틀:틀이름)] 패턴 매칭
    const includePattern = /\[include\(([^)]+)\)\]/gi;

    let result = content;
    let match;

    // 모든 include 문법을 찾아서 처리
    const matches = [];
    while ((match = includePattern.exec(content)) !== null) {
        matches.push({
            fullMatch: match[0],
            templateRef: match[1].trim()
        });
    }

    for (const { fullMatch, templateRef } of matches) {
        // 파라미터 분리 (틀이름, param1=value1, param2=value2, ...)
        const parts = templateRef.split(',').map(s => s.trim());
        let templateName = parts[0];

        // "틀:" 접두사가 없으면 추가
        if (!templateName.startsWith('틀:') && !templateName.startsWith('Template:')) {
            templateName = '틀:' + templateName;
        }

        // 순환 참조 체크
        if (processedTemplates.has(templateName)) {
            // NamuMark 문법으로 오류 표시
            result = result.replace(fullMatch, `'''⚠️ 순환 참조 오류: ${templateName}'''`);
            continue;
        }

        // 틀 문서 조회
        const templatePage = dbHelper.prepare(
            'SELECT content FROM pages WHERE title = ?'
        ).get(templateName);

        if (!templatePage) {
            // 틀이 존재하지 않는 경우 - NamuMark 문법으로 링크 생성
            result = result.replace(fullMatch, `[[${templateName}|[틀:${templateName.replace('틀:', '')} (없음)]]]`);
            continue;
        }

        // 파라미터 치환 처리
        let templateContent = templatePage.content;
        const params = parts.slice(1);

        for (const param of params) {
            const [key, value] = param.split('=').map(s => s.trim());
            if (key && value !== undefined) {
                // {{{파라미터명}}} 형태를 값으로 치환
                const paramPattern = new RegExp(`\\{\\{\\{${key}\\}\\}\\}`, 'g');
                templateContent = templateContent.replace(paramPattern, value);
            }
        }

        // 사용되지 않은 파라미터는 빈 문자열로 치환
        // 주의: {{{#!folding}}}, {{{#!syntax}}} 등 블록 문법은 제외
        // 파라미터 형태: {{{파라미터명}}} (중괄호 3개로 감싼 단순 텍스트, #!로 시작하지 않음)
        templateContent = templateContent.replace(/\{\{\{(?!#!)([^}]+)\}\}\}/g, '');

        // 재귀적으로 중첩된 틀 처리
        const newProcessed = new Set(processedTemplates);
        newProcessed.add(templateName);
        templateContent = processTemplates(templateContent, newProcessed, depth + 1);

        // 틀의 NamuMark 원본 내용을 그대로 삽입 (HTML 래퍼 없이)
        result = result.replace(fullMatch, templateContent);
    }

    return result;
}

/**
 * 자동완성 검색 API
 */
router.get('/autocomplete', (req, res) => {
    try {
        const { q, limit = 10 } = req.query;

        if (!q || q.trim() === '') {
            return res.json({ results: [] });
        }

        const results = searchTitles(q, parseInt(limit, 10));
        res.json({ results });
    } catch (error) {
        console.error('Error in autocomplete:', error);
        res.status(500).json({ error: '자동완성 검색 중 오류가 발생했습니다.' });
    }
});

/**
 * 미리보기 API - NamuMark를 HTML로 파싱 (저장하지 않음)
 */
router.post('/preview', (req, res) => {
    try {
        const { content } = req.body;

        if (typeof content !== 'string') {
            return res.status(400).json({ error: '내용이 필요합니다.' });
        }

        // 틀 삽입 처리
        const processedContent = processTemplates(content);

        const parsed = parseNamulike(processedContent);
        res.json({
            html: parsed.html,
            toc: parsed.toc
        });
    } catch (error) {
        console.error('Error in preview:', error);
        res.status(500).json({ error: '미리보기 처리 중 오류가 발생했습니다.' });
    }
});

/**
 * 문서 목록 조회
 */
router.get('/', (req, res) => {
    try {
        const { search, namespace = 'main', limit = 20, offset = 0 } = req.query;

        // SQL 인젝션 방어: 파라미터 바인딩 방식 사용
        let sql = 'SELECT id, title, namespace, updated_at, view_count FROM pages';
        let countSql = 'SELECT COUNT(*) as total FROM pages';
        const conditions = [];
        const params = [];
        const countParams = [];

        // 1. 검색어 조건 (와일드카드 이스케이프 처리)
        if (search) {
            conditions.push(`title LIKE ? ESCAPE '\\'`);
            const escapedSearch = `%${escapeLike(search)}%`;
            params.push(escapedSearch);
            countParams.push(escapedSearch);
        }

        // 2. 네임스페이스 조건
        if (namespace && namespace !== 'all') {
            conditions.push(`namespace = ?`);
            params.push(namespace);
            countParams.push(namespace);
        }

        // 3. WHERE 절 조립
        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            sql += whereClause;
            countSql += whereClause;
        }

        // 4. 정렬 및 페이징 (정수 파싱 시 10진수 명시)
        sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit, 10), parseInt(offset, 10));

        // 5. 실행
        const pages = dbHelper.prepare(sql).all(...params);
        const countResult = dbHelper.prepare(countSql).get(...countParams);
        const total = countResult?.total || 0;

        res.json({
            pages,
            total,
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10)
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
      LIMIT ?
    `).all(parseInt(limit, 10));

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

        // 틀 삽입 처리
        const processedContent = processTemplates(page.content || '');

        // Namulike 파싱
        const parsed = parseNamulike(processedContent, {
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
 * 역링크(Backlinks) 조회 - 해당 문서를 참조하는 모든 문서 목록
 */
router.get('/:title/backlinks', (req, res) => {
    try {
        const title = decodeURIComponent(req.params.title);

        // 해당 문서를 참조하는 모든 문서 목록 조회 (알파벳/가나다 순 정렬)
        const backlinks = dbHelper.prepare(`
            SELECT DISTINCT p.title, p.updated_at, p.view_count
            FROM backlinks b 
            JOIN pages p ON b.from_page_id = p.id 
            WHERE b.to_page_title = ?
            ORDER BY p.title COLLATE NOCASE ASC
        `).all(title);

        res.json({
            title,
            backlinks,
            count: backlinks.length
        });
    } catch (error) {
        console.error('Error fetching backlinks:', error);
        res.status(500).json({ error: '역링크를 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 문서 보호 상태 조회
 */
router.get('/:title/protection', (req, res) => {
    try {
        const title = decodeURIComponent(req.params.title);

        const protection = dbHelper.prepare(`
            SELECT pa.*, u.username as protected_by_username
            FROM page_acl pa
            LEFT JOIN users u ON pa.protected_by = u.id
            WHERE pa.page_title = ?
            AND (pa.expires_at IS NULL OR pa.expires_at > datetime('now'))
        `).get(title);

        res.json({
            protection: protection || null,
            isProtected: !!protection
        });
    } catch (error) {
        console.error('Error fetching page protection:', error);
        res.status(500).json({ error: '문서 보호 상태를 가져오는 중 오류가 발생했습니다.' });
    }
});
/**
 * 리다이렉트 문법 파싱
 * 형식: #redirect '문서명' 또는 #redirect "문서명"
 * @param {string} content - 문서 내용
 * @returns {{ isRedirect: boolean, redirectTo: string | null }}
 */
function parseRedirect(content) {
    if (!content) return { isRedirect: false, redirectTo: null };

    // 첫 줄만 확인 (리다이렉트는 문서 시작 부분에만 위치)
    const firstLine = content.split('\n')[0].trim();

    // #redirect '문서명' 또는 #redirect "문서명" 패턴 매칭
    // 대소문자 구분 없음
    const redirectMatch = firstLine.match(/^#redirect\s+['"]([^'"]+)['"]\s*$/i);

    if (redirectMatch) {
        return {
            isRedirect: true,
            redirectTo: redirectMatch[1].trim()
        };
    }

    return { isRedirect: false, redirectTo: null };
}

/**
 * 문서 생성/수정
 */
router.post('/:title', writeLimiter, optionalAuth, canEditPage, (req, res) => {
    try {
        const title = decodeURIComponent(req.params.title);
        const { content, edit_summary = '' } = req.body;

        if (typeof content !== 'string') {
            return res.status(400).json({ error: '문서 내용이 필요합니다.' });
        }

        // 리다이렉트 문법 파싱
        const { isRedirect, redirectTo } = parseRedirect(content);

        const existingPage = dbHelper.prepare('SELECT * FROM pages WHERE title = ?').get(title);
        const bytesChanged = content.length - (existingPage?.content?.length || 0);

        if (existingPage) {
            // 기존 문서 수정
            dbHelper.prepare(
                `UPDATE pages SET content = ?, is_redirect = ?, redirect_to = ?, updated_at = datetime('now') WHERE id = ?`
            ).run(content, isRedirect ? 1 : 0, redirectTo, existingPage.id);

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

            // 백링크/분류 업데이트 (리다이렉트 문서는 리다이렉트 대상을 백링크로 추가)
            updateBacklinks(existingPage.id, content);
            updateCategories(existingPage.id, content);

            res.json({
                success: true,
                message: isRedirect ? `'${redirectTo}'(으)로 리다이렉트 설정됨` : '문서가 수정되었습니다.',
                id: existingPage.id,
                isRedirect,
                redirectTo
            });
        } else {
            // 새 문서 생성
            const result = dbHelper.prepare(`
        INSERT INTO pages (title, content, namespace, is_redirect, redirect_to)
        VALUES (?, ?, 'main', ?, ?)
      `).run(title, content, isRedirect ? 1 : 0, redirectTo);

            const pageId = result.lastInsertRowid;

            // 첫 히스토리 기록
            dbHelper.prepare(`
        INSERT INTO page_history (page_id, revision, title, content, edit_summary, bytes_changed)
        VALUES (?, 1, ?, ?, ?, ?)
      `).run(pageId, title, content, edit_summary || (isRedirect ? `'${redirectTo}'(으)로 리다이렉트` : '새 문서 작성'), content.length);

            // 백링크/분류 업데이트
            updateBacklinks(pageId, content);
            updateCategories(pageId, content);

            // 제목 캐시에 추가
            addToTitleCache(title);

            res.json({
                success: true,
                message: isRedirect ? `'${redirectTo}'(으)로 리다이렉트 설정됨` : '새 문서가 생성되었습니다.',
                id: pageId,
                isRedirect,
                redirectTo
            });
        }
    } catch (error) {
        console.error('Error saving page:', error);
        res.status(500).json({ error: '문서를 저장하는 중 오류가 발생했습니다.' });
    }
});

/**
 * 문서 삭제 (관리자 권한 필요)
 */
router.delete('/:title', writeLimiter, optionalAuth, (req, res) => {
    try {
        const title = decodeURIComponent(req.params.title);

        // 관리자 권한 확인
        const userRole = req.user?.role || ROLES.GUEST;
        if (!hasPermission(userRole, ROLES.ADMIN)) {
            return res.status(403).json({ error: '문서 삭제는 관리자만 가능합니다.' });
        }

        const page = dbHelper.prepare('SELECT id FROM pages WHERE title = ?').get(title);
        if (!page) {
            return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
        }

        dbHelper.prepare('DELETE FROM backlinks WHERE from_page_id = ?').run(page.id);
        dbHelper.prepare('DELETE FROM categories WHERE page_id = ?').run(page.id);
        dbHelper.prepare('DELETE FROM page_acl WHERE page_id = ?').run(page.id);
        dbHelper.prepare('DELETE FROM page_history WHERE page_id = ?').run(page.id);
        dbHelper.prepare('DELETE FROM pages WHERE id = ?').run(page.id);

        // 제목 캐시에서 제거
        removeFromTitleCache(title);

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
