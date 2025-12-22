import { Link } from 'react-router-dom';

function NotFound() {
    return (
        <div className="wiki-page" style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '4rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                404
            </h1>
            <h2 style={{ marginBottom: '1rem' }}>페이지를 찾을 수 없습니다</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
                요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                <Link to="/" className="btn btn-primary">
                    🏠 대문으로
                </Link>
                <Link to="/pages" className="btn btn-secondary">
                    📚 문서 목록
                </Link>
            </div>
        </div>
    );
}

export default NotFound;
