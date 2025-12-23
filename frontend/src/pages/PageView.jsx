import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import CommentSection from '../components/CommentSection';

function PageView({ defaultTitle, user }) {
    const { title: paramTitle } = useParams();
    const title = paramTitle ? decodeURIComponent(paramTitle) : (defaultTitle || '대문');
    const navigate = useNavigate();

    const [page, setPage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (title === 'random') {
            fetchRandomPage();
            return;
        }
        fetchPage();
    }, [title]);

    const fetchPage = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/pages/${encodeURIComponent(title)}`);
            const data = await res.json();

            if (!res.ok) {
                if (res.status === 404) {
                    setPage({ exists: false, title });
                } else {
                    throw new Error(data.error || '문서를 불러올 수 없습니다.');
                }
            } else if (data.redirect) {
                // 리다이렉트 처리
                navigate(`/w/${encodeURIComponent(data.redirect_to)}`, { replace: true });
                return;
            } else {
                setPage(data);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchRandomPage = async () => {
        try {
            const res = await fetch('/api/pages/special/random');
            const data = await res.json();
            if (res.ok && data.title) {
                navigate(`/w/${encodeURIComponent(data.title)}`, { replace: true });
            }
        } catch {
            setError('랜덤 문서를 불러올 수 없습니다.');
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

    if (error) {
        return (
            <div className="wiki-page">
                <div className="alert alert-error">{error}</div>
            </div>
        );
    }

    if (!page?.exists) {
        return (
            <div className="wiki-page">
                <div className="wiki-page-header">
                    <h1 className="wiki-page-title">{title}</h1>
                </div>
                <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
                    이 문서는 아직 작성되지 않았습니다.
                </div>
                <Link to={`/edit/${encodeURIComponent(title)}`} className="btn btn-primary">
                    ✏️ 새 문서 작성하기
                </Link>
            </div>
        );
    }

    return (
        <div className="wiki-page">
            <div className="wiki-page-header">
                <h1 className="wiki-page-title">{page.title}</h1>
                <div className="wiki-page-actions">
                    <Link to={`/edit/${encodeURIComponent(page.title)}`} className="btn btn-primary">
                        ✏️ 편집
                    </Link>
                    <Link to={`/history/${encodeURIComponent(page.title)}`} className="btn btn-secondary">
                        📜 역사
                    </Link>
                    <Link to={`/backlinks/${encodeURIComponent(page.title)}`} className="btn btn-secondary">
                        🔗 역링크
                    </Link>
                </div>
            </div>

            {/* 목차 */}
            {page.toc && page.toc.length > 0 && (
                <TableOfContents toc={page.toc} />
            )}

            {/* 본문 */}
            <div
                className="wiki-page-content"
                dangerouslySetInnerHTML={{ __html: page.html }}
            />

            {/* 분류 */}
            {page.categories && page.categories.length > 0 && (
                <div className="wiki-categories">
                    <strong>분류: </strong>
                    {page.categories.map((cat, i) => (
                        <Link
                            key={i}
                            to={`/w/분류:${encodeURIComponent(cat)}`}
                            className="wiki-category"
                        >
                            {cat}
                        </Link>
                    ))}
                </div>
            )}

            {/* 메타 정보 */}
            <div style={{
                marginTop: '2rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--color-border)',
                fontSize: '0.875rem',
                color: 'var(--color-text-muted)'
            }}>
                <span>조회수: {page.view_count || 0}</span>
                <span style={{ marginLeft: '1rem' }}>
                    마지막 수정: {new Date(page.updated_at).toLocaleString('ko-KR')}
                </span>
            </div>

            {/* 코멘트 섹션 */}
            <CommentSection pageTitle={page.title} currentUser={user} />
        </div>
    );
}

function TableOfContents({ toc }) {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="wiki-toc">
            <h4
                onClick={() => setIsOpen(!isOpen)}
                style={{ cursor: 'pointer' }}
            >
                {isOpen ? '▼' : '▶'} 목차
            </h4>
            {isOpen && (
                <ul>
                    {toc.map((item, i) => (
                        <li key={i} style={{ paddingLeft: `${(item.level - 1) * 12}px` }}>
                            <a href={`#${item.id}`}>{item.title}</a>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default PageView;
