import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function CategoryListPage() {
    const [categories, setCategories] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/categories?limit=500');
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '분류 목록을 불러올 수 없습니다.');
            }

            setCategories(data.categories || []);
            setTotal(data.total || 0);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // 검색 필터
    const filteredCategories = categories.filter(cat =>
        cat.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 알파벳/가나다순으로 그룹화
    const groupedCategories = filteredCategories.reduce((acc, cat) => {
        const firstChar = cat.name.charAt(0).toUpperCase();
        // 한글인지 확인
        const isKorean = /[가-힣]/.test(firstChar);
        // 영어인지 확인
        const isEnglish = /[A-Z]/.test(firstChar);

        let group;
        if (isKorean) {
            // 한글 초성 그룹
            const code = firstChar.charCodeAt(0) - 0xAC00;
            const cho = Math.floor(code / 588);
            const chosung = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
            group = chosung[cho] || '기타';
        } else if (isEnglish) {
            group = firstChar;
        } else {
            group = '기타';
        }

        if (!acc[group]) {
            acc[group] = [];
        }
        acc[group].push(cat);
        return acc;
    }, {});

    // 그룹 정렬 (ㄱㄴㄷ -> ABC -> 기타)
    const koreanOrder = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
    const sortedGroups = Object.keys(groupedCategories).sort((a, b) => {
        const aIsKorean = koreanOrder.includes(a);
        const bIsKorean = koreanOrder.includes(b);
        const aIsEnglish = /[A-Z]/.test(a);
        const bIsEnglish = /[A-Z]/.test(b);

        if (aIsKorean && !bIsKorean) return -1;
        if (!aIsKorean && bIsKorean) return 1;
        if (aIsKorean && bIsKorean) return koreanOrder.indexOf(a) - koreanOrder.indexOf(b);
        if (aIsEnglish && !bIsEnglish) return -1;
        if (!aIsEnglish && bIsEnglish) return 1;
        return a.localeCompare(b);
    });

    if (loading) {
        return (
            <div className="wiki-page">
                <div className="loading">
                    <div className="loading-spinner"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="wiki-page">
                <div className="alert alert-error">{error}</div>
            </div>
        );
    }

    return (
        <div className="wiki-page">
            {/* 헤더 */}
            <div className="wiki-page-header">
                <h1 className="wiki-page-title">📂 분류 목록</h1>
            </div>

            {/* 검색 */}
            <div style={{ marginBottom: '1.5rem' }}>
                <input
                    type="text"
                    className="form-input"
                    placeholder="분류 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '100%', maxWidth: '400px' }}
                />
            </div>

            {/* 통계 */}
            <div style={{
                padding: '1rem',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.5rem'
            }}>
                <span>총 <strong>{total}</strong>개의 분류</span>
                {searchTerm && (
                    <span style={{ marginLeft: '1rem', color: 'var(--color-text-muted)' }}>
                        (검색 결과: {filteredCategories.length}개)
                    </span>
                )}
            </div>

            {/* 분류 목록 */}
            {filteredCategories.length > 0 ? (
                <div>
                    {sortedGroups.map(group => (
                        <div key={group} style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{
                                fontSize: '1.1rem',
                                borderBottom: '2px solid var(--color-accent)',
                                paddingBottom: '0.5rem',
                                marginBottom: '0.75rem'
                            }}>
                                {group}
                            </h3>
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '0.5rem'
                            }}>
                                {groupedCategories[group].map(cat => (
                                    <Link
                                        key={cat.name}
                                        to={`/category/${encodeURIComponent(cat.name)}`}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.4rem 0.8rem',
                                            background: 'var(--color-bg-secondary)',
                                            borderRadius: 'var(--radius-md)',
                                            color: 'var(--color-link)',
                                            textDecoration: 'none',
                                            fontSize: '0.9rem',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-tertiary)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-bg-secondary)'}
                                    >
                                        {cat.name}
                                        <span style={{
                                            background: 'var(--color-accent)',
                                            color: 'white',
                                            padding: '0.1rem 0.4rem',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '0.75rem',
                                            fontWeight: 600
                                        }}>
                                            {cat.page_count}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{
                    padding: '3rem',
                    textAlign: 'center',
                    color: 'var(--color-text-muted)'
                }}>
                    {searchTerm ? '검색 결과가 없습니다.' : '등록된 분류가 없습니다.'}
                </div>
            )}
        </div>
    );
}

export default CategoryListPage;
