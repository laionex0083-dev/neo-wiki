import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

/**
 * 모바일 하단 네비게이션 바 컴포넌트
 * 모바일 환경에서 주요 메뉴에 빠르게 접근할 수 있습니다.
 */
function MobileBottomNav() {
    const location = useLocation();
    const navigate = useNavigate();
    const [showToc, setShowToc] = useState(false);
    const [showTools, setShowTools] = useState(false);
    const [tocItems, setTocItems] = useState([]);

    const isActive = (path) => {
        if (path === '/w' || path === '/') {
            return location.pathname === '/' || location.pathname.startsWith('/w/');
        }
        return location.pathname.startsWith(path);
    };

    // 목차 데이터 가져오기
    useEffect(() => {
        const extractToc = () => {
            const tocElement = document.querySelector('.wiki-toc ul');
            if (tocElement) {
                const items = [];
                tocElement.querySelectorAll('li > a').forEach(link => {
                    items.push({
                        id: link.getAttribute('href')?.substring(1) || '',
                        title: link.textContent || '',
                        level: parseInt(link.closest('li')?.style.paddingLeft || '0', 10) / 12
                    });
                });
                setTocItems(items);
            } else {
                setTocItems([]);
            }
        };

        extractToc();

        // DOM 변화 감지
        const observer = new MutationObserver(extractToc);
        observer.observe(document.body, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, [location.pathname]);

    // 목차 항목 클릭 시
    const handleTocClick = (id) => {
        setShowToc(false);
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // 도구 항목 클릭 시
    const handleToolClick = (path, isExternal = false) => {
        setShowTools(false);
        if (isExternal) {
            window.open(path, '_blank', 'noopener,noreferrer');
        } else {
            navigate(path);
        }
    };

    // 배경 클릭 시 닫기
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            setShowToc(false);
            setShowTools(false);
        }
    };

    // 도구 목록
    const toolItems = [
        { icon: '🎲', label: '주사위 시뮬레이터', path: '/tools/dice' },
        { icon: '📋', label: '로스터 빌더', path: 'https://andrea4595.github.io/ObsidianProtocolRoasterReady/', external: true },
        { icon: '🤖', label: 'AmadeusEmber', path: 'https://random0v0.github.io/AmadeusEmber/AmadeusEmber_web/', external: true },
    ];

    const linkItems = [
        { icon: '🦝', label: '라쿤펀치 블로그', path: 'https://blog.naver.com/PostList.naver?blogId=raccoonpunk', external: true },
        { icon: '🛒', label: '라쿤펀치 스토어', path: 'https://smartstore.naver.com/raccoonpunk', external: true },
        { icon: '🌐', label: 'Queti Techtonics', path: 'https://www.queti-tectonics.com/', external: true },
    ];

    return (
        <>
            <nav className="mobile-bottom-nav">
                <Link to="/w/대문" className={`mobile-nav-item ${isActive('/w') ? 'active' : ''}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    <span>대문</span>
                </Link>
                <button
                    className={`mobile-nav-item ${showToc ? 'active' : ''}`}
                    onClick={() => { setShowToc(!showToc); setShowTools(false); }}
                    disabled={tocItems.length === 0}
                    style={{
                        background: 'none',
                        border: 'none',
                        opacity: tocItems.length === 0 ? 0.5 : 1
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="15" y2="12" />
                        <line x1="3" y1="18" x2="18" y2="18" />
                    </svg>
                    <span>목차</span>
                </button>
                <Link to="/pages" className={`mobile-nav-item ${isActive('/pages') ? 'active' : ''}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span>문서</span>
                </Link>
                <button
                    className={`mobile-nav-item ${showTools ? 'active' : ''}`}
                    onClick={() => { setShowTools(!showTools); setShowToc(false); }}
                    style={{ background: 'none', border: 'none' }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <circle cx="15.5" cy="8.5" r="1.5" />
                        <circle cx="15.5" cy="15.5" r="1.5" />
                        <circle cx="8.5" cy="15.5" r="1.5" />
                    </svg>
                    <span>도구</span>
                </button>
                <Link to="/settings" className={`mobile-nav-item ${isActive('/settings') ? 'active' : ''}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    <span>설정</span>
                </Link>
            </nav>

            {/* Bottom Sheet 목차 패널 */}
            {showToc && tocItems.length > 0 && (
                <div
                    className="mobile-toc-backdrop"
                    onClick={handleBackdropClick}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 9998,
                        animation: 'fadeIn 0.2s ease'
                    }}
                >
                    <div
                        className="mobile-toc-sheet"
                        style={{
                            position: 'absolute',
                            bottom: '60px',
                            left: 0,
                            right: 0,
                            maxHeight: '60vh',
                            background: 'var(--color-bg-primary)',
                            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.2)',
                            overflowY: 'auto',
                            animation: 'slideUp 0.3s ease'
                        }}
                    >
                        {/* 핸들 바 */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            padding: '0.75rem',
                            borderBottom: '1px solid var(--color-border)'
                        }}>
                            <div style={{
                                width: '40px',
                                height: '4px',
                                background: 'var(--color-border)',
                                borderRadius: '2px'
                            }} />
                        </div>

                        {/* 헤더 */}
                        <div style={{
                            padding: '0.75rem 1rem',
                            borderBottom: '1px solid var(--color-border)',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            📑 목차
                        </div>

                        {/* 목차 항목 */}
                        <div style={{ padding: '0.5rem 0' }}>
                            {tocItems.map((item, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleTocClick(item.id)}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '0.75rem 1rem',
                                        paddingLeft: `${1 + item.level * 0.75}rem`,
                                        background: 'none',
                                        border: 'none',
                                        textAlign: 'left',
                                        color: 'var(--color-link)',
                                        fontSize: '0.95rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {item.title}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Sheet 도구 패널 */}
            {showTools && (
                <div
                    className="mobile-tools-backdrop"
                    onClick={handleBackdropClick}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 9998,
                        animation: 'fadeIn 0.2s ease'
                    }}
                >
                    <div
                        className="mobile-tools-sheet"
                        style={{
                            position: 'absolute',
                            bottom: '60px',
                            left: 0,
                            right: 0,
                            maxHeight: '70vh',
                            background: 'var(--color-bg-primary)',
                            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.2)',
                            overflowY: 'auto',
                            animation: 'slideUp 0.3s ease'
                        }}
                    >
                        {/* 핸들 바 */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            padding: '0.75rem',
                            borderBottom: '1px solid var(--color-border)'
                        }}>
                            <div style={{
                                width: '40px',
                                height: '4px',
                                background: 'var(--color-border)',
                                borderRadius: '2px'
                            }} />
                        </div>

                        {/* 도구 섹션 */}
                        <div style={{
                            padding: '0.75rem 1rem',
                            borderBottom: '1px solid var(--color-border)',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            color: 'var(--color-text-muted)',
                            textTransform: 'uppercase'
                        }}>
                            🔧 도구
                        </div>
                        <div style={{ padding: '0.5rem 0' }}>
                            {toolItems.map((item, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleToolClick(item.path, item.external)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        width: '100%',
                                        padding: '0.85rem 1rem',
                                        background: 'none',
                                        border: 'none',
                                        textAlign: 'left',
                                        color: 'var(--color-text-primary)',
                                        fontSize: '0.95rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                                    <span>{item.label}</span>
                                    {item.external && (
                                        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>↗</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* 링크 섹션 */}
                        <div style={{
                            padding: '0.75rem 1rem',
                            borderTop: '1px solid var(--color-border)',
                            borderBottom: '1px solid var(--color-border)',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            color: 'var(--color-text-muted)',
                            textTransform: 'uppercase'
                        }}>
                            🔗 링크
                        </div>
                        <div style={{ padding: '0.5rem 0' }}>
                            {linkItems.map((item, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleToolClick(item.path, item.external)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        width: '100%',
                                        padding: '0.85rem 1rem',
                                        background: 'none',
                                        border: 'none',
                                        textAlign: 'left',
                                        color: 'var(--color-text-primary)',
                                        fontSize: '0.95rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                                    <span>{item.label}</span>
                                    {item.external && (
                                        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>↗</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* CSS 애니메이션 */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
            `}</style>
        </>
    );
}

export default MobileBottomNav;
