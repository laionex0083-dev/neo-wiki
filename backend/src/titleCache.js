/**
 * 문서 제목 캐시 및 자동완성 검색 모듈
 * - 서버 시작 시 DB에서 모든 제목 로드
 * - 문서 생성/삭제 시 자동 갱신
 * - 한글 초성 검색 지원 (hangul-js)
 */

import Hangul from 'hangul-js';
import { dbHelper } from './database/init.js';

// 캐시된 문서 제목 목록
let titleCache = [];

// 한글 초성 목록
const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

// 문자가 초성인지 검사
function isChosung(char) {
    return CHOSUNG.includes(char);
}

// 문자열이 모두 초성인지 검사
function isAllChosung(str) {
    return str.split('').every(c => isChosung(c));
}

// 제목에서 초성 추출
function getChosung(str) {
    return Hangul.disassemble(str, true)
        .map(chars => chars[0] || '')
        .join('');
}

// 캐시 초기화 (서버 시작 시 호출)
export function initTitleCache() {
    try {
        const pages = dbHelper.prepare('SELECT title FROM pages ORDER BY title').all();
        titleCache = pages.map(p => ({
            title: p.title,
            titleLower: p.title.toLowerCase(),
            chosung: getChosung(p.title)
        }));
        console.log(`📚 제목 캐시 초기화 완료: ${titleCache.length}개 문서`);
    } catch (error) {
        console.error('제목 캐시 초기화 실패:', error);
        titleCache = [];
    }
}

// 캐시에 제목 추가 (문서 생성 시)
export function addToTitleCache(title) {
    // 중복 체크
    if (titleCache.some(t => t.title === title)) return;

    titleCache.push({
        title,
        titleLower: title.toLowerCase(),
        chosung: getChosung(title)
    });

    // 정렬 유지
    titleCache.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
}

// 캐시에서 제목 제거 (문서 삭제 시)
export function removeFromTitleCache(title) {
    titleCache = titleCache.filter(t => t.title !== title);
}

// 자동완성 검색
export function searchTitles(query, limit = 10) {
    if (!query || query.trim() === '') {
        return [];
    }

    const q = query.trim();
    const qLower = q.toLowerCase();
    const qChosung = getChosung(q);
    const isChosungOnly = isAllChosung(q);

    const results = [];

    for (const item of titleCache) {
        let matchType = null;
        let matchIndex = -1;

        // 1. 정확히 시작하는 경우 (가장 높은 우선순위)
        if (item.titleLower.startsWith(qLower)) {
            matchType = 'prefix';
            matchIndex = 0;
        }
        // 2. 포함하는 경우
        else if (item.titleLower.includes(qLower)) {
            matchType = 'contains';
            matchIndex = item.titleLower.indexOf(qLower);
        }
        // 3. 초성 검색 (한글 초성만 입력된 경우)
        else if (isChosungOnly && item.chosung.includes(qChosung)) {
            matchType = 'chosung';
            matchIndex = item.chosung.indexOf(qChosung);
        }
        // 4. 조합 중인 한글 검색 (부분 분해 비교)
        else {
            const searchResult = Hangul.search(item.title, q);
            if (searchResult >= 0) {
                matchType = 'hangul';
                matchIndex = searchResult;
            }
        }

        if (matchType) {
            results.push({
                title: item.title,
                matchType,
                matchIndex
            });
        }

        // 충분한 결과가 모이면 중단
        if (results.length >= limit * 2) break;
    }

    // 정렬: prefix > contains > hangul/chosung, 그 다음 matchIndex
    results.sort((a, b) => {
        const priority = { prefix: 0, contains: 1, hangul: 2, chosung: 3 };
        if (priority[a.matchType] !== priority[b.matchType]) {
            return priority[a.matchType] - priority[b.matchType];
        }
        return a.matchIndex - b.matchIndex;
    });

    return results.slice(0, limit).map(r => r.title);
}

// 캐시 상태 확인
export function getTitleCacheSize() {
    return titleCache.length;
}
