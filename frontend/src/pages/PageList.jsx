import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

function PageList() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [pages, setPages] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    const search = searchParams.get('search') || '';
    const namespace = searchParams.get('namespace') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 50;

    useEffect(() => {
        fetchPages();
    }, [search, namespace, page]);

    const fetchPages = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                search,
                namespace,
                limit: limit.toString(),
                offset: ((page - 1) * limit).toString()
            });

            const res = await fetch(`/api/pages?${params}`);
            const data = await res.json();

            setPages(data.pages);
            setTotal(data.total);
        } catch (err) {
            console.error('Error fetching pages:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        setSearchParams({
            search: formData.get('search'),
            namespace,
            page: '1'
        });
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="wiki-page">
            <div className="wiki-page-header">
                <h1 className="wiki-page-title">모든 문서</h1>
            </div>

            {/* 검색 */}
            <form onSubmit={handleSearch} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="text"
                        name="search"
                        className="form-input"
                        placeholder="문서 검색..."
                        defaultValue={search}
                        style={{ flex: 1 }}
                    />
                    <select
                        className="form-select"
                        value={namespace}
                        onChange={(e) => setSearchParams({ search, namespace: e.target.value, page: '1' })}
                        style={{ width: 'auto' }}
                    >
                        <option value="all">모든 이름공간</option>
                        <option value="main">일반 문서</option>
                        <option value="분류">분류</option>
                        <option value="틀">틀</option>
                    </select>
                    <button type="submit" className="btn btn-primary">검색</button>
                </div>
            </form>

            <p style={{ marginBottom: '1rem', color: 'var(--color-text-muted)' }}>
                총 {total}개의 문서
            </p>

            {loading ? (
                <div className="loading">
                    <div className="loading-spinner"></div>
                </div>
            ) : (
                <>
                    <div style={{ display: 'grid', gap: '0.25rem' }}>
                        {pages.map((p) => (
                            <div
                                key={p.id}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.75rem 1rem',
                                    background: 'var(--color-bg-secondary)',
                                    borderRadius: 'var(--radius-md)'
                                }}
                            >
                                <Link to={`/w/${encodeURIComponent(p.title)}`}>
                                    {p.title}
                                </Link>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                    조회 {p.view_count}
                                </span>
                            </div>
                        ))}
                    </div>

                    {pages.length === 0 && (
                        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
                            문서가 없습니다.
                        </p>
                    )}

                    {/* 페이지네이션 */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
                            {page > 1 && (
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setSearchParams({ search, namespace, page: (page - 1).toString() })}
                                >
                                    이전
                                </button>
                            )}
                            <span style={{ padding: '0.5rem 1rem' }}>
                                {page} / {totalPages}
                            </span>
                            {page < totalPages && (
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setSearchParams({ search, namespace, page: (page + 1).toString() })}
                                >
                                    다음
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default PageList;
