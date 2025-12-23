import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

function BacklinksPage() {
    const { title: paramTitle } = useParams();
    const title = paramTitle ? decodeURIComponent(paramTitle) : '';

    const [backlinks, setBacklinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (title) {
            fetchBacklinks();
        }
    }, [title]);

    const fetchBacklinks = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/pages/${encodeURIComponent(title)}/backlinks`);
            const data = await res.json();

            if (res.ok) {
                setBacklinks(data.backlinks || []);
            } else {
                throw new Error(data.error || '역링크를 불러올 수 없습니다.');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString + 'Z');
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
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
                <h1 className="wiki-page-title">
                    🔗 역링크: {title}
                </h1>
                <div className="wiki-page-actions">
                    <Link to={`/w/${encodeURIComponent(title)}`} className="btn btn-secondary">
                        ← 문서로 돌아가기
                    </Link>
                </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div style={{
                background: 'var(--color-bg-secondary)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.5rem'
            }}>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                    📊 <strong>{backlinks.length}</strong>개의 문서가 "<strong>{title}</strong>" 문서를 참조하고 있습니다.
                </p>
            </div>

            {backlinks.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '3rem',
                    color: 'var(--color-text-muted)'
                }}>
                    <p style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>📭</p>
                    <p>이 문서를 참조하는 다른 문서가 없습니다.</p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gap: '0.5rem'
                }}>
                    {backlinks.map((link, index) => (
                        <div
                            key={link.title}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.75rem 1rem',
                                background: index % 2 === 0 ? 'var(--color-bg-primary)' : 'var(--color-bg-secondary)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-border)'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{
                                    width: '2rem',
                                    height: '2rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'var(--color-accent)',
                                    color: 'white',
                                    borderRadius: '50%',
                                    fontSize: '0.75rem',
                                    fontWeight: 600
                                }}>
                                    {index + 1}
                                </span>
                                <Link
                                    to={`/w/${encodeURIComponent(link.title)}`}
                                    style={{
                                        color: 'var(--color-link)',
                                        fontWeight: 500,
                                        textDecoration: 'none'
                                    }}
                                    onMouseOver={e => e.target.style.textDecoration = 'underline'}
                                    onMouseOut={e => e.target.style.textDecoration = 'none'}
                                >
                                    {link.title}
                                </Link>
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1.5rem',
                                fontSize: '0.8rem',
                                color: 'var(--color-text-muted)'
                            }}>
                                <span title="조회수">👁️ {link.view_count || 0}</span>
                                <span title="최근 수정">{formatDate(link.updated_at)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 범례 */}
            <div style={{
                marginTop: '2rem',
                padding: '1rem',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)'
            }}>
                <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>💡 역링크란?</h4>
                <p style={{ margin: 0 }}>
                    역링크는 현재 문서를 참조(링크)하고 있는 다른 문서들의 목록입니다.
                    문서가 위키 내에서 얼마나 중요하게 다뤄지고 있는지 파악하는 데 도움이 됩니다.
                </p>
            </div>
        </div>
    );
}

export default BacklinksPage;
