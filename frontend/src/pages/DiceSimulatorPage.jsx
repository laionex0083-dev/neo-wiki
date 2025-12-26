import DiceSimulator from '../components/DiceSimulator';

function DiceSimulatorPage() {
    return (
        <div className="wiki-page">
            <div className="wiki-page-header">
                <h1 className="wiki-page-title">🎲 주사위 시뮬레이터</h1>
            </div>

            <div className="wiki-page-content">
                <p style={{ marginBottom: '1.5rem', color: 'var(--color-text-muted)' }}>
                    <strong>Obsidian Protocol</strong> 전투 시스템의 공격/방어 확률을 계산하는 시뮬레이터입니다.
                    주사위 개수와 옵션을 설정하면 공격 성공 확률이 자동으로 계산됩니다.
                </p>

                <DiceSimulator />

                <div style={{
                    marginTop: '2rem',
                    padding: '1rem',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem'
                }}>
                    <h3 style={{ marginBottom: '0.75rem', color: 'var(--color-primary)' }}>📖 사용 방법</h3>
                    <ul style={{ lineHeight: '1.8', color: 'var(--color-text-muted)' }}>
                        <li><strong>공격 주사위:</strong> Yellow(약공격), Red(강공격) 주사위 개수를 설정합니다.</li>
                        <li><strong>방어 주사위:</strong> White(방어), Blue(회피) 주사위 개수를 설정합니다.</li>
                        <li><strong>옵션:</strong> 공격/방어 스탠스, 리롤, 특수 무기 효과 등을 활성화할 수 있습니다.</li>
                        <li><strong>결과:</strong> 설정에 따라 공격이 방어를 뚫을 확률이 자동 계산됩니다.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default DiceSimulatorPage;
