import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { formatDate } from '../utils/dateUtils';

function CategoryPage() {
    const { name: paramName } = useParams();
    const categoryName = paramName ? decodeURIComponent(paramName) : '';

    const [pages, setPages] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [parentCategory, setParentCategory] = useState(null);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortBy, setSortBy] = useState('title');

    useEffect(() => {
        if (categoryName) {
            fetchCategoryPages();
        }
    }, [categoryName, sortBy]);

    const fetchCategoryPages = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/categories/${encodeURIComponent(categoryName)}?sort=${sortBy}`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '분류를 불러올 수 없습니다.');
            }

            setPages(data.pages || []);
            setSubcategories(data.subcategories || []);
            setParentCategory(data.parentCategory);
            setTotal(data.total || 0);
        } catch (err) {
            setError(err.message);
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
                <h1 className="wiki-page-title">
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>분류:</span>
                    {categoryName}
                </h1>
                <div className="wiki-page-actions">
                    <Link
                        to="/categories"
                        className="btn btn-secondary"
                    >
                        📂 분류 목록
                    </Link>
                </div>
            </div>

            {/* 상위 분류 */}
            {parentCategory && (
                <div style={{
                    padding: '0.75rem 1rem',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1rem'
                }}>
                    <span style={{ color: 'var(--color-text-muted)', marginRight: '0.5rem' }}>상위 분류:</span>
                    <Link
                        to={`/category/${encodeURIComponent(parentCategory)}`}
                        style={{ color: 'var(--color-link)' }}
                    >
                        {parentCategory}
                    </Link>
                </div>
            )}

            {/* 하위 분류 */}
            {subcategories.length > 0 && (
                <div style={{
                    padding: '1rem',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1.5rem'
                }}>
                    <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem' }}>
                        📁 하위 분류 ({subcategories.length})
                    </h3>
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem'
                    }}>
                        {subcategories.map(subcat => (
                            <Link
                                key={subcat}
                                to={`/category/${encodeURIComponent(subcat)}`}
                                style={{
                                    padding: '0.25rem 0.75rem',
                                    background: 'var(--color-bg-primary)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--color-link)',
                                    textDecoration: 'none',
                                    fontSize: '0.9rem'
                                }}
                            >
                                {subcat.substring(categoryName.length + 1)}
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* 정렬 옵션 */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
            }}>
                <span style={{ color: 'var(--color-text-muted)' }}>
                    총 <strong>{total}</strong>개의 문서
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        className={`btn ${sortBy === 'title' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setSortBy('title')}
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                    >
                        이름순
                    </button>
                    <button
                        className={`btn ${sortBy === 'updated' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setSortBy('updated')}
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                    >
                        최근 수정순
                    </button>
                    <button
                        className={`btn ${sortBy === 'created' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setSortBy('created')}
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                    >
                        생성순
                    </button>
                </div>
            </div>

            {/* 문서 목록 */}
            {pages.length > 0 ? (
                <div className="category-pages-list">
                    {pages.map(page => (
                        <div
                            key={page.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.75rem 1rem',
                                borderBottom: '1px solid var(--color-border-light)',
                                gap: '1rem'
                            }}
                        >
                            <Link
                                to={`/w/${encodeURIComponent(page.title)}`}
                                style={{
                                    color: 'var(--color-link)',
                                    textDecoration: 'none',
                                    fontWeight: 500,
                                    flex: 1
                                }}
                            >
                                {page.title}
                            </Link>
                            <span style={{
                                fontSize: '0.8rem',
                                color: 'var(--color-text-muted)',
                                whiteSpace: 'nowrap'
                            }}>
                                {formatDate(page.updated_at)}
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{
                    padding: '3rem',
                    textAlign: 'center',
                    color: 'var(--color-text-muted)'
                }}>
                    이 분류에 속한 문서가 없습니다.
                </div>
            )}

            {/* 분류 추가 안내 */}
            <div style={{
                marginTop: '2rem',
                padding: '1rem',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.9rem',
                color: 'var(--color-text-secondary)'
            }}>
                <strong>💡 TIP:</strong> 문서에 <code>[[분류:{categoryName}]]</code>를 추가하면 이 분류에 문서가 등록됩니다.
            </div>
        </div>
    );
}

export default CategoryPage;
