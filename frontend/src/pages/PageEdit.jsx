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

    useEffect(() => {
        if (title) {
            fetchPage();
        }
    }, [title]);

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
            const res = await fetch(`/api/pages/${encodeURIComponent(pageTitle.trim())}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            const res = await fetch(`/api/pages/${encodeURIComponent(title)}`, {
                method: 'DELETE'
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
    ];

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
                    disabled={saving || deleting}
                >
                    {saving ? '저장 중...' : '💾 저장'}
                </button>
                <Link
                    to={title ? `/w/${encodeURIComponent(title)}` : '/'}
                    className="btn btn-secondary"
                >
                    취소
                </Link>

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
                        </tbody>
                    </table>
                </div>
            </details>
        </div>
    );
}

export default PageEdit;
