import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function RecentChanges() {
    const [changes, setChanges] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRecentChanges();
    }, []);

    const fetchRecentChanges = async () => {
        try {
            const res = await fetch('/api/pages/special/recent?limit=100');
            const data = await res.json();
            setChanges(data.changes || []);
        } catch (err) {
            console.error('Error fetching recent changes:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;

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
        // 그 외
        return date.toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return '±0';
        const sign = bytes > 0 ? '+' : '';
        return sign + bytes.toLocaleString();
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
                <h1 className="wiki-page-title">최근 변경</h1>
            </div>

            <div>
                {changes.map((change, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            padding: '0.75rem 0',
                            borderBottom: '1px solid var(--color-border-light)'
                        }}
                    >
                        <span style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-text-muted)',
                            minWidth: '80px'
                        }}>
                            {formatDate(change.edited_at)}
                        </span>

                        <Link
                            to={`/w/${encodeURIComponent(change.title)}`}
                            style={{ flex: 1 }}
                        >
                            {change.title}
                        </Link>

                        <span
                            className={`wiki-history-bytes ${change.bytes_changed > 0 ? 'positive' : change.bytes_changed < 0 ? 'negative' : ''}`}
                            style={{ minWidth: '60px', textAlign: 'right' }}
                        >
                            {formatBytes(change.bytes_changed)}
                        </span>

                        <span style={{
                            fontSize: '0.875rem',
                            color: 'var(--color-text-secondary)',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>
                            {change.edit_summary || '(편집 요약 없음)'}
                        </span>

                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <Link
                                to={`/history/${encodeURIComponent(change.title)}`}
                                className="btn btn-outline"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            >
                                역사
                            </Link>
                        </div>
                    </div>
                ))}
            </div>

            {changes.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
                    최근 변경 내역이 없습니다.
                </p>
            )}
        </div>
    );
}

export default RecentChanges;
