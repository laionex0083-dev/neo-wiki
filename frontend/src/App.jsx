import { Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import PageView from './pages/PageView';
import PageEdit from './pages/PageEdit';
import PageHistory from './pages/PageHistory';
import PageList from './pages/PageList';
import RecentChanges from './pages/RecentChanges';
import SearchResults from './pages/SearchResults';
import UploadPage from './pages/UploadPage';
import RevisionView from './pages/RevisionView';
import DiffView from './pages/DiffView';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import BacklinksPage from './pages/BacklinksPage';
import NotFound from './pages/NotFound';

function App() {
    const [skin, setSkin] = useState('default');
    const [user, setUser] = useState(null);

    useEffect(() => {
        // 스킨 설정 로드
        fetch('/api/skins/active')
            .then(res => res.json())
            .then(data => setSkin(data.skin))
            .catch(() => { });

        // 저장된 토큰으로 사용자 정보 로드
        const token = localStorage.getItem('wiki_token');
        if (token) {
            fetch('/api/users/me', {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => res.ok ? res.json() : Promise.reject())
                .then(data => setUser(data.user))
                .catch(() => localStorage.removeItem('wiki_token'));
        }
    }, []);

    const handleLogin = (userData, token) => {
        setUser(userData);
        localStorage.setItem('wiki_token', token);
    };

    const handleLogout = () => {
        setUser(null);
        localStorage.removeItem('wiki_token');
    };

    // 관리자 권한 확인 (admin 또는 owner)
    const isAdmin = user && ['admin', 'owner'].includes(user.role);

    return (
        <div className={`wiki-app skin-${skin}`}>
            <Header
                user={user}
                onLogin={handleLogin}
                onLogout={handleLogout}
                isAdmin={isAdmin}
            />
            <div className="wiki-main">
                <Sidebar user={user} isAdmin={isAdmin} />
                <main className="wiki-content">
                    <Routes>
                        {/* 위키 문서 보기 (/w/제목) */}
                        <Route path="/w/:title" element={<PageView user={user} />} />
                        <Route path="/w" element={<PageView user={user} />} />

                        {/* 문서 편집 */}
                        <Route path="/edit/:title" element={<PageEdit />} />
                        <Route path="/edit" element={<PageEdit />} />

                        {/* 문서 히스토리 */}
                        <Route path="/history/:title" element={<PageHistory />} />

                        {/* 역링크 */}
                        <Route path="/backlinks/:title" element={<BacklinksPage />} />

                        {/* 리비전 보기 */}
                        <Route path="/revision/:title/:revision" element={<RevisionView />} />

                        {/* 리비전 비교 (Diff) */}
                        <Route path="/diff/:title/:rev1/:rev2" element={<DiffView />} />

                        {/* 특수 페이지 */}
                        <Route path="/pages" element={<PageList />} />
                        <Route path="/recent" element={<RecentChanges />} />
                        <Route path="/search" element={<SearchResults />} />
                        <Route path="/upload" element={<UploadPage />} />
                        <Route path="/settings" element={<SettingsPage />} />

                        {/* 관리자 페이지 */}
                        <Route path="/admin" element={<AdminPage />} />

                        {/* 기본 라우트 - 대문으로 */}
                        <Route path="/" element={<PageView defaultTitle="대문" user={user} />} />

                        {/* 404 */}
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
}

export default App;
