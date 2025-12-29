import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function SettingsPage() {
    const [activeSkin, setActiveSkin] = useState('default');
    const [availableSkins, setAvailableSkins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        fetchSkins();
    }, []);

    const fetchSkins = async () => {
        setLoading(true);
        try {
            // 사용 가능한 스킨 목록
            const skinsRes = await fetch('/api/skins');
            const skinsData = await skinsRes.json();
            setAvailableSkins(skinsData.skins || []);

            // 현재 활성화된 스킨 (localStorage 우선, 없으면 서버 기본값)
            const savedSkin = localStorage.getItem('wiki_skin');
            if (savedSkin) {
                setActiveSkin(savedSkin);
            } else {
                const activeRes = await fetch('/api/skins/active');
                const activeData = await activeRes.json();
                setActiveSkin(activeData.skin || 'default');
            }
        } catch (err) {
            console.error('Error fetching skins:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSkinChange = (skinName) => {
        setSaving(true);
        setMessage(null);

        try {
            // localStorage에 스킨 설정 저장 (브라우저별 개별 설정)
            localStorage.setItem('wiki_skin', skinName);
            setActiveSkin(skinName);
            setMessage({ type: 'success', text: `'${getSkinDisplayName(skinName)}' 스킨이 적용되었습니다. 페이지를 새로고침하세요.` });

            // 1.5초 후 자동 새로고침
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (err) {
            setMessage({ type: 'error', text: '스킨 변경 중 오류가 발생했습니다.' });
        } finally {
            setSaving(false);
        }
    };

    const getSkinDisplayName = (skinName) => {
        const names = {
            'default': '기본 (Default)',
            'dark': '다크 모드 (Dark)',
            'rdl': '066 Test Squadron',
            'rdl-dark': 'RDL 다크',
            '303-corsair': '303 Corsair'
        };
        return names[skinName] || skinName;
    };

    const getSkinDescription = (skinName) => {
        const descriptions = {
            'default': '밝고 깔끔한 기본 테마',
            'dark': '눈이 편안한 다크 테마',
            'rdl': '와인/버건디 톤의 클래식하고 고급스러운 테마',
            'rdl-dark': '와인/버건디 톤의 다크 모드',
            '303-corsair': '군사/항공 테마의 청록+라임 다크 모드'
        };
        return descriptions[skinName] || '';
    };

    const getSkinPreviewColor = (skinName) => {
        const colors = {
            'default': { bg: '#ffffff', accent: '#4a9eff', text: '#1a1a1a' },
            'dark': { bg: '#1a1a2e', accent: '#00d4ff', text: '#e0e0e0' },
            'rdl': { bg: '#FDFBF7', accent: '#8D2529', text: '#424546' },
            'rdl-dark': { bg: '#1E1A1B', accent: '#C94A4E', text: '#F0EDEB' },
            '303-corsair': { bg: '#424546', accent: '#008dc9', text: '#D6DADD' }
        };
        return colors[skinName] || colors.default;
    };

    if (loading) {
        return (
            <div className="wiki-page">
                <div className="loading">
                    <div className="loading-spinner"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="wiki-page">
            <div className="wiki-page-header">
                <h1 className="wiki-page-title">⚙️ 설정</h1>
            </div>

            {message && (
                <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                    {message.text}
                </div>
            )}

            {/* 스킨 설정 섹션 */}
            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🎨 스킨 설정
                </h2>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    위키의 외관을 변경할 수 있습니다. 스킨을 선택하면 자동으로 적용됩니다.
                </p>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '1rem'
                }}>
                    {availableSkins.map((skin) => {
                        const isActive = skin.name === activeSkin;
                        const colors = getSkinPreviewColor(skin.name);

                        return (
                            <div
                                key={skin.name}
                                style={{
                                    border: isActive ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-lg)',
                                    overflow: 'hidden',
                                    background: 'var(--color-bg-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    opacity: saving ? 0.6 : 1
                                }}
                                onClick={() => !saving && handleSkinChange(skin.name)}
                            >
                                {/* 스킨 미리보기 */}
                                <div style={{
                                    height: '80px',
                                    background: colors.bg,
                                    padding: '1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.5rem'
                                }}>
                                    <div style={{
                                        height: '8px',
                                        width: '60%',
                                        background: colors.accent,
                                        borderRadius: '4px'
                                    }} />
                                    <div style={{
                                        height: '6px',
                                        width: '80%',
                                        background: colors.text,
                                        opacity: 0.3,
                                        borderRadius: '3px'
                                    }} />
                                    <div style={{
                                        height: '6px',
                                        width: '50%',
                                        background: colors.text,
                                        opacity: 0.2,
                                        borderRadius: '3px'
                                    }} />
                                </div>

                                {/* 스킨 정보 */}
                                <div style={{ padding: '1rem' }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: '0.5rem'
                                    }}>
                                        <h4 style={{ margin: 0 }}>
                                            {getSkinDisplayName(skin.name)}
                                        </h4>
                                        {isActive && (
                                            <span style={{
                                                padding: '0.2rem 0.5rem',
                                                background: 'var(--color-accent)',
                                                color: 'white',
                                                borderRadius: '4px',
                                                fontSize: '0.7rem',
                                                fontWeight: 600
                                            }}>
                                                ✓ 사용 중
                                            </span>
                                        )}
                                    </div>
                                    <p style={{
                                        margin: 0,
                                        fontSize: '0.8rem',
                                        color: 'var(--color-text-muted)'
                                    }}>
                                        {getSkinDescription(skin.name)}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* 기타 설정 섹션 (향후 확장 가능) */}
            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    ℹ️ 정보
                </h2>
                <div style={{
                    background: 'var(--color-bg-secondary)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.9rem'
                }}>
                    <p style={{ margin: '0 0 0.5rem 0' }}>
                        <strong>Neo-Wiki</strong> - NamuMark 기반 위키 엔진
                    </p>
                    <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
                        Node.js + React로 구축된 경량 위키 시스템
                    </p>
                </div>
            </section>
        </div>
    );
}

export default SettingsPage;
