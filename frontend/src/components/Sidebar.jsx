import { Link } from 'react-router-dom';

function Sidebar() {
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
            </nav>

            <h3>도움말</h3>
            <nav className="wiki-sidebar-nav">
                <Link to="/w/도움말:문법">문법 도움말</Link>
                <Link to="/w/도움말:편집">편집 도움말</Link>
            </nav>
        </aside>
    );
}

export default Sidebar;
