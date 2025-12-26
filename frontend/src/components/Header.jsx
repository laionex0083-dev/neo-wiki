import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

function Header({ user, onLogin, onLogout, isAdmin }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const searchRef = useRef(null);
    const debounceRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();

    // 페이지 이동 시 검색어 초기화
    useEffect(() => {
        setSearchQuery('');
        setSuggestions([]);
        setShowSuggestions(false);
    }, [location.pathname]);

    // 디바운싱된 자동완성 검색
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (!searchQuery.trim()) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/pages/autocomplete?q=${encodeURIComponent(searchQuery.trim())}&limit=10`);
                if (res.ok) {
                    const data = await res.json();
                    setSuggestions(data.results || []);
                    setShowSuggestions(data.results?.length > 0);
                    setSelectedIndex(-1);
                }
            } catch (err) {
                console.error('Autocomplete error:', err);
            }
        }, 200); // 200ms 디바운싱

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [searchQuery]);

    // 외부 클릭 시 드롭다운 닫기
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            setShowSuggestions(false);
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const handleInputChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handleKeyDown = (e) => {
        // Ctrl+Enter: 바로가기
        if (e.key === 'Enter' && e.ctrlKey && searchQuery.trim()) {
            setShowSuggestions(false);
            navigate(`/w/${encodeURIComponent(searchQuery.trim())}`);
            return;
        }

        // 방향키 및 Enter로 자동완성 선택
        if (showSuggestions && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, -1));
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                handleSelectSuggestion(suggestions[selectedIndex]);
            } else if (e.key === 'Escape') {
                setShowSuggestions(false);
            }
        }
    };

    const handleSelectSuggestion = (title) => {
        setSearchQuery(title);
        setShowSuggestions(false);
        navigate(`/w/${encodeURIComponent(title)}`);
    };

    // 검색어 하이라이팅
    const highlightMatch = (text, query) => {
        if (!query.trim()) return text;

        const queryLower = query.toLowerCase();
        const textLower = text.toLowerCase();
        const index = textLower.indexOf(queryLower);

        if (index === -1) return text;

        return (
            <>
                {text.slice(0, index)}
                <strong style={{ color: 'var(--color-accent)', background: 'rgba(var(--color-accent-rgb), 0.15)' }}>
                    {text.slice(index, index + query.length)}
                </strong>
                {text.slice(index + query.length)}
            </>
        );
    };

    return (
        <>
            <header className="wiki-header">
                <Link to="/" className="wiki-header-logo">
                    🌳 Neo-Wiki
                </Link>

                <form
                    className="wiki-header-search"
                    onSubmit={handleSearch}
                    ref={searchRef}
                    style={{ position: 'relative' }}
                >
                    <input
                        type="text"
                        className="wiki-search-input"
                        placeholder="문서 검색... (Ctrl+Enter: 바로가기)"
                        value={searchQuery}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                            if (suggestions.length > 0) setShowSuggestions(true);
                        }}
                        autoComplete="off"
                    />

                    {/* 자동완성 드롭다운 */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: 'var(--color-bg-primary)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                            boxShadow: 'var(--shadow-lg)',
                            zIndex: 1000,
                            maxHeight: '300px',
                            overflowY: 'auto'
                        }}>
                            {suggestions.map((title, index) => (
                                <div
                                    key={title}
                                    onClick={() => handleSelectSuggestion(title)}
                                    style={{
                                        padding: '0.5rem 0.75rem',
                                        cursor: 'pointer',
                                        background: index === selectedIndex
                                            ? 'var(--color-bg-secondary)'
                                            : 'transparent',
                                        borderBottom: index < suggestions.length - 1
                                            ? '1px solid var(--color-border-light)'
                                            : 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                >
                                    <span style={{ opacity: 0.5, fontSize: '0.85em' }}>📄</span>
                                    <span>{highlightMatch(title, searchQuery)}</span>
                                </div>
                            ))}
                            <div style={{
                                padding: '0.4rem 0.75rem',
                                fontSize: '0.75rem',
                                color: 'var(--color-text-muted)',
                                background: 'var(--color-bg-tertiary)',
                                borderTop: '1px solid var(--color-border)'
                            }}>
                                ↑↓ 선택 · Enter 이동 · Ctrl+Enter 바로가기
                            </div>
                        </div>
                    )}
                </form>

                <nav className="wiki-header-nav">
                    <Link to="/recent">최근 변경</Link>
                    <Link to="/pages">문서 목록</Link>
                    <Link to="/upload">업로드</Link>

                    {/* 관리자 아이콘 - admin/owner에게만 표시 */}
                    {isAdmin && (
                        <Link
                            to="/admin"
                            title="관리자 페이지"
                            style={{
                                color: 'var(--color-accent)',
                                fontWeight: 600
                            }}
                        >
                            🔧
                        </Link>
                    )}

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
