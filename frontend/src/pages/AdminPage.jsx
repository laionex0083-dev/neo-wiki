import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/dateUtils';

function AdminPage() {
    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const navigate = useNavigate();

    // 권한 변경 모달 상태
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [newRole, setNewRole] = useState('');

    // 차단 모달 상태
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [blockReason, setBlockReason] = useState('');
    const [blockDuration, setBlockDuration] = useState('');

    // 차단 해제 모달 상태
    const [showUnblockModal, setShowUnblockModal] = useState(false);

    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        if (currentUser) {
            if (activeTab === 'users') {
                fetchUsers();
            } else if (activeTab === 'logs') {
                fetchLogs();
            }
        }
    }, [activeTab, currentUser]);

    const checkAuth = async () => {
        const token = localStorage.getItem('wiki_token');
        if (!token) {
            navigate('/');
            return;
        }

        try {
            const res = await fetch('/api/users/me', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                navigate('/');
                return;
            }

            const data = await res.json();

            if (!['admin', 'owner'].includes(data.user.role)) {
                setError('관리자 권한이 필요합니다.');
                return;
            }

            setCurrentUser(data.user);
        } catch (err) {
            console.error('Auth check failed:', err);
            navigate('/');
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('wiki_token');
            const res = await fetch('/api/users/admin/users', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                throw new Error('사용자 목록을 불러올 수 없습니다.');
            }

            const data = await res.json();
            setUsers(data.users || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('wiki_token');
            const res = await fetch('/api/users/admin/logs', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                throw new Error('로그를 불러올 수 없습니다.');
            }

            const data = await res.json();
            setLogs(data.logs || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // 권한 변경 모달 열기
    const openRoleModal = (user) => {
        setSelectedUser(user);
        setNewRole(user.role);
        setShowRoleModal(true);
    };

    // 권한 변경 실행
    const handleRoleChange = async () => {
        if (!selectedUser || !newRole) return;

        try {
            const token = localStorage.getItem('wiki_token');
            const res = await fetch(`/api/users/admin/users/${selectedUser.id}/role`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ role: newRole })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '권한 변경에 실패했습니다.');
            }

            setMessage({ type: 'success', text: `${selectedUser.username}의 권한이 '${getRoleDisplayName(newRole)}'으로 변경되었습니다.` });
            setShowRoleModal(false);
            setSelectedUser(null);
            fetchUsers();
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    // 차단 모달 열기
    const openBlockModal = (user) => {
        setSelectedUser(user);
        setBlockReason('');
        setBlockDuration('');
        setShowBlockModal(true);
    };

    // 차단 실행
    const handleBlock = async () => {
        if (!selectedUser) return;

        try {
            const token = localStorage.getItem('wiki_token');
            const duration = blockDuration ? parseInt(blockDuration) : null;

            const res = await fetch(`/api/users/admin/users/${selectedUser.id}/block`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    reason: blockReason || '규정 위반',
                    duration
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '차단에 실패했습니다.');
            }

            setMessage({ type: 'success', text: `${selectedUser.username}이(가) 차단되었습니다.` });
            setShowBlockModal(false);
            setSelectedUser(null);
            fetchUsers();
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    // 차단 해제 모달 열기
    const openUnblockModal = (user) => {
        setSelectedUser(user);
        setShowUnblockModal(true);
    };

    // 차단 해제 실행
    const handleUnblock = async () => {
        if (!selectedUser) return;

        try {
            const token = localStorage.getItem('wiki_token');
            const res = await fetch(`/api/users/admin/users/${selectedUser.id}/unblock`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || '차단 해제에 실패했습니다.');
            }

            setMessage({ type: 'success', text: `${selectedUser.username}의 차단이 해제되었습니다.` });
            setShowUnblockModal(false);
            setSelectedUser(null);
            fetchUsers();
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        }
    };

    const getRoleDisplayName = (role) => {
        const names = {
            blocked: '🚫 차단됨',
            guest: '👤 게스트',
            user: '👤 일반 사용자',
            verified: '✓ 인증된 사용자',
            moderator: '🛡️ 모더레이터',
            admin: '⚙️ 관리자',
            owner: '👑 오너'
        };
        return names[role] || role;
    };

    const getRoleBadgeColor = (role) => {
        const colors = {
            blocked: '#dc3545',
            guest: '#6c757d',
            user: '#20c997',
            verified: '#17a2b8',
            moderator: '#fd7e14',
            admin: '#6f42c1',
            owner: '#ffc107'
        };
        return colors[role] || '#6c757d';
    };



    const getActionDisplayName = (action) => {
        const actions = {
            change_role: '권한 변경',
            block_user: '사용자 차단',
            unblock_user: '차단 해제',
            protect_page: '문서 보호',
            unprotect_page: '문서 보호 해제'
        };
        return actions[action] || action;
    };

    if (error && !currentUser) {
        return (
            <div className="wiki-page">
                <div className="alert alert-error">{error}</div>
                <Link to="/" className="btn btn-secondary">메인으로 돌아가기</Link>
            </div>
        );
    }

    return (
        <div className="wiki-page">
            <div className="wiki-page-header">
                <h1 className="wiki-page-title">🔧 관리자 페이지</h1>
            </div>

            {message && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}
                    style={{ marginBottom: '1rem' }}>
                    {message.text}
                    <button
                        onClick={() => setMessage(null)}
                        style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}
                    >✕</button>
                </div>
            )}

            {/* 권한 변경 모달 */}
            {showRoleModal && selectedUser && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: '#ffffff',
                        padding: '2rem',
                        borderRadius: 'var(--radius-lg)',
                        maxWidth: '400px',
                        width: '90%',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                        color: '#1a1a1a'
                    }}>
                        <h3 style={{ marginTop: 0 }}>권한 변경</h3>
                        <p style={{ marginBottom: '1rem' }}>
                            <strong>{selectedUser.username}</strong>의 권한을 변경합니다.
                        </p>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>새 권한:</label>
                            <select
                                value={newRole}
                                onChange={(e) => setNewRole(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc'
                                }}
                            >
                                <option value="user">일반 사용자</option>
                                <option value="verified">인증된 사용자</option>
                                <option value="moderator">모더레이터</option>
                                <option value="admin">관리자</option>
                                {currentUser?.role === 'owner' && (
                                    <option value="owner">오너</option>
                                )}
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowRoleModal(false)}
                            >
                                취소
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleRoleChange}
                                disabled={newRole === selectedUser.role}
                            >
                                변경
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 차단 모달 */}
            {showBlockModal && selectedUser && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: '#ffffff',
                        padding: '2rem',
                        borderRadius: 'var(--radius-lg)',
                        maxWidth: '400px',
                        width: '90%',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                        color: '#1a1a1a'
                    }}>
                        <h3 style={{ marginTop: 0, color: 'var(--color-danger)' }}>🚫 사용자 차단</h3>
                        <p style={{ marginBottom: '1rem' }}>
                            <strong>{selectedUser.username}</strong>을(를) 차단합니다.
                        </p>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>차단 사유:</label>
                            <input
                                type="text"
                                value={blockReason}
                                onChange={(e) => setBlockReason(e.target.value)}
                                placeholder="규정 위반"
                                style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc'
                                }}
                            />
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>차단 기간 (분):</label>
                            <input
                                type="number"
                                value={blockDuration}
                                onChange={(e) => setBlockDuration(e.target.value)}
                                placeholder="비워두면 무기한"
                                style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowBlockModal(false)}
                            >
                                취소
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={handleBlock}
                            >
                                차단
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 차단 해제 모달 */}
            {showUnblockModal && selectedUser && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: '#ffffff',
                        padding: '2rem',
                        borderRadius: 'var(--radius-lg)',
                        maxWidth: '400px',
                        width: '90%',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                        color: '#1a1a1a'
                    }}>
                        <h3 style={{ marginTop: 0 }}>차단 해제</h3>
                        <p style={{ marginBottom: '1.5rem' }}>
                            <strong>{selectedUser.username}</strong>의 차단을 해제하시겠습니까?
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowUnblockModal(false)}
                            >
                                취소
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleUnblock}
                            >
                                해제
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 탭 네비게이션 */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1.5rem',
                borderBottom: '2px solid var(--color-border)'
            }}>
                {[
                    { id: 'users', label: '👥 사용자 관리' },
                    { id: 'logs', label: '📋 관리 로그' },
                    { id: 'protection', label: '🔒 문서 보호' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '0.75rem 1.25rem',
                            border: 'none',
                            background: activeTab === tab.id ? 'var(--color-accent)' : 'transparent',
                            color: activeTab === tab.id ? 'white' : 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            fontWeight: 500,
                            borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                            marginBottom: '-2px',
                            borderBottom: activeTab === tab.id ? '2px solid var(--color-accent)' : 'none'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="loading">
                    <div className="loading-spinner"></div>
                </div>
            ) : (
                <>
                    {/* 사용자 관리 탭 */}
                    {activeTab === 'users' && (
                        <div>
                            <p style={{ marginBottom: '1rem', color: 'var(--color-text-muted)' }}>
                                총 {users.length}명의 사용자가 있습니다.
                            </p>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--color-bg-secondary)' }}>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>ID</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>사용자명</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>권한</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>가입일</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>편집 수</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>상태</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--color-border)' }}>관리</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(user => (
                                            <tr key={user.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                                <td style={{ padding: '0.75rem' }}>{user.id}</td>
                                                <td style={{ padding: '0.75rem', fontWeight: 500 }}>{user.username}</td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '0.25rem 0.5rem',
                                                        background: getRoleBadgeColor(user.role),
                                                        color: 'white',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem'
                                                    }}>
                                                        {getRoleDisplayName(user.role)}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                                                    {formatDate(user.created_at)}
                                                </td>
                                                <td style={{ padding: '0.75rem' }}>{user.edit_count || 0}</td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    {user.is_blocked ? (
                                                        <span style={{ color: 'var(--color-danger)' }}>🚫 차단됨</span>
                                                    ) : (
                                                        <span style={{ color: 'var(--color-success)' }}>✓ 정상</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                    {user.id !== currentUser?.id && (
                                                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                                            <button
                                                                className="btn btn-outline"
                                                                onClick={() => openRoleModal(user)}
                                                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                                                disabled={user.role === 'owner' && currentUser?.role !== 'owner'}
                                                            >
                                                                권한
                                                            </button>
                                                            {user.is_blocked ? (
                                                                <button
                                                                    onClick={() => openUnblockModal(user)}
                                                                    className="btn btn-outline"
                                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                                                >
                                                                    해제
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => openBlockModal(user)}
                                                                    className="btn btn-danger"
                                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                                                                >
                                                                    차단
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 관리 로그 탭 */}
                    {activeTab === 'logs' && (
                        <div>
                            <p style={{ marginBottom: '1rem', color: 'var(--color-text-muted)' }}>
                                최근 관리 활동 기록입니다.
                            </p>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--color-bg-secondary)' }}>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>시간</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>관리자</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>작업</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>대상</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>세부정보</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                                    관리 로그가 없습니다.
                                                </td>
                                            </tr>
                                        ) : logs.map(log => (
                                            <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                                <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                                                    {formatDate(log.created_at)}
                                                </td>
                                                <td style={{ padding: '0.75rem', fontWeight: 500 }}>
                                                    {log.admin_username || `ID:${log.admin_id}`}
                                                </td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    {getActionDisplayName(log.action)}
                                                </td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    {log.target_type}: {log.target_id}
                                                </td>
                                                <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                                    {log.details}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 문서 보호 탭 */}
                    {activeTab === 'protection' && (
                        <div>
                            <p style={{ marginBottom: '1rem', color: 'var(--color-text-muted)' }}>
                                문서 보호 설정입니다. 개별 문서 편집 페이지에서 보호 설정을 변경할 수 있습니다.
                            </p>
                            <div style={{
                                background: 'var(--color-bg-secondary)',
                                padding: '1.5rem',
                                borderRadius: 'var(--radius-md)',
                                textAlign: 'center'
                            }}>
                                <p>🔒 문서 보호 기능은 해당 문서의 편집 페이지에서 설정할 수 있습니다.</p>
                                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                                    보호된 문서는 지정된 권한 이상의 사용자만 편집할 수 있습니다.
                                </p>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default AdminPage;
