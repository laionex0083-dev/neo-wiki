import express from 'express';
import { dbHelper } from '../database/init.js';

const router = express.Router();

/**
 * 사용 가능한 스킨 목록
 */
router.get('/', (req, res) => {
    try {
        const skinSettings = dbHelper.prepare('SELECT * FROM skin_settings').all();

        const defaultSkins = [
            {
                name: 'default',
                display_name: '기본 스킨',
                description: '깔끔한 기본 스킨',
                is_active: true
            },
            {
                name: 'dark',
                display_name: '다크 모드',
                description: '어두운 배경의 스킨'
            },
            {
                name: 'rdl',
                display_name: '066 Test Squadron',
                description: '와인/버건디 톤의 클래식한 테마'
            },
            {
                name: 'rdl-dark',
                display_name: 'RDL 다크',
                description: '와인/버건디 톤의 다크 모드'
            },
            {
                name: '303-corsair',
                display_name: '303 Corsair',
                description: '군사/항공 테마의 청록+라임 다크 모드'
            }
        ];

        const skins = defaultSkins.map(skin => {
            const dbSkin = skinSettings.find(s => s.skin_name === skin.name);
            return {
                ...skin,
                is_active: dbSkin?.is_active || skin.is_active,
                custom_css: dbSkin?.custom_css || ''
            };
        });

        res.json({ skins });
    } catch (error) {
        console.error('Error fetching skins:', error);
        res.status(500).json({ error: '스킨 목록을 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 현재 활성화된 스킨
 */
router.get('/active', (req, res) => {
    try {
        const setting = dbHelper.prepare(
            "SELECT value FROM wiki_settings WHERE key = 'default_skin'"
        ).get();

        res.json({ skin: setting?.value || 'default' });
    } catch (error) {
        console.error('Error fetching active skin:', error);
        res.status(500).json({ error: '활성 스킨을 가져오는 중 오류가 발생했습니다.' });
    }
});

/**
 * 스킨 활성화
 */
router.post('/:name/activate', (req, res) => {
    try {
        const { name } = req.params;

        // 모든 스킨 비활성화
        dbHelper.prepare('UPDATE skin_settings SET is_active = 0').run();

        // 선택한 스킨 활성화 (있으면 업데이트, 없으면 삽입)
        const existing = dbHelper.prepare('SELECT id FROM skin_settings WHERE skin_name = ?').get(name);
        if (existing) {
            dbHelper.prepare('UPDATE skin_settings SET is_active = 1 WHERE skin_name = ?').run(name);
        } else {
            dbHelper.prepare('INSERT INTO skin_settings (skin_name, is_active) VALUES (?, 1)').run(name);
        }

        // 위키 설정 업데이트
        dbHelper.prepare(
            "UPDATE wiki_settings SET value = ?, updated_at = datetime('now') WHERE key = 'default_skin'"
        ).run(name);

        res.json({ success: true, message: `${name} 스킨이 활성화되었습니다.` });
    } catch (error) {
        console.error('Error activating skin:', error);
        res.status(500).json({ error: '스킨 활성화 중 오류가 발생했습니다.' });
    }
});

export default router;
