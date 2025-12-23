import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

function PageEdit() {
    const { title: paramTitle } = useParams();
    const title = paramTitle ? decodeURIComponent(paramTitle) : '';
    const navigate = useNavigate();
    const textareaRef = useRef(null);

    const [pageTitle, setPageTitle] = useState(title);
    const [content, setContent] = useState('');
    const [editSummary, setEditSummary] = useState('');
    const [loading, setLoading] = useState(!!title);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(null);
    const [isNew, setIsNew] = useState(!title);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // 문서 보호 관련 상태
    const [currentUser, setCurrentUser] = useState(null);
    const [showProtectionModal, setShowProtectionModal] = useState(false);
    const [showUnprotectModal, setShowUnprotectModal] = useState(false); // 보호 해제 확인 모달
    const [protectionLevel, setProtectionLevel] = useState('all');
    const [protectionReason, setProtectionReason] = useState('');
    const [currentProtection, setCurrentProtection] = useState(null);
    const [protectionLoading, setProtectionLoading] = useState(false);

    // 미리보기 관련 상태
    const [showPreview, setShowPreview] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
    const [previewLoading, setPreviewLoading] = useState(false);

    useEffect(() => {
        if (title) {
            fetchPage();
            fetchProtectionStatus();
        }
        fetchCurrentUser();
    }, [title]);

    const fetchCurrentUser = async () => {
        const token = localStorage.getItem('wiki_token');
        if (!token) return;

        try {
            const res = await fetch('/api/users/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCurrentUser(data.user);
            }
        } catch (err) {
            console.error('Error fetching user:', err);
        }
    };

    const fetchProtectionStatus = async () => {
        try {
            const res = await fetch(`/api/pages/${encodeURIComponent(title)}/protection`);
            if (res.ok) {
                const data = await res.json();
                setCurrentProtection(data.protection);
                if (data.protection) {
                    setProtectionLevel(data.protection.edit_require || 'all');
                }
            }
        } catch (err) {
            console.error('Error fetching protection status:', err);
        }
    };

    const fetchPage = async () => {
        try {
            const res = await fetch(`/api/pages/${encodeURIComponent(title)}/raw`);
            if (res.ok) {
                const data = await res.json();
                setContent(data.content || '');
                setIsNew(false);
            } else if (res.status === 404) {
                setContent('');
                setIsNew(true);
            }
        } catch (err) {
            console.error('Error fetching page:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!pageTitle.trim()) {
            setError('문서 제목을 입력해주세요.');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const token = localStorage.getItem('wiki_token');
            const res = await fetch(`/api/pages/${encodeURIComponent(pageTitle.trim())}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` })
                },
                body: JSON.stringify({
                    content,
                    edit_summary: editSummary || (isNew ? '새 문서 작성' : '편집')
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '저장 중 오류가 발생했습니다.');
            }

            navigate(`/w/${encodeURIComponent(pageTitle.trim())}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const handleDeleteConfirm = async () => {
        setDeleting(true);
        setError(null);

        try {
            const token = localStorage.getItem('wiki_token');
            const res = await fetch(`/api/pages/${encodeURIComponent(title)}`, {
                method: 'DELETE',
                headers: {
                    ...(token && { Authorization: `Bearer ${token}` })
                }
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '삭제 중 오류가 발생했습니다.');
            }

            alert('문서가 삭제되었습니다.');
            navigate('/');
        } catch (err) {
            setError(err.message);
            setShowDeleteConfirm(false);
        } finally {
            setDeleting(false);
        }
    };

    const handleDeleteCancel = () => {
        setShowDeleteConfirm(false);
    };

    const handleProtect = async () => {
        setProtectionLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('wiki_token');
            const res = await fetch(`/api/users/admin/pages/${encodeURIComponent(title)}/protect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    editRequire: protectionLevel,
                    reason: protectionReason || '문서 보호'
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '문서 보호 설정에 실패했습니다.');
            }

            setShowProtectionModal(false);
            fetchProtectionStatus();
        } catch (err) {
            setError(err.message);
        } finally {
            setProtectionLoading(false);
        }
    };

    // 보호 해제 확인 모달 표시
    const showUnprotectConfirm = () => {
        setShowUnprotectModal(true);
    };

    // 보호 해제 취소
    const cancelUnprotect = () => {
        setShowUnprotectModal(false);
    };

    // 실제 보호 해제 수행
    const confirmUnprotect = async () => {
        setProtectionLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('wiki_token');
            const res = await fetch(`/api/users/admin/pages/${encodeURIComponent(title)}/unprotect`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '문서 보호 해제에 실패했습니다.');
            }

            setShowUnprotectModal(false);
            setCurrentProtection(null);
            setProtectionLevel('all');
        } catch (err) {
            setError(err.message);
            setShowUnprotectModal(false);
        } finally {
            setProtectionLoading(false);
        }
    };

    // 미리보기 핸들러
    const handlePreview = async () => {
        if (!content.trim()) {
            setError('미리볼 내용이 없습니다.');
            return;
        }

        setPreviewLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/pages/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content })
            });

            if (res.ok) {
                const data = await res.json();
                setPreviewHtml(data.html);
                setShowPreview(true);
            } else {
                throw new Error('미리보기를 불러오는 데 실패했습니다.');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setPreviewLoading(false);
        }
    };

    const insertMarkup = (before, after = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = content.substring(start, end);
        const newText = content.substring(0, start) + before + selectedText + after + content.substring(end);

        setContent(newText);

        setTimeout(() => {
            textarea.focus();
            if (selectedText) {
                textarea.setSelectionRange(start + before.length, end + before.length);
            } else {
                textarea.setSelectionRange(start + before.length, start + before.length);
            }
        }, 0);
    };

    const toolbarButtons = [
        { label: 'B', title: '굵게', action: () => insertMarkup("'''", "'''") },
        { label: 'I', title: '기울임', action: () => insertMarkup("''", "''") },
        { label: 'S', title: '취소선', action: () => insertMarkup('~~', '~~') },
        { label: 'U', title: '밑줄', action: () => insertMarkup('__', '__') },
        { label: '[]', title: '링크', action: () => insertMarkup('[[', ']]') },
        { label: '{}', title: '코드', action: () => insertMarkup('{{{', '}}}') },
        { label: 'H1', title: '제목 1', action: () => insertMarkup('= ', ' =') },
        { label: 'H2', title: '제목 2', action: () => insertMarkup('== ', ' ==') },
        { label: 'H3', title: '제목 3', action: () => insertMarkup('=== ', ' ===') },
        { label: '•', title: '목록', action: () => insertMarkup(' * ') },
        { label: '1.', title: '번호목록', action: () => insertMarkup(' 1. ') },
        { label: '>', title: '인용', action: () => insertMarkup('> ') },
        { label: '─', title: '수평선', action: () => insertMarkup('\n----\n') },
        { label: '[*]', title: '각주', action: () => insertMarkup('[* ', ']') },
        { label: '🖼️', title: '이미지', action: () => insertMarkup('[[파일:', ']]') },
        { label: '🎥', title: '유튜브', action: () => insertMarkup('[youtube(', ')]') },
    ];

    const canProtect = currentUser && ['admin', 'owner', 'moderator'].includes(currentUser.role);

    const getProtectionLevelName = (level) => {
        const names = {
            all: '모든 사용자',
            user: '로그인 사용자',
            verified: '인증된 사용자',
            moderator: '모더레이터 이상',
            admin: '관리자 이상',
            owner: '오너만'
        };
        return names[level] || level;
    };

    if (loading) {
        return (
            <div className="wiki-editor">
                <div className="loading">
                    <div className="loading-spinner"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="wiki-editor">
            <div className="wiki-page-header">
                <h1 className="wiki-page-title">
                    {isNew ? '새 문서 작성' : `편집: ${title}`}
                </h1>
            </div>

            {/* 문서 보호 상태 표시 */}
            {currentProtection && (
                <div style={{
                    background: 'rgba(255, 193, 7, 0.15)',
                    border: '1px solid #ffc107',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <span>
                        🔒 이 문서는 보호되어 있습니다.
                        (편집 권한: <strong>{getProtectionLevelName(currentProtection.edit_require)}</strong>)
                    </span>
                    {canProtect && (
                        <button
                            className="btn btn-outline"
                            onClick={showUnprotectConfirm}
                            disabled={protectionLoading}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        >
                            보호 해제
                        </button>
                    )}
                </div>
            )}

            {error && <div className="alert alert-error">{error}</div>}

            {/* 삭제 확인 모달 */}
            {showDeleteConfirm && (
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
                        maxWidth: '400px',
                        width: '90%',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                        color: '#1a1a1a'
                    }}>
                        <h3 style={{ marginTop: 0, color: 'var(--color-danger)' }}>⚠️ 문서 삭제</h3>
                        <p style={{ marginBottom: '1rem' }}>
                            <strong>"{title}"</strong> 문서를 정말 삭제하시겠습니까?
                        </p>
                        <p style={{
                            color: 'var(--color-text-muted)',
                            fontSize: '0.875rem',
                            marginBottom: '1.5rem'
                        }}>
                            이 작업은 되돌릴 수 없습니다. 문서와 모든 편집 기록이 삭제됩니다.
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={handleDeleteCancel}
                                disabled={deleting}
                            >
                                취소
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={handleDeleteConfirm}
                                disabled={deleting}
                            >
                                {deleting ? '삭제 중...' : '삭제 확인'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 보호 해제 확인 모달 */}
            {showUnprotectModal && (
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
                        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>🔓 문서 보호 해제</h3>
                        <p style={{ marginBottom: '0.5rem', color: 'var(--color-text-secondary)' }}>
                            "<strong>{title}</strong>" 문서의 보호를 해제하시겠습니까?
                        </p>
                        <p style={{
                            marginBottom: '1rem',
                            padding: '0.5rem',
                            background: 'var(--color-bg-secondary)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.875rem'
                        }}>
                            현재 편집 권한: <strong>{getProtectionLevelName(currentProtection?.edit_require)}</strong>
                        </p>
                        <p style={{ marginBottom: '1.5rem', color: 'var(--color-warning)', fontSize: '0.875rem' }}>
                            ⚠️ 보호 해제 시 모든 사용자가 이 문서를 편집할 수 있게 됩니다.
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={cancelUnprotect}
                                disabled={protectionLoading}
                            >
                                취소
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={confirmUnprotect}
                                disabled={protectionLoading}
                                style={{
                                    background: 'var(--color-warning)',
                                    borderColor: 'var(--color-warning)'
                                }}
                            >
                                {protectionLoading ? '해제 중...' : '보호 해제'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 문서 보호 설정 모달 */}
            {showProtectionModal && (
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
                        <h3 style={{ marginTop: 0 }}>🔒 문서 보호 설정</h3>
                        <p style={{ marginBottom: '1rem', color: '#666' }}>
                            "{title}" 문서의 편집 권한을 제한합니다.
                        </p>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                편집 권한
                            </label>
                            <select
                                value={protectionLevel}
                                onChange={(e) => setProtectionLevel(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc'
                                }}
                            >
                                <option value="all">모든 사용자 (보호 없음)</option>
                                <option value="user">로그인 사용자만</option>
                                <option value="verified">인증된 사용자 이상</option>
                                <option value="moderator">모더레이터 이상</option>
                                <option value="admin">관리자 이상</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                보호 사유
                            </label>
                            <input
                                type="text"
                                value={protectionReason}
                                onChange={(e) => setProtectionReason(e.target.value)}
                                placeholder="보호 사유를 입력하세요"
                                style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowProtectionModal(false)}
                                disabled={protectionLoading}
                            >
                                취소
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleProtect}
                                disabled={protectionLoading}
                            >
                                {protectionLoading ? '적용 중...' : '보호 적용'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 제목 입력 (새 문서인 경우) */}
            {isNew && (
                <div className="form-group">
                    <label className="form-label">문서 제목</label>
                    <input
                        type="text"
                        className="form-input"
                        value={pageTitle}
                        onChange={(e) => setPageTitle(e.target.value)}
                        placeholder="문서 제목을 입력하세요"
                    />
                </div>
            )}

            {/* 툴바 */}
            <div className="wiki-editor-toolbar">
                {toolbarButtons.map((btn, i) => (
                    <button
                        key={i}
                        type="button"
                        title={btn.title}
                        onClick={btn.action}
                    >
                        {btn.label}
                    </button>
                ))}
            </div>

            {/* 에디터 */}
            <textarea
                ref={textareaRef}
                className="wiki-editor-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="NamuMark 문법으로 문서를 작성하세요...

예시:
= 제목 =
== 소제목 ==

'''굵게''', ''기울임'', ~~취소선~~

[[다른 문서]] - 내부 링크
[[https://example.com|외부 링크]]

{{{
코드 블록
}}}

[* 각주 내용]
"
            />

            {/* 편집 요약 */}
            <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label">편집 요약</label>
                <input
                    type="text"
                    className="form-input"
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    placeholder="변경 사항을 간략히 설명해주세요"
                />
            </div>

            {/* 액션 버튼 */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving || deleting || previewLoading}
                >
                    {saving ? '저장 중...' : '💾 저장'}
                </button>
                <button
                    className="btn btn-secondary"
                    onClick={handlePreview}
                    disabled={saving || deleting || previewLoading}
                >
                    {previewLoading ? '로딩...' : '👁️ 미리보기'}
                </button>
                <Link
                    to={title ? `/w/${encodeURIComponent(title)}` : '/'}
                    className="btn btn-outline"
                >
                    취소
                </Link>

                {/* 문서 보호 버튼 (관리자/모더레이터만) */}
                {!isNew && canProtect && !currentProtection && (
                    <button
                        className="btn btn-outline"
                        onClick={() => setShowProtectionModal(true)}
                        disabled={saving || deleting}
                    >
                        🔒 문서 보호
                    </button>
                )}

                {/* 삭제 버튼 (기존 문서 편집 시에만 표시) */}
                {!isNew && (
                    <button
                        className="btn btn-danger"
                        onClick={handleDeleteClick}
                        disabled={saving || deleting}
                        style={{ marginLeft: 'auto' }}
                    >
                        🗑️ 문서 삭제
                    </button>
                )}
            </div>

            {/* 문법 도움말 */}
            <details style={{ marginTop: '2rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 500 }}>📖 문법 도움말</summary>
                <div className="wiki-editor-preview" style={{ marginTop: '1rem' }}>
                    <table style={{ width: '100%', fontSize: '0.875rem' }}>
                        <thead>
                            <tr>
                                <th>문법</th>
                                <th>설명</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td><code>[[문서명]]</code></td><td>내부 링크</td></tr>
                            <tr><td><code>[[문서명|표시]]</code></td><td>링크 + 다른 텍스트 표시</td></tr>
                            <tr><td><code>'''굵게'''</code></td><td>굵은 글씨</td></tr>
                            <tr><td><code>''기울임''</code></td><td>기울인 글씨</td></tr>
                            <tr><td><code>~~취소선~~</code></td><td>취소선</td></tr>
                            <tr><td><code>__밑줄__</code></td><td>밑줄</td></tr>
                            <tr><td><code>{'{{{코드}}}'}</code></td><td>인라인 코드</td></tr>
                            <tr><td><code>= 제목 =</code></td><td>제목 (= ~ ======)</td></tr>
                            <tr><td><code> * 항목</code></td><td>글머리 기호 목록</td></tr>
                            <tr><td><code> 1. 항목</code></td><td>번호 목록</td></tr>
                            <tr><td><code>&gt; 인용</code></td><td>인용문</td></tr>
                            <tr><td><code>----</code></td><td>수평선</td></tr>
                            <tr><td><code>[* 각주]</code></td><td>각주</td></tr>
                            <tr><td><code>[[파일:이미지.png]]</code></td><td>이미지 삽입</td></tr>
                            <tr><td><code>[[분류:분류명]]</code></td><td>분류 추가</td></tr>
                            <tr style={{ background: 'rgba(var(--color-accent-rgb), 0.1)' }}>
                                <td><code>[youtube(영상ID)]</code></td>
                                <td>유튜브 영상 임베드</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </details>

            {/* 미리보기 모달 */}
            {showPreview && (
                <div className="wiki-preview-modal" onClick={() => setShowPreview(false)}>
                    <div className="wiki-preview-content" onClick={(e) => e.stopPropagation()}>
                        <div className="wiki-preview-header">
                            <h3>👁️ 미리보기</h3>
                            <button
                                className="btn btn-outline"
                                onClick={() => setShowPreview(false)}
                                style={{ padding: '0.25rem 0.5rem' }}
                            >
                                ✕ 닫기
                            </button>
                        </div>
                        <div className="wiki-preview-body wiki-page-content">
                            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PageEdit;
