import { useState, useEffect } from 'react';

/**
 * 플로팅 스크롤 버튼 컴포넌트
 * 우측 하단에 맨 위/맨 아래로 이동하는 버튼을 표시합니다.
 * 페이지 로드 시 자연스럽게 나타납니다.
 */
function FloatingScrollButtons() {
    const [showButtons, setShowButtons] = useState(false);

    useEffect(() => {
        // 페이지 로드 후 약간의 딜레이를 두고 자연스럽게 나타남
        const timer = setTimeout(() => {
            setShowButtons(true);
        }, 300);

        return () => clearTimeout(timer);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const scrollToBottom = () => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };

    return (
        <div className={`floating-scroll-buttons ${showButtons ? 'visible' : ''}`}>
            <button
                className="floating-scroll-btn"
                onClick={scrollToTop}
                title="맨 위로"
                aria-label="맨 위로 이동"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 15l-6-6-6 6" />
                </svg>
            </button>
            <button
                className="floating-scroll-btn"
                onClick={scrollToBottom}
                title="맨 아래로"
                aria-label="맨 아래로 이동"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>
        </div>
    );
}

export default FloatingScrollButtons;
