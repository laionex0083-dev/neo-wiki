/**
 * Namulike Parser
 * 나무위키 스타일 문법을 HTML로 변환하는 파서
 * 
 * 지원 문법:
 * - 링크: [[문서명]], [[문서명|표시]], [[#앵커]]
 * - 외부링크: [[https://...|표시]]
 * - 서식: '''굵게''', ''기울임'', ~~취소선~~, __밑줄__, ^^위첨자^^, ,,아래첨자,,
 * - 코드: {{{코드}}}, {{{#!syntax 언어\n코드}}}
 * - 제목: = 제목 =, == 소제목 ==
 * - 목록: * 글머리, 1. 번호
 * - 인용: > 인용문
 * - 각주: [* 각주내용], [*A 각주]
 * - 이미지: [[파일:이미지.png]], [[파일:이미지.png|width=100]]
 * - 틀: [include(틀이름)]
 * - 수평선: ----
 * - 테이블: || 셀 || 셀 ||
 * - 접기: {{{#!folding 제목\n내용}}}
 * - 문단: [목차]
 */

import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

// Node.js 환경에서 DOMPurify 초기화
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// DOMPurify 설정 - 위키에서 허용할 태그/속성 정의
const SANITIZE_CONFIG = {
    ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins',
        'sup', 'sub', 'mark', 'small',
        'a', 'img', 'iframe',
        'ul', 'ol', 'li',
        'blockquote', 'pre', 'code',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'div', 'span', 'details', 'summary',
        'ruby', 'rt', 'rp'
    ],
    ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'class', 'id',
        'width', 'height', 'style', 'loading',
        'target', 'rel', 'colspan', 'rowspan',
        'frameborder', 'allowfullscreen', 'allow'
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'object', 'embed', 'form', 'input', 'textarea', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
};

/**
 * HTML을 sanitize하는 함수
 */
function sanitizeHtml(html) {
    return purify.sanitize(html, SANITIZE_CONFIG);
}


export class NamulikeParser {
    constructor(options = {}) {
        this.footnotes = [];
        this.footnoteIndex = 0;
        this.toc = [];
        this.tocIndex = 0;
        this.options = {
            enableExternalLinks: true,
            enableImages: true,
            baseUrl: '/w/',
            imageBaseUrl: '/uploads/',
            ...options
        };
    }

    /**
     * 메인 파싱 함수
     * @param {string} text - Namulike 텍스트
     * @returns {object} - { html, toc, footnotes }
     */
    parse(text) {
        this.footnotes = [];
        this.footnoteIndex = 0;
        this.toc = [];
        this.tocIndex = 0;
        this.inlineCodeBlocks = []; // 인라인 코드 블록 보호용

        // 전처리
        let processed = this.preprocess(text);

        // 블록 레벨 파싱
        processed = this.parseBlocks(processed);

        // 인라인 레벨 파싱
        processed = this.parseInline(processed);

        // 인라인 코드 블록 복원
        this.inlineCodeBlocks.forEach((code, index) => {
            processed = processed.replace(`\x01INLINE_CODE_${index}\x01`,
                `<code class="wiki-inline-code">${this.escapeHtml(code)}</code>`);
        });

        // 각주 렌더링
        const footnotesHtml = this.renderFootnotes();

        // XSS 방지를 위한 HTML 살균 처리
        const finalHtml = sanitizeHtml(processed + footnotesHtml);

        return {
            html: finalHtml,
            toc: this.toc,
            footnotes: this.footnotes
        };
    }

    /**
     * 전처리 - 특수문자 이스케이프 등
     */
    preprocess(text) {
        // CRLF -> LF
        text = text.replace(/\r\n/g, '\n');

        // HTML 엔티티 이스케이프 (코드 블록 제외하고)
        // 코드 블록을 임시로 보호
        const codeBlocks = [];
        text = text.replace(/\{\{\{([\s\S]*?)\}\}\}/g, (match) => {
            const index = codeBlocks.length;
            codeBlocks.push(match);
            return `\x00CODE_BLOCK_${index}\x00`;
        });

        // HTML 이스케이프
        text = text.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // 코드 블록 복원
        codeBlocks.forEach((block, index) => {
            text = text.replace(`\x00CODE_BLOCK_${index}\x00`, block);
        });

        return text;
    }

    /**
     * 블록 레벨 파싱 (제목, 목록, 인용, 코드블록 등)
     */
    parseBlocks(text) {
        const lines = text.split('\n');
        let result = [];
        let currentList = null;
        let currentQuote = null;
        let inCodeBlock = false;
        let codeBlockContent = '';
        let codeBlockLang = '';
        let codeBlockType = '';

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            // 코드 블록 시작/종료 처리
            if (line.includes('{{{') && !inCodeBlock) {
                // 멀티라인 코드블록 체크 (folding 포함)
                const foldingMatch = line.match(/^\{\{\{#!folding\s+(.+)\s*$/);
                if (foldingMatch) {
                    inCodeBlock = true;
                    codeBlockType = 'folding';
                    codeBlockLang = foldingMatch[1].trim(); // folding 제목
                    codeBlockContent = '';
                    continue;
                }

                const codeMatch = line.match(/^\{\{\{(#!(\w+)(?:\s+(\w+))?)?\s*$/);
                if (codeMatch) {
                    inCodeBlock = true;
                    codeBlockType = codeMatch[2] || '';
                    codeBlockLang = codeMatch[3] || codeMatch[2] || '';
                    codeBlockContent = '';
                    continue;
                }
            }

            if (inCodeBlock) {
                if (line.includes('}}}')) {
                    inCodeBlock = false;
                    // 코드블록 종료
                    if (codeBlockType === 'syntax') {
                        result.push(`<pre class="code-block syntax-${codeBlockLang}"><code>${this.escapeHtml(codeBlockContent.trim())}</code></pre>`);
                    } else if (codeBlockType === 'folding') {
                        // 접기 블록 - 내부 콘텐츠 재귀 파싱
                        const title = codeBlockLang || '펼치기';
                        const parsedContent = this.parseBlocks(codeBlockContent.trim());
                        result.push(`<details class="wiki-folding"><summary>${title}</summary><div>${parsedContent}</div></details>`);
                    } else if (codeBlockType === 'html') {
                        // HTML 블록도 반드시 sanitize 적용 (XSS 방지)
                        result.push(`<div class="wiki-html">${sanitizeHtml(codeBlockContent)}</div>`);
                    } else {
                        result.push(`<pre class="code-block"><code>${this.escapeHtml(codeBlockContent.trim())}</code></pre>`);
                    }
                    codeBlockContent = '';
                    codeBlockType = '';
                    codeBlockLang = '';
                    continue;
                }
                codeBlockContent += line + '\n';
                continue;
            }

            // 수평선
            if (/^-{4,}\s*$/.test(line)) {
                this.flushList(result, currentList);
                this.flushQuote(result, currentQuote);
                currentList = null;
                currentQuote = null;
                result.push('<hr class="wiki-hr">');
                continue;
            }

            // 제목 (= 제목 =)
            const headingMatch = line.match(/^(={1,6})\s*(.+?)\s*\1\s*$/);
            if (headingMatch) {
                this.flushList(result, currentList);
                this.flushQuote(result, currentQuote);
                currentList = null;
                currentQuote = null;

                const level = headingMatch[1].length;
                const title = headingMatch[2];
                this.tocIndex++;
                const id = `toc_${this.tocIndex}`;
                this.toc.push({ level, title, id });

                result.push(`<h${level} id="${id}" class="wiki-heading wiki-heading-${level}">${title}</h${level}>`);
                continue;
            }

            // 인용문 (>)
            const quoteMatch = line.match(/^(&gt;|>)\s?(.*)$/);
            if (quoteMatch) {
                this.flushList(result, currentList);
                currentList = null;

                if (!currentQuote) {
                    currentQuote = [];
                }
                currentQuote.push(quoteMatch[2]);
                continue;
            } else if (currentQuote) {
                this.flushQuote(result, currentQuote);
                currentQuote = null;
            }

            // 목록 (* 또는 숫자.)
            const ulMatch = line.match(/^(\s*)\*\s?(.*)$/);
            const olMatch = line.match(/^(\s*)(\d+)\.\s?(.*)$/);

            if (ulMatch) {
                this.flushQuote(result, currentQuote);
                currentQuote = null;

                const indent = ulMatch[1].length;
                const content = ulMatch[2];

                if (!currentList) {
                    currentList = { type: 'ul', items: [], indent: 0 };
                }
                currentList.items.push({ content, indent, type: 'ul' });
                continue;
            }

            if (olMatch) {
                this.flushQuote(result, currentQuote);
                currentQuote = null;

                const indent = olMatch[1].length;
                const content = olMatch[3];

                if (!currentList) {
                    currentList = { type: 'ol', items: [], indent: 0 };
                }
                currentList.items.push({ content, indent, type: 'ol' });
                continue;
            }

            // 목록이 아닌 일반 줄이면 목록 종료
            if (currentList) {
                this.flushList(result, currentList);
                currentList = null;
            }

            // 테이블 (멀티라인 지원)
            if (line.trim().startsWith('||') || /^\|[^|]+\|$/.test(line.trim())) {
                this.flushList(result, currentList);
                this.flushQuote(result, currentQuote);
                currentList = null;
                currentQuote = null;

                let tableLines = [];
                // 캡션이 있거나, ||로 시작하는 줄이 계속되는 동안 수집
                while (i < lines.length) {
                    let nextLine = lines[i].trim();
                    if (nextLine.startsWith('||') || /^\|[^|]+\|$/.test(nextLine)) {
                        tableLines.push(lines[i]);
                        i++;
                    } else {
                        i--; // 테이블이 아닌 줄이 나오면 인덱스 복구하고 루프 종료
                        break;
                    }
                }

                if (tableLines.length > 0) {
                    result.push(this.renderTable(tableLines));
                }
                continue;
            }

            // 일반 단락
            if (line.trim() === '') {
                result.push('<br>');
            } else {
                result.push(`<p>${line}</p>`);
            }
        }

        // 남은 블록 정리
        this.flushList(result, currentList);
        this.flushQuote(result, currentQuote);

        return result.join('\n');
    }

    /**
     * 목록 출력
     */
    flushList(result, list) {
        if (!list || list.items.length === 0) return;

        const buildList = (items, type = 'ul') => {
            let html = `<${type} class="wiki-list">`;
            for (const item of items) {
                html += `<li>${item.content}</li>`;
            }
            html += `</${type}>`;
            return html;
        };

        result.push(buildList(list.items, list.items[0]?.type || 'ul'));
    }

    /**
     * 인용문 출력
     */
    flushQuote(result, quote) {
        if (!quote || quote.length === 0) return;
        result.push(`<blockquote class="wiki-quote">${quote.join('<br>')}</blockquote>`);
    }

    /**
     * 테이블 전체 렌더링 (멀티라인, Rowspan/Colspan/스타일 지원)
     */
    renderTable(lines) {
        let html = '<div class="wiki-table-wrap"><table class="wiki-table">';
        let caption = '';

        // 1. 캡션 처리 (|제목| 형태가 첫 줄에 있는 경우)
        if (lines.length > 0 && /^\|[^|]+\|$/.test(lines[0].trim())) {
            caption = lines[0].trim().replace(/^\||\|$/g, '');
            lines.shift();
        }

        if (caption) {
            html += `<caption>${caption}</caption>`;
        }

        // 2. 데이터 전처리 (셀 분리)
        let rows = [];
        for (let line of lines) {
            let cells = line.split('||');
            // 양 끝의 빈 문자열 제거
            if (cells.length > 0 && cells[0].trim() === '') cells.shift();
            if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop();

            if (cells.length > 0) {
                rows.push(cells);
            }
        }

        // 3. 렌더링 (Rowspan 추적 알고리즘)
        let rowspanMap = {};

        for (let r = 0; r < rows.length; r++) {
            let trStyle = '';
            let rowHtml = '';
            let colIndex = 0;
            let cellIndex = 0;

            // 현재 행 시작 전, 윗 행에서 내려온 rowspan 처리
            while (rowspanMap[colIndex] > 0) {
                rowspanMap[colIndex]--;
                colIndex++;
            }

            while (cellIndex < rows[r].length) {
                // Rowspan으로 건너뛸 칸 확인
                while (rowspanMap[colIndex] > 0) {
                    rowspanMap[colIndex]--;
                    colIndex++;
                }

                let rawContent = rows[r][cellIndex];
                let parsed = this.parseTableCellParams(rawContent);

                // 행 전체 스타일 적용
                if (parsed.rowStyle) {
                    trStyle += parsed.rowStyle;
                }

                // Rowspan 기록
                if (parsed.rowspan > 1) {
                    for (let k = 0; k < parsed.colspan; k++) {
                        rowspanMap[colIndex + k] = parsed.rowspan - 1;
                    }
                }

                // HTML 속성 조립
                let attrs = [];
                if (parsed.colspan > 1) attrs.push(`colspan="${parsed.colspan}"`);
                if (parsed.rowspan > 1) attrs.push(`rowspan="${parsed.rowspan}"`);
                if (parsed.style) attrs.push(`style="${parsed.style}"`);
                if (parsed.class) attrs.push(`class="${parsed.class}"`);

                rowHtml += `<td ${attrs.join(' ')}>${parsed.content}</td>`;

                colIndex += parsed.colspan;
                cellIndex++;
            }

            html += `<tr style="${trStyle}">${rowHtml}</tr>`;
        }

        html += '</table></div>';
        return html;
    }

    /**
     * 셀 파라미터 파싱 (<...> 또는 &lt;...&gt;)
     */
    parseTableCellParams(text) {
        let params = {
            colspan: 1,
            rowspan: 1,
            style: '',
            rowStyle: '',
            class: '',
            content: text.trim()
        };

        // HTML 이스케이프된 버전 먼저 처리 (&lt;...&gt;)
        const escapedParamRegex = /^&lt;([^&]+)&gt;/;
        // 일반 버전 (<...>)
        const normalParamRegex = /^<([^>]+)>/;

        while (true) {
            // 이스케이프된 버전 먼저 시도
            let match = params.content.match(escapedParamRegex);
            if (!match) {
                // 일반 버전 시도
                match = params.content.match(normalParamRegex);
            }
            if (!match) break;

            let fullTag = match[0];
            let content = match[1];

            params.content = params.content.substring(fullTag.length).trim();

            // Colspan (<-2>)
            if (/^-\d+$/.test(content)) {
                params.colspan = parseInt(content.replace('-', ''));
            }
            // Rowspan (<|2> 또는 <^|2>)
            else if (/^(\^|v)?\|\d+$/.test(content)) {
                let num = content.replace(/[^0-9]/g, '');
                params.rowspan = parseInt(num);
                if (content.startsWith('^')) params.style += 'vertical-align: top; ';
                if (content.startsWith('v')) params.style += 'vertical-align: bottom; ';
            }
            // 정렬 ((, :, ))
            else if (content === '(') params.style += 'text-align: left; ';
            else if (content === ':') params.style += 'text-align: center; ';
            else if (content === ')') params.style += 'text-align: right; ';
            // 속성 (bgcolor=..., color=..., width=...)
            else {
                if (content.startsWith('#')) {
                    params.style += `background-color: ${content}; `;
                } else {
                    let parts = content.split('=');
                    let key = parts[0].trim().toLowerCase();
                    let val = parts.length > 1 ? parts[1].trim() : '';

                    if (key === 'bgcolor') params.style += `background-color: ${val}; `;
                    else if (key === 'color') params.style += `color: ${val}; `;
                    else if (key === 'width') params.style += `width: ${val}; `;
                    else if (key === 'height') params.style += `height: ${val}; `;
                    else if (key === 'rowbgcolor') params.rowStyle += `background-color: ${val}; `;
                    else if (key === 'rowcolor') params.rowStyle += `color: ${val}; `;
                }
            }
        }

        // 공백 기반 자동 정렬 처리
        if (!params.style.includes('text-align')) {
            if (params.content.startsWith(' ') && params.content.endsWith(' ')) {
                params.style += 'text-align: center; ';
                params.content = params.content.trim();
            } else if (params.content.startsWith(' ')) {
                params.style += 'text-align: right; ';
                params.content = params.content.trimStart();
            } else if (params.content.endsWith(' ')) {
                params.content = params.content.trimEnd();
            }
        }

        return params;
    }

    /**
     * 인라인 레벨 파싱 (링크, 서식 등)
     */
    parseInline(text) {
        // 인라인 코드 {{{...}}} - 내용을 보호하기 위해 플레이스홀더로 대체
        // 정규식: 중첩되지 않은 {{{ }}} 매칭
        text = text.replace(/\{\{\{((?:(?!\{\{\{|\}\}\}).)*)\}\}\}/g, (match, content) => {
            const index = this.inlineCodeBlocks.length;
            this.inlineCodeBlocks.push(content);
            return `\x01INLINE_CODE_${index}\x01`;
        });

        // 내부 링크 [[문서명]] 또는 [[문서명|표시]]
        text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (match, page, display) => {
            page = page.trim();
            display = display.trim();

            // 외부 링크
            if (page.startsWith('http://') || page.startsWith('https://')) {
                if (this.options.enableExternalLinks) {
                    return `<a href="${this.escapeHtml(page)}" class="wiki-link-external" target="_blank" rel="noopener">${display}</a>`;
                }
                return display;
            }

            // 파일/이미지
            if (page.startsWith('파일:') || page.startsWith('File:')) {
                return this.renderImage(page, display);
            }

            // 분류 - 본문에서는 렌더링하지 않음 (하단 분류 섹션에서 표시)
            if (page.startsWith('분류:') || page.startsWith('Category:')) {
                return ''; // 본문에서는 빈 문자열 반환
            }

            // 앵커 링크
            if (page.startsWith('#')) {
                return `<a href="${page}" class="wiki-link-anchor">${display}</a>`;
            }

            // 일반 내부 링크
            return `<a href="${this.options.baseUrl}${encodeURIComponent(page)}" class="wiki-link">${display}</a>`;
        });

        // 내부 링크 [[문서명]]
        text = text.replace(/\[\[([^\]]+)\]\]/g, (match, page) => {
            page = page.trim();

            // 외부 링크
            if (page.startsWith('http://') || page.startsWith('https://')) {
                if (this.options.enableExternalLinks) {
                    return `<a href="${this.escapeHtml(page)}" class="wiki-link-external" target="_blank" rel="noopener">${page}</a>`;
                }
                return page;
            }

            // 파일/이미지
            if (page.startsWith('파일:') || page.startsWith('File:')) {
                return this.renderImage(page);
            }

            // 분류 - 본문에서는 렌더링하지 않음 (하단 분류 섹션에서 표시)
            if (page.startsWith('분류:') || page.startsWith('Category:')) {
                return ''; // 본문에서는 빈 문자열 반환
            }

            // 앵커
            if (page.startsWith('#')) {
                return `<a href="${page}" class="wiki-link-anchor">${page}</a>`;
            }

            return `<a href="${this.options.baseUrl}${encodeURIComponent(page)}" class="wiki-link">${page}</a>`;
        });

        // 각주 [* 내용] 또는 [*A 내용]
        text = text.replace(/\[\*(\w?)\s+([^\]]+)\]/g, (match, label, content) => {
            this.footnoteIndex++;
            const id = label || this.footnoteIndex;
            this.footnotes.push({ id, content, index: this.footnoteIndex });
            return `<sup class="wiki-footnote-ref"><a href="#fn_${id}" id="rfn_${id}">[${id}]</a></sup>`;
        });

        // 목차 [목차] 또는 [목차(펼침)]
        text = text.replace(/\[(목차|toc)(\([^\)]*\))?\]/gi, (match) => {
            return '<div class="wiki-toc" id="wiki-toc">[목차]</div>';
        });

        // 굵게 '''텍스트'''
        text = text.replace(/'''([^']+)'''/g, '<strong>$1</strong>');

        // 기울임 ''텍스트''
        text = text.replace(/''([^']+)''/g, '<em>$1</em>');

        // 취소선 ~~텍스트~~
        text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');

        // 밑줄 __텍스트__
        text = text.replace(/__([^_]+)__/g, '<u>$1</u>');

        // 위첨자 ^^텍스트^^
        text = text.replace(/\^\^([^\^]+)\^\^/g, '<sup>$1</sup>');

        // 아래첨자 ,,텍스트,,
        text = text.replace(/,,([^,]+),,/g, '<sub>$1</sub>');

        // 글자 크기 {{{+1 텍스트}}} ~ {{{+5 텍스트}}}
        for (let i = 1; i <= 5; i++) {
            const regex = new RegExp(`\\{\\{\\{\\+${i}\\s+([^}]+)\\}\\}\\}`, 'g');
            text = text.replace(regex, `<span class="wiki-size-up-${i}">$1</span>`);
        }
        for (let i = 1; i <= 5; i++) {
            const regex = new RegExp(`\\{\\{\\{-${i}\\s+([^}]+)\\}\\}\\}`, 'g');
            text = text.replace(regex, `<span class="wiki-size-down-${i}">$1</span>`);
        }

        // 글자 색상 {{{#색상 텍스트}}}
        text = text.replace(/\{\{\{#([a-fA-F0-9]{3,6})\s+([^}]+)\}\}\}/g,
            '<span style="color: #$1">$2</span>');
        text = text.replace(/\{\{\{#(\w+)\s+([^}]+)\}\}\}/g,
            '<span style="color: $1">$2</span>');

        // 줄바꿈 [br]
        text = text.replace(/\[br\]/gi, '<br>');

        // 나이/날짜 계산 매크로 [age(YYYY-MM-DD)]
        text = text.replace(/\[age\((\d{4}-\d{2}-\d{2})\)\]/gi, (match, date) => {
            try {
                const birth = new Date(date);
                const today = new Date();
                let age = today.getFullYear() - birth.getFullYear();
                const m = today.getMonth() - birth.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                    age--;
                }
                return `<span class="wiki-age">${age}</span>`;
            } catch {
                return match;
            }
        });

        // 현재 날짜/시간 [date], [datetime]
        text = text.replace(/\[date\]/gi, new Date().toLocaleDateString('ko-KR'));
        text = text.replace(/\[datetime\]/gi, new Date().toLocaleString('ko-KR'));

        // 유튜브 임베드 [youtube(영상id)] 또는 [youtube(영상id, width=너비, height=높이)]
        text = text.replace(/\[youtube\(([a-zA-Z0-9_-]{11})(?:,\s*width=(\d+))?(?:,\s*height=(\d+))?\)\]/gi,
            (match, videoId, width, height) => {
                const w = width || 560;
                const h = height || 315;
                return `<div class="wiki-youtube"><iframe width="${w}" height="${h}" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
            }
        );

        return text;
    }

    /**
     * 이미지 렌더링
     */
    renderImage(page, options = '') {
        if (!this.options.enableImages) return '';

        const filename = page.replace(/^(파일|File):/, '');
        const optParts = options.split('&').reduce((acc, opt) => {
            const [key, value] = opt.split('=');
            if (key && value) acc[key.trim()] = value.trim();
            return acc;
        }, {});

        let style = '';
        if (optParts.width) style += `width: ${optParts.width}px; `;
        if (optParts.height) style += `height: ${optParts.height}px; `;
        if (optParts.align) style += `float: ${optParts.align}; `;

        // original_name으로 이미지를 가져오는 API 사용
        const src = `/api/upload/file/${encodeURIComponent(filename)}`;
        const alt = optParts.alt || filename;

        return `<img src="${src}" alt="${this.escapeHtml(alt)}" class="wiki-image"${style ? ` style="${style}"` : ''} loading="lazy">`;
    }

    /**
     * 각주 렌더링
     */
    renderFootnotes() {
        if (this.footnotes.length === 0) return '';

        let html = '<div class="wiki-footnotes"><h3>각주</h3><ol>';
        for (const fn of this.footnotes) {
            html += `<li id="fn_${fn.id}"><a href="#rfn_${fn.id}">↑</a> ${fn.content}</li>`;
        }
        html += '</ol></div>';
        return html;
    }

    /**
     * HTML 이스케이프 (내부용)
     */
    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

/**
 * 간편 파싱 함수
 */
export function parseNamulike(text, options = {}) {
    const parser = new NamulikeParser(options);
    return parser.parse(text);
}

export default NamulikeParser;
