import { useState, useEffect } from 'react';

/**
 * 플로팅 스크롤 버튼 컴포넌트
 * 우측 하단에 목차 이동, 맨 위/맨 아래로 이동하는 버튼을 표시합니다.
 */
function FloatingScrollButtons() {
    const [showButtons, setShowButtons] = useState(false);
    const [hasToc, setHasToc] = useState(false);

    useEffect(() => {
        // 페이지 로드 후 약간의 딜레이를 두고 자연스럽게 나타남
        const timer = setTimeout(() => {
            setShowButtons(true);
        }, 300);

        // 목차 존재 여부 확인
        const checkToc = () => {
            const tocElement = document.querySelector('.wiki-toc');
            setHasToc(!!tocElement);
        };

        checkToc();
        // DOM 변화 감지 (페이지 이동 시)
        const observer = new MutationObserver(checkToc);
        observer.observe(document.body, { childList: true, subtree: true });

        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const scrollToBottom = () => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };

    const scrollToToc = () => {
        const tocElement = document.querySelector('.wiki-toc');
        if (tocElement) {
            tocElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    return (
        <div className={`floating-scroll-buttons ${showButtons ? 'visible' : ''}`}>
            {hasToc && (
                <button
                    className="floating-scroll-btn floating-toc-btn"
                    onClick={scrollToToc}
                    title="목차로 이동"
                    aria-label="목차로 이동"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="15" y2="12" />
                        <line x1="3" y1="18" x2="18" y2="18" />
                    </svg>
                </button>
            )}
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
