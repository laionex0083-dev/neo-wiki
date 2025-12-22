# 라즈베리 파이 배포 가이드

이 문서는 Neo-Wiki를 라즈베리 파이 OS에 배포하는 방법을 안내합니다.

## 시스템 요구사항

| 항목 | 최소 사양 | 권장 사양 |
|-----|---------|---------|
| 라즈베리 파이 | Pi 3B+ | **Pi 5 (4GB+)** |
| OS | Raspberry Pi OS Lite (32-bit) | Raspberry Pi OS (64-bit) |
| 메모리 | 1GB | **4GB 이상 (8GB 권장)** |
| 저장공간 | 8GB | 32GB 이상 |
| Node.js | 18.x | 20.x LTS |

> 💡 **라즈베리 파이 5 8GB**를 사용하시면 메모리 제한 없이 충분한 성능으로 동작합니다!


## 빠른 설치 (자동)

```bash
# 1. 프로젝트 다운로드 (USB 또는 git clone)
cd /home/pi
git clone <your-repo-url> neo-wiki
cd neo-wiki

# 2. 설치 스크립트 실행
chmod +x install.sh
./install.sh
```

## 수동 설치

### 1. Node.js 설치

```bash
# Node.js 20 LTS 설치
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 버전 확인
node --version  # v20.x.x
npm --version   # 10.x.x
```

### 2. 프로젝트 다운로드

```bash
cd /home/pi
# USB에서 복사하거나 git clone
```

### 3. 백엔드 설치

```bash
cd neo-wiki/backend
npm install --production

# 데이터 디렉토리 생성
mkdir -p data uploads
```

### 4. 프론트엔드 빌드

```bash
cd ../frontend
npm install
npm run build
```

### 5. 테스트 실행

```bash
cd ../backend
node src/app.js
```

브라우저에서 `http://<라즈베리파이IP>:3001` 접속

### 6. 시스템 서비스 등록

```bash
sudo nano /etc/systemd/system/neo-wiki.service
```

다음 내용 입력:

```ini
[Unit]
Description=Neo-Wiki Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/neo-wiki/backend
ExecStart=/usr/bin/node src/app.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

서비스 활성화:

```bash
sudo systemctl daemon-reload
sudo systemctl enable neo-wiki
sudo systemctl start neo-wiki
```

### 7. Nginx 설정 (선택사항)

프론트엔드 정적 파일 제공 및 리버스 프록시:

```bash
sudo apt-get install nginx

sudo nano /etc/nginx/sites-available/neo-wiki
```

```nginx
server {
    listen 80;
    server_name _;

    root /home/pi/neo-wiki/frontend/dist;
    index index.html;

    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /uploads {
        proxy_pass http://127.0.0.1:3001;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/neo-wiki /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 성능 최적화

### 라즈베리 파이 5 (4GB/8GB)

4GB 이상의 메모리를 가진 라즈베리 파이 5에서는 **메모리 제한이 필요하지 않습니다**.
일반 프로덕션 모드로 실행하면 됩니다:

```bash
npm run start:prod
```

### 라즈베리 파이 3/4 (1GB~2GB)

메모리가 제한적인 경우 Node.js 힙 크기를 제한할 수 있습니다:

```bash
# /etc/systemd/system/neo-wiki.service에 추가
Environment=NODE_OPTIONS=--max-old-space-size=256
```

### 스왑 메모리 설정 (저메모리 환경)

```bash
# 스왑 크기 확인
free -h

# 스왑 파일 설정 변경 (필요시)
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# CONF_SWAPSIZE=1024 로 변경
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### SQLite 최적화

`backend/src/database/init.js`에서 이미 WAL 모드를 사용하고 있어 SD 카드 쓰기를 최소화합니다.

## 문제 해결

### 서비스 상태 확인

```bash
sudo systemctl status neo-wiki
```

### 로그 확인

```bash
# 실시간 로그
sudo journalctl -u neo-wiki -f

# 최근 100줄
sudo journalctl -u neo-wiki -n 100
```

### 포트 확인

```bash
sudo netstat -tlnp | grep 3001
```

### 재시작

```bash
sudo systemctl restart neo-wiki
```

## 백업

```bash
# 데이터베이스 백업
cp /home/pi/neo-wiki/backend/data/wiki.db /home/pi/backup/wiki_$(date +%Y%m%d).db

# 업로드 파일 백업
tar -czf /home/pi/backup/uploads_$(date +%Y%m%d).tar.gz /home/pi/neo-wiki/backend/uploads/
```

## 자동 백업 (cron)

```bash
crontab -e
```

매일 새벽 3시 백업:
```
0 3 * * * cp /home/pi/neo-wiki/backend/data/wiki.db /home/pi/backup/wiki_$(date +\%Y\%m\%d).db
```
