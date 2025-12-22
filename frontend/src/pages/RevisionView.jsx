import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

function RevisionView() {
    const { title: paramTitle, revision: paramRevision } = useParams();
    const title = paramTitle ? decodeURIComponent(paramTitle) : '';
    const revision = parseInt(paramRevision);

    const [revisionData, setRevisionData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchRevision();
    }, [title, revision]);

    const fetchRevision = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/history/${encodeURIComponent(title)}/${revision}`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '리비전을 불러올 수 없습니다.');
            }

            setRevisionData(data.revision);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
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

    if (error) {
        return (
            <div className="wiki-page">
                <div className="wiki-page-header">
                    <h1 className="wiki-page-title">오류</h1>
                </div>
                <div className="alert alert-error">{error}</div>
                <Link to={`/history/${encodeURIComponent(title)}`} className="btn btn-secondary">
                    ← 히스토리로 돌아가기
                </Link>
            </div>
        );
    }

    return (
        <div className="wiki-page">
            <div className="wiki-page-header">
                <h1 className="wiki-page-title">
                    {title} - 리비전 {revision}
                </h1>
                <div className="wiki-page-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Link
                        to={`/w/${encodeURIComponent(title)}`}
                        className="btn btn-secondary"
                    >
                        📄 현재 버전 보기
                    </Link>
                    <Link
                        to={`/history/${encodeURIComponent(title)}`}
                        className="btn btn-secondary"
                    >
                        📜 역사
                    </Link>
                </div>
            </div>

            {/* 리비전 정보 */}
            <div style={{
                background: 'var(--color-bg-secondary)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.5rem',
                border: '1px solid var(--color-border)'
            }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', fontSize: '0.9rem' }}>
                    <strong>리비전:</strong>
                    <span>r{revisionData?.revision}</span>

                    <strong>편집 일시:</strong>
                    <span>{formatDate(revisionData?.edited_at)}</span>

                    <strong>편집 요약:</strong>
                    <span>{revisionData?.edit_summary || '(없음)'}</span>

                    <strong>크기 변화:</strong>
                    <span style={{
                        color: revisionData?.bytes_changed > 0 ? 'var(--color-success)' :
                            revisionData?.bytes_changed < 0 ? 'var(--color-danger)' : 'inherit'
                    }}>
                        {revisionData?.bytes_changed > 0 ? '+' : ''}{revisionData?.bytes_changed} 바이트
                    </span>
                </div>
            </div>

            {/* 문서 내용 (원본) */}
            <h3 style={{ marginBottom: '0.5rem' }}>📝 문서 원본 내용</h3>
            <pre style={{
                background: 'var(--color-bg-tertiary)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: '0.875rem',
                lineHeight: '1.6',
                border: '1px solid var(--color-border)',
                maxHeight: '600px'
            }}>
                {revisionData?.content || '(내용 없음)'}
            </pre>

            {/* 하단 네비게이션 */}
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {revision > 1 && (
                    <Link
                        to={`/revision/${encodeURIComponent(title)}/${revision - 1}`}
                        className="btn btn-secondary"
                    >
                        ← r{revision - 1}
                    </Link>
                )}
                <Link
                    to={`/revision/${encodeURIComponent(title)}/${revision + 1}`}
                    className="btn btn-secondary"
                >
                    r{revision + 1} →
                </Link>
                <Link
                    to={`/diff/${encodeURIComponent(title)}/${revision}/${revision + 1}`}
                    className="btn btn-outline"
                >
                    📊 다음 리비전과 비교
                </Link>
            </div>
        </div>
    );
}

export default RevisionView;
