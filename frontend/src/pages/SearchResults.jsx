import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

function SearchResults() {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') || '';

    const [results, setResults] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (query) {
            searchPages();
        }
    }, [query]);

    const searchPages = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/pages?search=${encodeURIComponent(query)}&limit=50`);
            const data = await res.json();
            setResults(data.pages);
            setTotal(data.total);
        } catch (err) {
            console.error('Error searching:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="wiki-page">
                <div className="loading">
                    <div className="loading-spinner"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="wiki-page">
            <div className="wiki-page-header">
                <h1 className="wiki-page-title">검색: "{query}"</h1>
            </div>

            {/* 바로가기 */}
            <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                <Link to={`/w/${encodeURIComponent(query)}`}>
                    <strong>"{query}"</strong> 문서로 바로가기 →
                </Link>
            </div>

            <p style={{ marginBottom: '1rem', color: 'var(--color-text-muted)' }}>
                {total}개의 검색 결과
            </p>

            <div style={{ display: 'grid', gap: '0.5rem' }}>
                {results.map((page) => (
                    <div
                        key={page.id}
                        style={{
                            padding: '1rem',
                            background: 'var(--color-bg-secondary)',
                            borderRadius: 'var(--radius-md)'
                        }}
                    >
                        <Link
                            to={`/w/${encodeURIComponent(page.title)}`}
                            style={{
                                fontSize: '1.1rem',
                                fontWeight: 500,
                                display: 'block',
                                marginBottom: '0.25rem'
                            }}
                        >
                            {highlightMatch(page.title, query)}
                        </Link>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            마지막 수정: {new Date(page.updated_at).toLocaleDateString('ko-KR')}
                        </div>
                    </div>
                ))}
            </div>

            {results.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                        검색 결과가 없습니다.
                    </p>
                    <Link to={`/edit/${encodeURIComponent(query)}`} className="btn btn-primary">
                        "{query}" 문서 새로 작성하기
                    </Link>
                </div>
            )}
        </div>
    );
}

function highlightMatch(text, query) {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
            ? <mark key={i} style={{ background: 'var(--color-warning)', padding: '0 2px' }}>{part}</mark>
            : part
    );
}

export default SearchResults;
