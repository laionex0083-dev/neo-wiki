import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Header({ user, onLogin, onLogout }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showLoginModal, setShowLoginModal] = useState(false);
    const navigate = useNavigate();

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const handleGoToPage = (e) => {
        if (e.key === 'Enter' && e.ctrlKey && searchQuery.trim()) {
            navigate(`/w/${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    return (
        <>
            <header className="wiki-header">
                <Link to="/" className="wiki-header-logo">
                    🌳 Neo-Wiki
                </Link>

                <form className="wiki-header-search" onSubmit={handleSearch}>
                    <input
                        type="text"
                        className="wiki-search-input"
                        placeholder="문서 검색... (Ctrl+Enter: 바로가기)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleGoToPage}
                    />
                </form>

                <nav className="wiki-header-nav">
                    <Link to="/recent">최근 변경</Link>
                    <Link to="/pages">문서 목록</Link>
                    <Link to="/upload">업로드</Link>

                    {user ? (
                        <>
                            <span>안녕하세요, {user.username}님</span>
                            <button onClick={onLogout}>로그아웃</button>
                        </>
                    ) : (
                        <button onClick={() => setShowLoginModal(true)}>로그인</button>
                    )}
                </nav>
            </header>

            {showLoginModal && (
                <LoginModal
                    onClose={() => setShowLoginModal(false)}
                    onLogin={(userData, token) => {
                        onLogin(userData, token);
                        setShowLoginModal(false);
                    }}
                />
            )}
        </>
    );
}

function LoginModal({ onClose, onLogin }) {
    const [mode, setMode] = useState('login');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = mode === 'login' ? '/api/users/login' : '/api/users/register';
        const body = mode === 'login'
            ? { username, password }
            : { username, email, password };

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '오류가 발생했습니다.');
            }

            onLogin(data.user, data.token);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{mode === 'login' ? '로그인' : '회원가입'}</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">사용자명</label>
                        <input
                            type="text"
                            className="form-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            minLength={2}
                            maxLength={20}
                        />
                    </div>

                    {mode === 'register' && (
                        <div className="form-group">
                            <label className="form-label">이메일 (선택)</label>
                            <input
                                type="email"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">비밀번호</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        disabled={loading}
                    >
                        {loading ? '처리 중...' : (mode === 'login' ? '로그인' : '회원가입')}
                    </button>
                </form>

                <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>
                    {mode === 'login' ? (
                        <>
                            계정이 없으신가요?{' '}
                            <button
                                onClick={() => setMode('register')}
                                style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer' }}
                            >
                                회원가입
                            </button>
                        </>
                    ) : (
                        <>
                            이미 계정이 있으신가요?{' '}
                            <button
                                onClick={() => setMode('login')}
                                style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer' }}
                            >
                                로그인
                            </button>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}

export default Header;
