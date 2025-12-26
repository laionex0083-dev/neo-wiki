/**
 * 날짜/시간 포맷팅 유틸리티
 * 
 * - 백엔드는 UTC로 시간을 저장
 * - 프론트엔드에서 사용자의 로컬 시간대로 자동 변환
 * - 브라우저의 Intl API를 사용하여 로컬라이즈된 시간 표시
 */

/**
 * UTC 날짜 문자열을 사용자 로컬 시간대로 변환하여 상대적 시간 또는 포맷된 날짜로 반환
 * @param {string} dateStr - ISO 8601 형식의 UTC 날짜 문자열 (예: "2025-12-24 00:27:40" 또는 "2025-12-24T00:27:40Z")
 * @param {Object} options - 옵션
 * @param {boolean} options.relative - 상대적 시간 표시 여부 (기본: true)
 * @param {boolean} options.showSeconds - 초 표시 여부 (기본: false)
 * @param {string} options.locale - 로케일 (기본: 'ko-KR')
 * @returns {string} 포맷된 날짜/시간 문자열
 */
export function formatDate(dateStr, options = {}) {
    if (!dateStr) return '-';

    const {
        relative = true,
        showSeconds = false,
        locale = 'ko-KR'
    } = options;

    // SQLite datetime 형식 처리 (공백을 T로 변환)
    // "2025-12-24 00:27:40" → "2025-12-24T00:27:40Z"
    let normalizedDateStr = dateStr;
    if (dateStr.includes(' ') && !dateStr.includes('T')) {
        normalizedDateStr = dateStr.replace(' ', 'T') + 'Z';
    } else if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
        // UTC 표시가 없으면 추가
        normalizedDateStr = dateStr + 'Z';
    }

    const date = new Date(normalizedDateStr);

    // 유효하지 않은 날짜 처리
    if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateStr);
        return dateStr;
    }

    const now = new Date();
    const diff = now - date;

    // 상대적 시간 표시 (24시간 이내)
    if (relative) {
        // 1분 이내
        if (diff < 60000) {
            return '방금 전';
        }
        // 1시간 이내
        if (diff < 3600000) {
            const mins = Math.floor(diff / 60000);
            return `${mins}분 전`;
        }
        // 24시간 이내
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours}시간 전`;
        }
        // 7일 이내 (일 단위 표시)
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days}일 전`;
        }
    }

    // 절대 시간 표시 (로컬 시간대 적용)
    const formatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        ...(showSeconds && { second: '2-digit' }),
        hour12: false // 24시간 형식
    };

    return date.toLocaleString(locale, formatOptions);
}

/**
 * 날짜만 포맷 (시간 제외)
 * @param {string} dateStr - ISO 8601 형식의 UTC 날짜 문자열
 * @param {string} locale - 로케일 (기본: 'ko-KR')
 * @returns {string} 포맷된 날짜 문자열 (예: "2025. 12. 24.")
 */
export function formatDateOnly(dateStr, locale = 'ko-KR') {
    if (!dateStr) return '-';

    let normalizedDateStr = dateStr;
    if (dateStr.includes(' ') && !dateStr.includes('T')) {
        normalizedDateStr = dateStr.replace(' ', 'T') + 'Z';
    } else if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
        normalizedDateStr = dateStr + 'Z';
    }

    const date = new Date(normalizedDateStr);

    if (isNaN(date.getTime())) {
        return dateStr;
    }

    return date.toLocaleDateString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * 시간만 포맷 (날짜 제외)
 * @param {string} dateStr - ISO 8601 형식의 UTC 날짜 문자열
 * @param {string} locale - 로케일 (기본: 'ko-KR')
 * @returns {string} 포맷된 시간 문자열 (예: "09:30")
 */
export function formatTimeOnly(dateStr, locale = 'ko-KR') {
    if (!dateStr) return '-';

    let normalizedDateStr = dateStr;
    if (dateStr.includes(' ') && !dateStr.includes('T')) {
        normalizedDateStr = dateStr.replace(' ', 'T') + 'Z';
    } else if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
        normalizedDateStr = dateStr + 'Z';
    }

    const date = new Date(normalizedDateStr);

    if (isNaN(date.getTime())) {
        return dateStr;
    }

    return date.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

/**
 * 전체 날짜/시간을 상세하게 포맷 (상대 시간 없이)
 * @param {string} dateStr - ISO 8601 형식의 UTC 날짜 문자열
 * @param {string} locale - 로케일 (기본: 'ko-KR')
 * @returns {string} 상세 포맷된 날짜/시간 문자열
 */
export function formatDateTimeFull(dateStr, locale = 'ko-KR') {
    return formatDate(dateStr, { relative: false, showSeconds: true, locale });
}

/**
 * 사용자의 현재 시간대 이름 반환
 * @returns {string} 시간대 이름 (예: "Asia/Seoul", "America/New_York")
 */
export function getUserTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * 사용자의 현재 UTC 오프셋 반환
 * @returns {string} UTC 오프셋 (예: "+09:00", "-05:00")
 */
export function getUserTimezoneOffset() {
    const offset = new Date().getTimezoneOffset();
    const hours = Math.abs(Math.floor(offset / 60));
    const minutes = Math.abs(offset % 60);
    const sign = offset <= 0 ? '+' : '-';
    return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * 바이트 변경량 포맷
 * @param {number} bytes - 바이트 수
 * @returns {string} 포맷된 바이트 문자열 (예: "+1,234", "-567", "±0")
 */
export function formatBytes(bytes) {
    if (bytes === 0 || bytes === null || bytes === undefined) return '±0';
    const sign = bytes > 0 ? '+' : '';
    return sign + bytes.toLocaleString();
}

/**
 * 파일 크기 포맷
 * @param {number} bytes - 바이트 수
 * @returns {string} 포맷된 파일 크기 (예: "1.5 MB", "256 KB")
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}
