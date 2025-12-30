import { useState } from 'react';
import { Link } from 'react-router-dom';

function Sidebar({ user, isAdmin }) {
    const [isBrowseOpen, setIsBrowseOpen] = useState(false);

    return (
        <aside className="wiki-sidebar">
            {/* 둘러보기 - 접기 가능 */}
            <h3
                onClick={() => setIsBrowseOpen(!isBrowseOpen)}
                style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none'
                }}
            >
                둘러보기
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {isBrowseOpen ? '▼' : '▶'}
                </span>
            </h3>
            {isBrowseOpen && (
                <nav className="wiki-sidebar-nav">
                    <Link to="/w/대문">대문</Link>
                    <Link to="/recent">최근 변경</Link>
                    <Link to="/pages">모든 문서</Link>
                    <Link to="/w/random">랜덤 문서</Link>
                    <Link to="/categories">📂 분류 목록</Link>
                </nav>
            )}

            <h3>도구</h3>
            <nav className="wiki-sidebar-nav">
                <Link to="/tools/dice">🎲 주사위 시뮬레이터</Link>
                <a href="https://andrea4595.github.io/ObsidianProtocolRoasterReady/" target="_blank" rel="noopener noreferrer">📋 로스터 빌더 ↗</a>
                <a href="https://random0v0.github.io/AmadeusEmber/AmadeusEmber_web/" target="_blank" rel="noopener noreferrer">🤖 AmadeusEmber ↗</a>
                <Link to="/settings">⚙️ 설정</Link>
            </nav>

            <h3>링크</h3>
            <nav className="wiki-sidebar-nav">
                <a href="https://blog.naver.com/PostList.naver?blogId=raccoonpunk" target="_blank" rel="noopener noreferrer">🦝 라쿤펀치 블로그 ↗</a>
                <a href="https://smartstore.naver.com/raccoonpunk" target="_blank" rel="noopener noreferrer">🛒 라쿤펀치 스토어 ↗</a>
                <a href="https://www.queti-tectonics.com/" target="_blank" rel="noopener noreferrer">🌐 Queti Techtonics ↗</a>
            </nav>

            <h3>도움말</h3>
            <nav className="wiki-sidebar-nav">
                <Link to="/w/도움말:문법">문법 도움말</Link>
                <Link to="/w/도움말:편집">편집 도움말</Link>
                <Link to="/w/도움말:표">표 도움말</Link>
            </nav>

            {/* 관리 메뉴 - admin/owner에게만 표시 */}
            {isAdmin && (
                <>
                    <h3 style={{ color: 'var(--color-accent)' }}>🔧 관리</h3>
                    <nav className="wiki-sidebar-nav">
                        <Link to="/upload">📁 파일 업로드</Link>
                        <Link
                            to="/admin"
                            style={{
                                color: 'var(--color-accent)',
                                fontWeight: 500
                            }}
                        >
                            🔧 관리자 페이지
                        </Link>
                    </nav>
                </>
            )}

            {/* 로그인 상태 표시 */}
            {user && (
                <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem'
                }}>
                    <div style={{ color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                        로그인됨
                    </div>
                    <div style={{ fontWeight: 500 }}>
                        {user.username}
                    </div>
                    {isAdmin && (
                        <div style={{
                            marginTop: '0.25rem',
                            color: 'var(--color-accent)',
                            fontSize: '0.7rem'
                        }}>
                            {user.role === 'owner' ? '👑 오너' : '⚙️ 관리자'}
                        </div>
                    )}
                </div>
            )}
        </aside>
    );
}

export default Sidebar;
