import { Link } from 'react-router-dom';

function Sidebar({ user, isAdmin }) {
    return (
        <aside className="wiki-sidebar">
            <h3>둘러보기</h3>
            <nav className="wiki-sidebar-nav">
                <Link to="/w/대문">대문</Link>
                <Link to="/recent">최근 변경</Link>
                <Link to="/pages">모든 문서</Link>
                <Link to="/w/random">랜덤 문서</Link>
            </nav>

            <h3>도구</h3>
            <nav className="wiki-sidebar-nav">
                <Link to="/upload">파일 업로드</Link>
                <Link to="/pages?namespace=분류">분류 목록</Link>
                <Link to="/settings">⚙️ 설정</Link>
            </nav>

            {/* 관리자 메뉴 - admin/owner에게만 표시 */}
            {isAdmin && (
                <>
                    <h3 style={{ color: 'var(--color-accent)' }}>🔧 관리</h3>
                    <nav className="wiki-sidebar-nav">
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

            <h3>도움말</h3>
            <nav className="wiki-sidebar-nav">
                <Link to="/w/도움말:문법">문법 도움말</Link>
                <Link to="/w/도움말:편집">편집 도움말</Link>
            </nav>

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
