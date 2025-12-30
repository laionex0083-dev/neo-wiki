import { useState, useEffect } from 'react';
import { formatDate } from '../utils/dateUtils';

function CommentSection({ pageTitle, currentUser }) {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [error, setError] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null); // 삭제 확인 모달용
    const [showLoginModal, setShowLoginModal] = useState(false); // 로그인 모달
    const [loginForm, setLoginForm] = useState({ username: '', password: '' });
    const [loginError, setLoginError] = useState(null);
    const [loginLoading, setLoginLoading] = useState(false);

    useEffect(() => {
        fetchComments();
    }, [pageTitle]);

    const fetchComments = async () => {
        try {
            const res = await fetch(`/api/comments/${encodeURIComponent(pageTitle)}`);
            if (res.ok) {
                const data = await res.json();
                setComments(data.comments || []);
            }
        } catch (err) {
            console.error('Error fetching comments:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        setSubmitting(true);
        setError(null);

        try {
            const token = localStorage.getItem('wiki_token');
            const res = await fetch(`/api/comments/${encodeURIComponent(pageTitle)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ content: newComment })
            });

            if (res.ok) {
                // 등록 성공 시 페이지 새로고침
                window.location.reload();
            } else {
                const data = await res.json();
                setError(data.error || '코멘트 등록에 실패했습니다.');
                setSubmitting(false);
            }
        } catch (err) {
            setError('코멘트 등록 중 오류가 발생했습니다.');
            setSubmitting(false);
        }
    };

    const handleEdit = async (commentId) => {
        if (!editContent.trim()) return;

        setSubmitting(true);
        setError(null);

        try {
            const token = localStorage.getItem('wiki_token');
            const res = await fetch(`/api/comments/id/${commentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ content: editContent })
            });

            if (res.ok) {
                // 수정 성공 시 페이지 새로고침
                window.location.reload();
            } else {
                const data = await res.json();
                setError(data.error || '코멘트 수정에 실패했습니다.');
                setSubmitting(false);
            }
        } catch (err) {
            setError('코멘트 수정 중 오류가 발생했습니다.');
            setSubmitting(false);
        }
    };

    // 삭제 확인 모달 표시
    const showDeleteConfirm = (commentId) => {
        setDeleteConfirmId(commentId);
    };

    // 삭제 취소
    const cancelDelete = () => {
        setDeleteConfirmId(null);
    };

    // 실제 삭제 수행
    const confirmDelete = async () => {
        if (!deleteConfirmId) return;

        try {
            const token = localStorage.getItem('wiki_token');
            const res = await fetch(`/api/comments/id/${deleteConfirmId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                // 삭제 성공 시 페이지 새로고침
                window.location.reload();
            } else {
                const data = await res.json();
                setError(data.error || '코멘트 삭제에 실패했습니다.');
                setDeleteConfirmId(null);
            }
        } catch (err) {
            console.error('Delete error:', err);
            setError('코멘트 삭제 중 오류가 발생했습니다.');
            setDeleteConfirmId(null);
        }
    };

    const startEdit = (comment) => {
        setEditingId(comment.id);
        setEditContent(comment.content);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditContent('');
    };

    // 로그인 모달 열기
    const openLoginModal = () => {
        setShowLoginModal(true);
        setLoginError(null);
        setLoginForm({ username: '', password: '' });
    };

    // 로그인 모달 닫기
    const closeLoginModal = () => {
        setShowLoginModal(false);
        setLoginError(null);
        setLoginForm({ username: '', password: '' });
    };

    // 로그인 처리
    const handleLogin = async (e) => {
        e.preventDefault();
        if (!loginForm.username.trim() || !loginForm.password.trim()) return;

        setLoginLoading(true);
        setLoginError(null);

        try {
            const res = await fetch('/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginForm)
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('wiki_token', data.token);
                // 로그인 성공 시 페이지 새로고침
                window.location.reload();
            } else {
                setLoginError(data.error || '로그인에 실패했습니다.');
            }
        } catch (err) {
            setLoginError('로그인 중 오류가 발생했습니다.');
        } finally {
            setLoginLoading(false);
        }
    };

    const canModify = (comment) => {
        if (!currentUser) return false;
        if (comment.user_id === currentUser.id) return true;
        return ['admin', 'owner', 'moderator'].includes(currentUser.role);
    };

    return (
        <section className="wiki-comments" style={{ marginTop: '2rem' }}>
            <h3 style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem',
                paddingBottom: '0.5rem',
                borderBottom: '2px solid var(--color-accent)'
            }}>
                💬 코멘트
                <span style={{
                    fontSize: '0.85rem',
                    color: 'var(--color-text-muted)',
                    fontWeight: 'normal'
                }}>
                    ({comments.length})
                </span>
            </h3>

            {error && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                    {error}
                </div>
            )}

            {/* 코멘트 입력 폼 */}
            {currentUser ? (
                <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'var(--color-accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            flexShrink: 0
                        }}>
                            {currentUser.username?.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                            <textarea
                                className="form-textarea"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="코멘트를 입력하세요..."
                                rows={3}
                                style={{
                                    width: '100%',
                                    resize: 'vertical',
                                    minHeight: '60px'
                                }}
                                maxLength={2000}
                            />
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: '0.5rem'
                            }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                    {newComment.length}/2000
                                </span>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={submitting || !newComment.trim()}
                                    style={{ padding: '0.4rem 1rem' }}
                                >
                                    {submitting ? '등록 중...' : '등록'}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            ) : (
                <div style={{
                    padding: '1rem',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                    color: 'var(--color-text-muted)',
                    marginBottom: '1.5rem'
                }}>
                    코멘트를 작성하려면 <button
                        onClick={openLoginModal}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-link)',
                            cursor: 'pointer',
                            padding: 0,
                            fontSize: 'inherit',
                            textDecoration: 'underline'
                        }}
                    >로그인</button>해주세요.
                </div>
            )}

            {/* 코멘트 목록 */}
            {loading ? (
                <div className="loading">
                    <div className="loading-spinner"></div>
                </div>
            ) : comments.length === 0 ? (
                <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    color: 'var(--color-text-muted)'
                }}>
                    아직 코멘트가 없습니다. 첫 번째 코멘트를 작성해보세요!
                </div>
            ) : (
                <div className="wiki-comments-list">
                    {comments.map(comment => (
                        <div
                            key={comment.id}
                            style={{
                                padding: '1rem',
                                borderBottom: '1px solid var(--color-border)',
                                display: 'flex',
                                gap: '0.75rem'
                            }}
                        >
                            {/* 사용자 아바타 */}
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: 'var(--color-bg-tertiary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--color-text-secondary)',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                flexShrink: 0
                            }}>
                                {comment.username?.charAt(0).toUpperCase()}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                                {/* 사용자명 - 내용 - 시간 */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    marginBottom: '0.25rem',
                                    flexWrap: 'wrap'
                                }}>
                                    <strong style={{ color: 'var(--color-link)' }}>
                                        {comment.username}
                                    </strong>
                                    <span style={{
                                        fontSize: '0.8rem',
                                        color: 'var(--color-text-muted)'
                                    }}>
                                        {formatDate(comment.created_at)}
                                        {comment.is_edited ? ' (수정됨)' : ''}
                                    </span>
                                </div>

                                {/* 코멘트 내용 or 수정 폼 */}
                                {editingId === comment.id ? (
                                    <div>
                                        <textarea
                                            className="form-textarea"
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            rows={3}
                                            style={{
                                                width: '100%',
                                                resize: 'vertical',
                                                marginBottom: '0.5rem'
                                            }}
                                            maxLength={2000}
                                        />
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                className="btn btn-primary"
                                                onClick={() => handleEdit(comment.id)}
                                                disabled={submitting || !editContent.trim()}
                                                style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                                            >
                                                저장
                                            </button>
                                            <button
                                                className="btn btn-secondary"
                                                onClick={cancelEdit}
                                                disabled={submitting}
                                                style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                                            >
                                                취소
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <p style={{
                                            margin: 0,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            lineHeight: 1.5
                                        }}>
                                            {comment.content}
                                        </p>

                                        {/* 수정/삭제 버튼 */}
                                        {canModify(comment) && (
                                            <div style={{
                                                marginTop: '0.5rem',
                                                display: 'flex',
                                                gap: '0.5rem'
                                            }}>
                                                <button
                                                    onClick={() => startEdit(comment)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        padding: '0.2rem 0.5rem',
                                                        color: 'var(--color-text-muted)',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8rem'
                                                    }}
                                                >
                                                    수정
                                                </button>
                                                <button
                                                    onClick={() => showDeleteConfirm(comment.id)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        padding: '0.2rem 0.5rem',
                                                        color: 'var(--color-danger)',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8rem'
                                                    }}
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 삭제 확인 모달 */}
            {deleteConfirmId && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div style={{
                        background: 'var(--color-bg-primary)',
                        padding: '1.5rem',
                        borderRadius: 'var(--radius-lg)',
                        maxWidth: '400px',
                        width: '90%',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>🗑️ 코멘트 삭제</h3>
                        <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-secondary)' }}>
                            정말 이 코멘트를 삭제하시겠습니까?<br />
                            삭제된 코멘트는 복구할 수 없습니다.
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={cancelDelete}
                            >
                                취소
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={confirmDelete}
                                style={{
                                    background: 'var(--color-danger)',
                                    color: 'white'
                                }}
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 로그인 모달 */}
            {showLoginModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div style={{
                        background: 'var(--color-bg-primary)',
                        padding: '1.5rem',
                        borderRadius: 'var(--radius-lg)',
                        maxWidth: '400px',
                        width: '90%',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>🔐 로그인</h3>

                        {loginError && (
                            <div style={{
                                padding: '0.75rem',
                                background: 'rgba(220, 53, 69, 0.1)',
                                border: '1px solid var(--color-danger)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--color-danger)',
                                marginBottom: '1rem',
                                fontSize: '0.9rem'
                            }}>
                                {loginError}
                            </div>
                        )}

                        <form onSubmit={handleLogin}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                                    아이디
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={loginForm.username}
                                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                                    placeholder="아이디를 입력하세요"
                                    autoFocus
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                                    비밀번호
                                </label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={loginForm.password}
                                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                                    placeholder="비밀번호를 입력하세요"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={closeLoginModal}
                                    disabled={loginLoading}
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loginLoading || !loginForm.username.trim() || !loginForm.password.trim()}
                                >
                                    {loginLoading ? '로그인 중...' : '로그인'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}

export default CommentSection;
