import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { formatDate, formatBytes } from '../utils/dateUtils';

function PageHistory() {
    const { title: paramTitle } = useParams();
    const title = paramTitle ? decodeURIComponent(paramTitle) : '';
    const navigate = useNavigate();

    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedRevisions, setSelectedRevisions] = useState([]);
    const [reverting, setReverting] = useState(false);
    const [currentRevision, setCurrentRevision] = useState(null);

    // 되돌리기 모달 상태
    const [showRevertModal, setShowRevertModal] = useState(false);
    const [revertTargetRevision, setRevertTargetRevision] = useState(null);
    const [revertReason, setRevertReason] = useState('');

    useEffect(() => {
        fetchHistory();
    }, [title]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/history/${encodeURIComponent(title)}`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '히스토리를 불러올 수 없습니다.');
            }

            setHistory(data.history || []);
            if (data.history && data.history.length > 0) {
                setCurrentRevision(data.history[0].revision);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRevisionSelect = (revision) => {
        setSelectedRevisions(prev => {
            if (prev.includes(revision)) {
                return prev.filter(r => r !== revision);
            }
            if (prev.length >= 2) {
                return [prev[1], revision];
            }
            return [...prev, revision];
        });
    };

    const openRevertModal = (revision) => {
        setRevertTargetRevision(revision);
        setRevertReason('');
        setShowRevertModal(true);
    };

    const closeRevertModal = () => {
        setShowRevertModal(false);
        setRevertTargetRevision(null);
        setRevertReason('');
    };

    const handleRevertConfirm = async () => {
        if (!revertTargetRevision) return;

        setReverting(true);

        try {
            const token = localStorage.getItem('wiki_token');
            const res = await fetch(`/api/history/${encodeURIComponent(title)}/revert/${revertTargetRevision}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ reason: revertReason || '되돌리기' })
            });

            const data = await res.json();

            if (res.ok) {
                alert(`r${revertTargetRevision}으로 되돌렸습니다.`);
                closeRevertModal();
                fetchHistory();
            } else {
                alert(data.error || '되돌리기에 실패했습니다.');
            }
        } catch (err) {
            console.error('Revert error:', err);
            alert('되돌리기 중 오류가 발생했습니다.');
        } finally {
            setReverting(false);
        }
    };



    if (loading) {
        return (
            <div className="wiki-history">
                <div className="loading">
                    <div className="loading-spinner"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="wiki-history">
                <div className="alert alert-error">{error}</div>
            </div>
        );
    }

    return (
        <div className="wiki-history">
            {/* 되돌리기 확인 모달 */}
            {showRevertModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: '#ffffff',
                        padding: '2rem',
                        borderRadius: 'var(--radius-lg)',
                        maxWidth: '450px',
                        width: '90%',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                        color: '#1a1a1a'
                    }}>
                        <h3 style={{ marginTop: 0, color: 'var(--color-warning)' }}>↩️ 리비전 되돌리기</h3>
                        <p style={{ marginBottom: '0.5rem' }}>
                            <strong>r{revertTargetRevision}</strong>으로 되돌리시겠습니까?
                        </p>
                        <p style={{
                            color: 'var(--color-text-muted)',
                            fontSize: '0.875rem',
                            marginBottom: '1rem'
                        }}>
                            현재 버전(r{currentRevision})의 내용이 r{revertTargetRevision}의 내용으로 교체됩니다.
                        </p>

                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="form-label" style={{ fontSize: '0.875rem' }}>되돌리기 사유 (선택)</label>
                            <input
                                type="text"
                                className="form-input"
                                value={revertReason}
                                onChange={(e) => setRevertReason(e.target.value)}
                                placeholder="되돌리기"
                                style={{ fontSize: '0.9rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={closeRevertModal}
                                disabled={reverting}
                            >
                                취소
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleRevertConfirm}
                                disabled={reverting}
                            >
                                {reverting ? '처리 중...' : '되돌리기 확인'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="wiki-page-header">
                <h1 className="wiki-page-title">역사: {title}</h1>
                <div className="wiki-page-actions">
                    <Link to={`/w/${encodeURIComponent(title)}`} className="btn btn-secondary">
                        ← 문서로 돌아가기
                    </Link>
                </div>
            </div>

            {/* 비교 버튼 영역 */}
            <div style={{
                marginBottom: '1rem',
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                {selectedRevisions.length === 2 && (
                    <Link
                        to={`/diff/${encodeURIComponent(title)}/${Math.min(...selectedRevisions)}/${Math.max(...selectedRevisions)}`}
                        className="btn btn-primary"
                    >
                        📊 선택한 리비전 비교 (r{Math.min(...selectedRevisions)} ↔ r{Math.max(...selectedRevisions)})
                    </Link>
                )}
                {selectedRevisions.length === 1 && currentRevision && selectedRevisions[0] !== currentRevision && (
                    <Link
                        to={`/diff/${encodeURIComponent(title)}/${selectedRevisions[0]}/${currentRevision}`}
                        className="btn btn-secondary"
                    >
                        📊 현재 버전과 비교 (r{selectedRevisions[0]} ↔ r{currentRevision})
                    </Link>
                )}
            </div>

            <p style={{ marginBottom: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                총 {history.length}개의 리비전이 있습니다. 비교할 리비전을 선택하세요.
                {currentRevision && <span style={{ marginLeft: '0.5rem' }}>현재 버전: r{currentRevision}</span>}
            </p>

            <div>
                {history.map((rev, index) => (
                    <div
                        key={rev.id}
                        className="wiki-history-item"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem',
                            borderBottom: '1px solid var(--color-border)',
                            background: index === 0 ? 'rgba(var(--accent-rgb), 0.05)' : 'transparent'
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={selectedRevisions.includes(rev.revision)}
                            onChange={() => handleRevisionSelect(rev.revision)}
                            style={{ cursor: 'pointer' }}
                        />
                        <span
                            className="wiki-history-revision"
                            style={{
                                fontWeight: 600,
                                color: 'var(--color-accent)',
                                minWidth: '3rem'
                            }}
                        >
                            r{rev.revision}
                            {index === 0 && (
                                <span style={{
                                    marginLeft: '0.25rem',
                                    padding: '0.1rem 0.4rem',
                                    background: 'var(--color-accent)',
                                    color: 'white',
                                    borderRadius: '3px',
                                    fontSize: '0.65rem'
                                }}>
                                    현재
                                </span>
                            )}
                        </span>
                        <span className="wiki-history-date" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', minWidth: '11rem' }}>
                            {formatDate(rev.edited_at)}
                        </span>
                        <span
                            className="wiki-history-summary"
                            style={{ flex: 1, fontSize: '0.875rem' }}
                        >
                            {rev.edit_summary || '(편집 요약 없음)'}
                        </span>
                        <span
                            style={{
                                fontSize: '0.875rem',
                                color: 'var(--color-accent)',
                                minWidth: '80px',
                                fontWeight: 500
                            }}
                        >
                            {rev.editor_name || '(익명)'}
                        </span>
                        <span
                            className={`wiki-history-bytes`}
                            style={{
                                fontWeight: 500,
                                color: rev.bytes_changed > 0 ? 'var(--color-success)' : rev.bytes_changed < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)',
                                minWidth: '4rem',
                                textAlign: 'right'
                            }}
                        >
                            {formatBytes(rev.bytes_changed)}
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {/* 보기 버튼 */}
                            <Link
                                to={`/revision/${encodeURIComponent(title)}/${rev.revision}`}
                                className="btn btn-outline"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            >
                                👁️ 보기
                            </Link>
                            {/* 현재 버전과 비교 */}
                            {index > 0 && (
                                <Link
                                    to={`/diff/${encodeURIComponent(title)}/${rev.revision}/${currentRevision}`}
                                    className="btn btn-outline"
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                >
                                    📊 비교
                                </Link>
                            )}
                            {/* 되돌리기 버튼 (현재 버전이 아닌 경우만) */}
                            {index > 0 && (
                                <button
                                    className="btn btn-outline"
                                    style={{
                                        padding: '0.25rem 0.5rem',
                                        fontSize: '0.75rem',
                                        color: 'var(--color-warning)'
                                    }}
                                    onClick={() => openRevertModal(rev.revision)}
                                >
                                    ↩️ 되돌리기
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {history.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
                    히스토리가 없습니다.
                </p>
            )}
        </div>
    );
}

export default PageHistory;
