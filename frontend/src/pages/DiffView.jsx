import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

function DiffView() {
    const { title: paramTitle, rev1, rev2 } = useParams();
    const title = paramTitle ? decodeURIComponent(paramTitle) : '';
    const revision1 = parseInt(rev1);
    const revision2 = parseInt(rev2);

    const [diff, setDiff] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchDiff();
    }, [title, revision1, revision2]);

    const fetchDiff = async () => {
        setLoading(true);
        try {
            // 두 리비전의 내용을 가져옴
            const [res1, res2] = await Promise.all([
                fetch(`/api/history/${encodeURIComponent(title)}/${revision1}`),
                fetch(`/api/history/${encodeURIComponent(title)}/${revision2}`)
            ]);

            const data1 = await res1.json();
            const data2 = await res2.json();

            if (!res1.ok || !res2.ok) {
                throw new Error('리비전을 불러올 수 없습니다.');
            }

            // 클라이언트 측 간단한 diff 계산
            const diffResult = computeDiff(
                data1.revision?.content || '',
                data2.revision?.content || ''
            );

            setDiff({
                old: data1.revision,
                new: data2.revision,
                changes: diffResult
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // 간단한 라인별 diff 계산
    const computeDiff = (oldText, newText) => {
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        const changes = [];

        const maxLen = Math.max(oldLines.length, newLines.length);

        // LCS(Longest Common Subsequence) 기반 간단 diff
        let oldIdx = 0;
        let newIdx = 0;

        while (oldIdx < oldLines.length || newIdx < newLines.length) {
            const oldLine = oldLines[oldIdx];
            const newLine = newLines[newIdx];

            if (oldLine === newLine) {
                changes.push({ type: 'same', line: oldLine, oldNum: oldIdx + 1, newNum: newIdx + 1 });
                oldIdx++;
                newIdx++;
            } else if (oldIdx >= oldLines.length) {
                changes.push({ type: 'add', line: newLine, newNum: newIdx + 1 });
                newIdx++;
            } else if (newIdx >= newLines.length) {
                changes.push({ type: 'remove', line: oldLine, oldNum: oldIdx + 1 });
                oldIdx++;
            } else {
                // 변경된 라인 찾기
                const oldInNew = newLines.indexOf(oldLine, newIdx);
                const newInOld = oldLines.indexOf(newLine, oldIdx);

                if (oldInNew !== -1 && (newInOld === -1 || oldInNew - newIdx <= newInOld - oldIdx)) {
                    // 새 버전에 추가된 라인들
                    while (newIdx < oldInNew) {
                        changes.push({ type: 'add', line: newLines[newIdx], newNum: newIdx + 1 });
                        newIdx++;
                    }
                } else if (newInOld !== -1) {
                    // 이전 버전에서 삭제된 라인들
                    while (oldIdx < newInOld) {
                        changes.push({ type: 'remove', line: oldLines[oldIdx], oldNum: oldIdx + 1 });
                        oldIdx++;
                    }
                } else {
                    // 완전히 변경된 라인
                    changes.push({ type: 'remove', line: oldLine, oldNum: oldIdx + 1 });
                    changes.push({ type: 'add', line: newLine, newNum: newIdx + 1 });
                    oldIdx++;
                    newIdx++;
                }
            }
        }

        return changes;
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

    // 통계 계산
    const addedLines = diff.changes.filter(c => c.type === 'add').length;
    const removedLines = diff.changes.filter(c => c.type === 'remove').length;
    const unchangedLines = diff.changes.filter(c => c.type === 'same').length;

    return (
        <div className="wiki-page">
            <div className="wiki-page-header">
                <h1 className="wiki-page-title">
                    비교: {title}
                </h1>
                <div className="wiki-page-actions">
                    <Link
                        to={`/history/${encodeURIComponent(title)}`}
                        className="btn btn-secondary"
                    >
                        ← 히스토리로 돌아가기
                    </Link>
                </div>
            </div>

            {/* 비교 정보 헤더 */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1.5rem'
            }}>
                <div style={{
                    background: 'rgba(220, 53, 69, 0.1)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: '4px solid var(--color-danger)'
                }}>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>📄 r{revision1} (이전)</h4>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                        {formatDate(diff.old?.edited_at)}
                    </div>
                    <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        {diff.old?.edit_summary || '(편집 요약 없음)'}
                    </div>
                </div>
                <div style={{
                    background: 'rgba(40, 167, 69, 0.1)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: '4px solid var(--color-success)'
                }}>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>📄 r{revision2} (이후)</h4>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                        {formatDate(diff.new?.edited_at)}
                    </div>
                    <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        {diff.new?.edit_summary || '(편집 요약 없음)'}
                    </div>
                </div>
            </div>

            {/* 변경 통계 */}
            <div style={{
                display: 'flex',
                gap: '1rem',
                marginBottom: '1rem',
                fontSize: '0.9rem'
            }}>
                <span style={{ color: 'var(--color-success)' }}>
                    <strong>+{addedLines}</strong> 추가
                </span>
                <span style={{ color: 'var(--color-danger)' }}>
                    <strong>-{removedLines}</strong> 삭제
                </span>
                <span style={{ color: 'var(--color-text-muted)' }}>
                    {unchangedLines}줄 동일
                </span>
            </div>

            {/* Diff 표시 */}
            <div style={{
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                overflow: 'hidden',
                fontFamily: 'monospace',
                fontSize: '0.8rem'
            }}>
                {diff.changes.map((change, index) => (
                    <div
                        key={index}
                        style={{
                            display: 'flex',
                            background: change.type === 'add'
                                ? 'rgba(40, 167, 69, 0.15)'
                                : change.type === 'remove'
                                    ? 'rgba(220, 53, 69, 0.15)'
                                    : 'transparent',
                            borderBottom: '1px solid var(--color-border)'
                        }}
                    >
                        {/* 라인 번호 */}
                        <span style={{
                            width: '3rem',
                            padding: '0.25rem 0.5rem',
                            textAlign: 'right',
                            color: 'var(--color-text-muted)',
                            borderRight: '1px solid var(--color-border)',
                            background: 'rgba(0,0,0,0.02)',
                            userSelect: 'none'
                        }}>
                            {change.type !== 'add' ? change.oldNum : ''}
                        </span>
                        <span style={{
                            width: '3rem',
                            padding: '0.25rem 0.5rem',
                            textAlign: 'right',
                            color: 'var(--color-text-muted)',
                            borderRight: '1px solid var(--color-border)',
                            background: 'rgba(0,0,0,0.02)',
                            userSelect: 'none'
                        }}>
                            {change.type !== 'remove' ? change.newNum : ''}
                        </span>
                        {/* 변경 표시 */}
                        <span style={{
                            width: '1.5rem',
                            padding: '0.25rem',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            color: change.type === 'add'
                                ? 'var(--color-success)'
                                : change.type === 'remove'
                                    ? 'var(--color-danger)'
                                    : 'transparent',
                            userSelect: 'none'
                        }}>
                            {change.type === 'add' ? '+' : change.type === 'remove' ? '-' : ' '}
                        </span>
                        {/* 내용 */}
                        <span style={{
                            flex: 1,
                            padding: '0.25rem 0.5rem',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                        }}>
                            {change.line || ' '}
                        </span>
                    </div>
                ))}
            </div>

            {/* 변경 없음 표시 */}
            {diff.changes.length === 0 || (addedLines === 0 && removedLines === 0) && (
                <div style={{
                    textAlign: 'center',
                    padding: '2rem',
                    color: 'var(--color-text-muted)'
                }}>
                    두 리비전 간 변경사항이 없습니다.
                </div>
            )}
        </div>
    );
}

export default DiffView;
