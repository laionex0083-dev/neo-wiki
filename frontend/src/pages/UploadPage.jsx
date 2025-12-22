import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

function UploadPage() {
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [error, setError] = useState(null);
    const [dragOver, setDragOver] = useState(false);

    // 업로드된 이미지 목록 관련
    const [imageList, setImageList] = useState([]);
    const [loadingImages, setLoadingImages] = useState(true);
    const [totalImages, setTotalImages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
    const imagesPerPage = 20;

    // 이미지 목록 불러오기
    useEffect(() => {
        fetchImageList();
    }, [currentPage]);

    const fetchImageList = async () => {
        setLoadingImages(true);
        try {
            const offset = (currentPage - 1) * imagesPerPage;
            const res = await fetch(`/api/upload?limit=${imagesPerPage}&offset=${offset}`);
            const data = await res.json();
            setImageList(data.files || []);
            setTotalImages(data.total || 0);
        } catch (err) {
            console.error('Error fetching images:', err);
        } finally {
            setLoadingImages(false);
        }
    };

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);

        const droppedFiles = Array.from(e.dataTransfer.files).filter(
            file => file.type.startsWith('image/')
        );
        setFiles(prev => [...prev, ...droppedFiles]);
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOver(false);
    }, []);

    const handleFileSelect = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFiles(prev => [...prev, ...selectedFiles]);
    };

    const handleUpload = async () => {
        if (files.length === 0) return;

        setUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            files.forEach(file => formData.append('files', file));

            const res = await fetch('/api/upload/multiple', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            // 중복 이미지 에러 처리 (409 Conflict)
            if (res.status === 409) {
                setError(data.error || '중복된 파일명이 있습니다.');
                return;
            }

            if (!res.ok) {
                throw new Error(data.error || '업로드에 실패했습니다.');
            }

            // 업로드된 파일이 있으면 추가
            if (data.files && data.files.length > 0) {
                setUploadedFiles(prev => [...data.files, ...prev]);
            }

            // 중복 에러가 일부 있는 경우 알림
            if (data.errors && data.errors.length > 0) {
                setError(`일부 파일 업로드 실패:\n${data.errors.join('\n')}`);
            }

            setFiles([]);

            // 이미지 목록 새로고침
            fetchImageList();
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const copyWikiCode = (file) => {
        const code = `[[파일:${file.original_name}]]`;
        navigator.clipboard.writeText(code);
        alert('위키 코드가 클립보드에 복사되었습니다!');
    };

    const handleDeleteImage = async (imageId, storedName) => {
        if (!confirm('정말로 이 이미지를 삭제하시겠습니까?')) return;

        try {
            // ID로 우선 삭제 시도
            const res = await fetch(`/api/upload/${imageId}`, {
                method: 'DELETE'
            });

            const data = await res.json();

            if (res.ok) {
                fetchImageList();
                setUploadedFiles(prev => prev.filter(f => f.id !== imageId && f.stored_name !== storedName));
                alert('이미지가 삭제되었습니다.');
            } else {
                alert(`삭제 실패: ${data.error || '알 수 없는 오류'}`);
            }
        } catch (err) {
            console.error('Delete error:', err);
            alert('삭제 중 오류가 발생했습니다.');
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const totalPages = Math.ceil(totalImages / imagesPerPage);

    return (
        <div className="wiki-page">
            <div className="wiki-page-header">
                <h1 className="wiki-page-title">파일 업로드</h1>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {/* 드래그 앤 드롭 영역 */}
            <div
                className={`wiki-upload-zone ${dragOver ? 'dragover' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => document.getElementById('file-input').click()}
            >
                <h3>📁 파일을 여기에 드래그하거나 클릭하여 선택하세요</h3>
                <p>PNG, JPG, GIF, WebP, SVG (최대 10MB)</p>
                <input
                    type="file"
                    id="file-input"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                />
            </div>

            {/* 선택된 파일 목록 */}
            {files.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                    <h3 style={{ marginBottom: '0.5rem' }}>선택된 파일 ({files.length}개)</h3>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {files.map((file, i) => (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    padding: '0.75rem',
                                    background: 'var(--color-bg-secondary)',
                                    borderRadius: 'var(--radius-md)'
                                }}
                            >
                                <img
                                    src={URL.createObjectURL(file)}
                                    alt={file.name}
                                    style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4 }}
                                />
                                <span style={{ flex: 1 }}>{file.name}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                    {formatFileSize(file.size)}
                                </span>
                                <button
                                    className="btn btn-outline"
                                    onClick={() => removeFile(i)}
                                    style={{ padding: '0.25rem 0.5rem' }}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={handleUpload}
                        disabled={uploading}
                        style={{ marginTop: '1rem' }}
                    >
                        {uploading ? '업로드 중...' : `📤 ${files.length}개 파일 업로드`}
                    </button>
                </div>
            )}

            {/* 방금 업로드된 파일 */}
            {uploadedFiles.length > 0 && (
                <div style={{ marginTop: '2rem' }}>
                    <h3 style={{ marginBottom: '0.5rem' }}>✅ 방금 업로드됨</h3>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {uploadedFiles.map((file) => (
                            <div
                                key={file.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    padding: '0.75rem',
                                    background: 'rgba(40, 167, 69, 0.1)',
                                    border: '1px solid var(--color-success)',
                                    borderRadius: 'var(--radius-md)'
                                }}
                            >
                                <img
                                    src={file.url}
                                    alt={file.original_name}
                                    style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }}
                                />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500 }}>{file.original_name}</div>
                                    <code style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                        [[파일:{file.original_name}]]
                                    </code>
                                </div>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => copyWikiCode(file)}
                                    style={{ fontSize: '0.75rem' }}
                                >
                                    📋 코드 복사
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 구분선 */}
            <hr style={{ margin: '2rem 0', border: 'none', borderTop: '2px solid var(--color-border)' }} />

            {/* 업로드된 이미지 목록 */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ margin: 0 }}>📷 업로드된 이미지 ({totalImages}개)</h2>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setViewMode('grid')}
                            style={{ padding: '0.5rem' }}
                        >
                            ▦ 그리드
                        </button>
                        <button
                            className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setViewMode('list')}
                            style={{ padding: '0.5rem' }}
                        >
                            ☰ 리스트
                        </button>
                    </div>
                </div>

                {loadingImages ? (
                    <div className="loading">
                        <div className="loading-spinner"></div>
                    </div>
                ) : imageList.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
                        업로드된 이미지가 없습니다.
                    </p>
                ) : viewMode === 'grid' ? (
                    /* 그리드 뷰 */
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                        gap: '1rem'
                    }}>
                        {imageList.map((img) => (
                            <div
                                key={img.id}
                                style={{
                                    background: 'var(--color-bg-secondary)',
                                    borderRadius: 'var(--radius-md)',
                                    overflow: 'hidden',
                                    border: '1px solid var(--color-border)'
                                }}
                            >
                                <a href={img.url} target="_blank" rel="noopener noreferrer">
                                    <img
                                        src={img.url}
                                        alt={img.original_name}
                                        style={{
                                            width: '100%',
                                            height: '120px',
                                            objectFit: 'cover',
                                            display: 'block'
                                        }}
                                        loading="lazy"
                                    />
                                </a>
                                <div style={{ padding: '0.5rem' }}>
                                    <div style={{
                                        fontSize: '0.75rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        marginBottom: '0.25rem'
                                    }}>
                                        {img.original_name}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        <button
                                            className="btn btn-outline"
                                            onClick={() => copyWikiCode(img)}
                                            style={{ flex: 1, padding: '0.25rem', fontSize: '0.7rem' }}
                                        >
                                            📋 복사
                                        </button>
                                        <button
                                            className="btn btn-outline"
                                            onClick={() => handleDeleteImage(img.id, img.stored_name)}
                                            style={{ padding: '0.25rem', fontSize: '0.7rem', color: 'var(--color-danger)' }}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* 리스트 뷰 */
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {imageList.map((img) => (
                            <div
                                key={img.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    padding: '0.75rem',
                                    background: 'var(--color-bg-secondary)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border)'
                                }}
                            >
                                <a href={img.url} target="_blank" rel="noopener noreferrer">
                                    <img
                                        src={img.url}
                                        alt={img.original_name}
                                        style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }}
                                        loading="lazy"
                                    />
                                </a>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{img.original_name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                        {formatFileSize(img.size)} · {formatDate(img.uploaded_at)}
                                    </div>
                                    <code style={{ fontSize: '0.7rem', color: 'var(--color-accent)' }}>
                                        [[파일:{img.original_name}]]
                                    </code>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => copyWikiCode(img)}
                                        style={{ fontSize: '0.75rem' }}
                                    >
                                        📋 코드 복사
                                    </button>
                                    <button
                                        className="btn btn-danger"
                                        onClick={() => handleDeleteImage(img.id, img.stored_name)}
                                        style={{ fontSize: '0.75rem' }}
                                    >
                                        🗑️ 삭제
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 페이지네이션 */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                        >
                            ⟪
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            ◀ 이전
                        </button>
                        <span style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center' }}>
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            다음 ▶
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                        >
                            ⟫
                        </button>
                    </div>
                )}
            </div>

            {/* 도움말 */}
            <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>💡 사용 방법</h4>
                <ol style={{ marginLeft: '1.5rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    <li>이미지를 업로드합니다.</li>
                    <li>"📋 코드 복사" 버튼을 클릭합니다.</li>
                    <li>문서 편집 시 붙여넣기하면 이미지가 삽입됩니다.</li>
                </ol>
                <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    이미지 크기 조절: <code>[[파일:이미지.png|width=300]]</code>
                </p>
            </div>
        </div>
    );
}

export default UploadPage;
