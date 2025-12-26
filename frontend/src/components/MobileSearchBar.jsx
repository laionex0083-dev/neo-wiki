import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * 모바일 검색 바 컴포넌트
 * 모바일 환경에서 헤더 아래에 고정되는 검색창입니다.
 */
function MobileSearchBar() {
    const [searchQuery, setSearchQuery] = useState('');
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
                const res = await fetch(`/api/pages/autocomplete?q=${encodeURIComponent(searchQuery.trim())}&limit=8`);
                if (res.ok) {
                    const data = await res.json();
                    setSuggestions(data.results || []);
                    setShowSuggestions(data.results?.length > 0);
                    setSelectedIndex(-1);
                }
            } catch (err) {
                console.error('Autocomplete error:', err);
            }
        }, 200);

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

    const handleSelectSuggestion = (title) => {
        setSearchQuery(title);
        setShowSuggestions(false);
        navigate(`/w/${encodeURIComponent(title)}`);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && e.ctrlKey && searchQuery.trim()) {
            setShowSuggestions(false);
            navigate(`/w/${encodeURIComponent(searchQuery.trim())}`);
            return;
        }

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

    return (
        <div className="mobile-search-bar" ref={searchRef}>
            <form onSubmit={handleSearch} className="mobile-search-form">
                <div className="mobile-search-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                    </svg>
                </div>
                <input
                    type="text"
                    className="mobile-search-input"
                    placeholder="문서 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (suggestions.length > 0) setShowSuggestions(true);
                    }}
                    autoComplete="off"
                />
                <button type="submit" className="mobile-search-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                </button>
            </form>

            {/* 자동완성 드롭다운 */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="mobile-search-suggestions">
                    {suggestions.map((title, index) => (
                        <div
                            key={title}
                            className={`mobile-search-suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                            onClick={() => handleSelectSuggestion(title)}
                        >
                            <span className="suggestion-icon">📄</span>
                            <span className="suggestion-text">{title}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default MobileSearchBar;
