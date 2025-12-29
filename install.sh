#!/bin/bash
# Neo-Wiki 라즈베리 파이 설치 스크립트
# 실행: chmod +x install.sh && ./install.sh

set -e

echo "🌳 Neo-Wiki 라즈베리 파이 설치 스크립트"
echo "========================================"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 현재 디렉토리 저장
INSTALL_DIR=$(pwd)

# 루트 권한 확인
check_root() {
    if [ "$EUID" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  루트 권한으로 실행 중입니다. 일반 사용자로 실행을 권장합니다.${NC}"
    fi
}

# Node.js 설치 확인 및 설치
install_nodejs() {
    echo ""
    echo "📦 Node.js 확인 중..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        echo -e "${GREEN}✓ Node.js가 이미 설치되어 있습니다: $NODE_VERSION${NC}"
    else
        echo "Node.js가 설치되어 있지 않습니다. 설치를 시작합니다..."
        
        # NodeSource 저장소 추가 (Node.js 20 LTS)
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
        
        echo -e "${GREEN}✓ Node.js 설치 완료${NC}"
    fi
    
    # npm 버전 확인
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ npm 버전: $NPM_VERSION${NC}"
}

# 시스템 의존성 설치
install_dependencies() {
    echo ""
    echo "📦 시스템 의존성 설치 중..."
    
    sudo apt-get update
    sudo apt-get install -y build-essential git
    
    echo -e "${GREEN}✓ 시스템 의존성 설치 완료${NC}"
}

# 백엔드 설치
install_backend() {
    echo ""
    echo "🔧 백엔드 설치 중..."
    
    cd "$INSTALL_DIR/backend"
    npm install --production
    
    # 데이터 및 업로드 디렉토리 생성
    mkdir -p data uploads
    
    echo -e "${GREEN}✓ 백엔드 설치 완료${NC}"
}

# 프론트엔드 빌드
build_frontend() {
    echo ""
    echo "🎨 프론트엔드 빌드 중..."
    
    cd "$INSTALL_DIR/frontend"
    npm install
    npm run build
    
    echo -e "${GREEN}✓ 프론트엔드 빌드 완료${NC}"
}

# systemd 서비스 설치
install_service() {
    echo ""
    echo "🔧 시스템 서비스 설치 중..."
    
    # 서비스 파일 생성
    sudo tee /etc/systemd/system/neo-wiki.service > /dev/null << EOF
[Unit]
Description=Neo-Wiki Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=$(which node) src/app.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=neo-wiki
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable neo-wiki
    
    echo -e "${GREEN}✓ 시스템 서비스 설치 완료${NC}"
}

# Nginx 설치 및 설정 (선택적)
install_nginx() {
    echo ""
    read -p "📡 Nginx를 설치하시겠습니까? (y/n): " install_nginx_choice
    
    if [ "$install_nginx_choice" = "y" ] || [ "$install_nginx_choice" = "Y" ]; then
        sudo apt-get install -y nginx
        
        # Nginx 설정 파일 생성
        sudo tee /etc/nginx/sites-available/neo-wiki > /dev/null << EOF
server {
    listen 80;
    server_name _;

    # 프론트엔드 정적 파일
    root $INSTALL_DIR/frontend/dist;
    index index.html;

    # API 프록시
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
    }

    # 업로드 파일 프록시
    location /uploads {
        proxy_pass http://127.0.0.1:3001;
    }

    # SPA 라우팅
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # 정적 파일 캐싱
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

        # 기본 사이트 비활성화 및 neo-wiki 활성화
        sudo rm -f /etc/nginx/sites-enabled/default
        sudo ln -sf /etc/nginx/sites-available/neo-wiki /etc/nginx/sites-enabled/
        
        sudo nginx -t
        sudo systemctl restart nginx
        sudo systemctl enable nginx
        
        echo -e "${GREEN}✓ Nginx 설치 및 설정 완료${NC}"
    fi
}

# 방화벽 설정
configure_firewall() {
    echo ""
    if command -v ufw &> /dev/null; then
        echo "🔒 방화벽 설정 중..."
        sudo ufw allow 80/tcp
        sudo ufw allow 3001/tcp
        echo -e "${GREEN}✓ 방화벽 설정 완료${NC}"
    fi
}

# 서비스 시작
start_service() {
    echo ""
    echo "🚀 Neo-Wiki 서비스 시작 중..."
    
    sudo systemctl start neo-wiki
    
    sleep 2
    
    if sudo systemctl is-active --quiet neo-wiki; then
        echo -e "${GREEN}✓ Neo-Wiki 서비스가 실행 중입니다!${NC}"
    else
        echo -e "${RED}✗ 서비스 시작 실패. 로그를 확인하세요:${NC}"
        echo "  sudo journalctl -u neo-wiki -f"
        exit 1
    fi
}

# IP 주소 표시
show_info() {
    echo ""
    echo "========================================"
    echo -e "${GREEN}🎉 Neo-Wiki 설치 완료!${NC}"
    echo "========================================"
    echo ""
    
    # IP 주소 가져오기
    IP_ADDR=$(hostname -I | awk '{print $1}')
    
    echo "📍 접속 주소:"
    if command -v nginx &> /dev/null && sudo systemctl is-active --quiet nginx; then
        echo "   http://$IP_ADDR"
    else
        echo "   http://$IP_ADDR:3001 (API)"
    fi
    echo ""
    echo "📝 유용한 명령어:"
    echo "   서비스 상태 확인: sudo systemctl status neo-wiki"
    echo "   서비스 재시작:    sudo systemctl restart neo-wiki"
    echo "   로그 확인:        sudo journalctl -u neo-wiki -f"
    echo ""
}

# 메인 실행
main() {
    check_root
    install_dependencies
    install_nodejs
    install_backend
    build_frontend
    install_service
    install_nginx
    configure_firewall
    start_service
    show_info
}

main
