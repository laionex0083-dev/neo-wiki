# Neo-Wiki 🌳

**Namulike 문법을 지원하는 현대적인 위키 엔진**

Neo-Wiki는 나무위키 스타일의 문법을 완벽하게 지원하면서도 현대적인 UI/UX를 제공하는 위키 엔진입니다. React + Express.js 기반으로 제작되어 빠른 속도와 반응형 디자인을 자랑합니다.

## ✨ 주요 기능

### 📝 문서 관리
- **Namulike 파서**: `[[링크]]`, `{{{문법}}}`, 각주 등 나무위키 전용 문법 완벽 지원
- **실시간 미리보기**: 편집 중 실시간으로 렌더링 결과 확인
- **문서 히스토리**: 모든 편집 내역 저장 및 리비전 비교
- **역링크**: 해당 문서를 참조하는 모든 문서 목록 조회
- **리다이렉트**: `#redirect '문서명'` 문법으로 문서 리다이렉트 설정
- **템플릿(틀)**: `[include(틀:템플릿명)]` 문법으로 템플릿 삽입

### 🎨 테마 및 UI
- **다양한 스킨**: 기본, 다크, RDL, RDL-Dark, 303 Corsair 등 다양한 테마
- **반응형 디자인**: 모바일/태블릿/데스크톱 최적화
- **모바일 하단 네비게이션**: 768px 이하에서 하단 탭 바 자동 표시
- **모바일 검색 바**: 헤더 아래 고정 검색창
- **플로팅 스크롤 버튼**: 맨 위/맨 아래 이동 버튼

### 🔐 사용자 관리
- **회원가입/로그인**: JWT 기반 인증 시스템
- **역할 기반 권한**: 일반/관리자/오너 권한 분리
- **IP 차단**: 관리자가 특정 IP 차단 가능
- **Rate Limiting**: API 요청 제한으로 서버 보호

### 🛠️ 도구
- **🎲 주사위 시뮬레이터**: Obsidian Protocol 전투 시뮬레이터 내장
- **📋 로스터 빌더**: 외부 로스터 빌더 링크
- **🤖 AmadeusEmber**: 외부 도구 링크
- **파일 업로드**: 드래그 앤 드롭 이미지 업로드
- **자동완성 검색**: 문서 제목 실시간 자동완성

### 📂 분류 시스템
- **분류 태그**: `[[분류:카테고리명]]` 문법으로 분류 지정
- **분류 페이지**: 분류별 문서 목록 자동 생성

## 🔧 기술 스택

### Backend
- **Node.js + Express.js**: REST API 서버
- **SQLite (sql.js)**: 경량 데이터베이스 (네이티브 빌드 불필요!)
- **JWT**: 사용자 인증
- **Multer**: 파일 업로드 처리
- **Helmet + Rate Limiting**: 보안 강화

### Frontend  
- **React 18 + Vite**: 빠른 SPA
- **React Router v6**: 클라이언트 라우팅
- **Lucide React**: 아이콘 라이브러리
- **Vanilla CSS**: 커스텀 스킨 시스템

### 지원 플랫폼
- ✅ Windows
- ✅ macOS  
- ✅ Linux
- ✅ **라즈베리 파이** (ARM32/ARM64)

## 📁 프로젝트 구조

```
neo-wiki/
├── backend/                    # Express.js API 서버
│   ├── src/
│   │   ├── routes/            # API 라우트
│   │   │   ├── pages.js       # 문서 CRUD + 리다이렉트
│   │   │   ├── users.js       # 사용자 관리
│   │   │   ├── skins.js       # 스킨 관리
│   │   │   └── upload.js      # 이미지 업로드
│   │   ├── parser/            # Namulike 파서
│   │   │   └── namulike.js    # 핵심 파서 엔진
│   │   ├── database/          # 데이터베이스
│   │   └── app.js             # Express 앱
│   ├── uploads/               # 업로드된 파일
│   └── package.json
│
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── components/        # UI 컴포넌트
│   │   │   ├── Header.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── MobileBottomNav.jsx
│   │   │   ├── MobileSearchBar.jsx
│   │   │   ├── FloatingScrollButtons.jsx
│   │   │   └── DiceSimulator.jsx
│   │   ├── pages/             # 페이지 컴포넌트
│   │   │   ├── PageView.jsx   # 문서 보기
│   │   │   ├── PageEdit.jsx   # 문서 편집
│   │   │   ├── DiceSimulatorPage.jsx
│   │   │   └── AdminPage.jsx
│   │   └── App.jsx
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

## 🚀 빠른 시작

```bash
# 1. 의존성 설치
cd backend && npm install
cd ../frontend && npm install

# 2. 백엔드 서버 시작 (포트 3001)
cd backend && npm run dev

# 3. 프론트엔드 시작 (포트 5173)
cd frontend && npm run dev
```

브라우저에서 `http://localhost:5173` 접속

## 📖 Namulike 문법

### 기본 서식
| 문법 | 설명 | 예시 |
|------|------|------|
| `[[문서명]]` | 내부 링크 | `[[대문]]` |
| `[[문서명\|표시]]` | 링크 표시문구 | `[[나무위키\|위키]]` |
| `'''굵게'''` | 굵은 글씨 | `'''강조'''` |
| `''기울임''` | 기울인 글씨 | `''이탤릭''` |
| `~~취소~~` | 취소선 | `~~삭제~~` |
| `__밑줄__` | 밑줄 | `__강조__` |

### 블록 문법
| 문법 | 설명 | 예시 |
|------|------|------|
| `{{{코드}}}` | 인라인 코드 | `{{{inline}}}` |
| `{{{#!syntax 언어}}}` | 코드 블록 | 여러 줄 코드 |
| `{{{#!folding 제목}}}` | 접기/펼치기 | 콘텐츠 접기 |
| `= 제목 =` | 제목 (1~6) | `== 소제목 ==` |
| `> 인용` | 인용문 | `> 인용글` |
| `----` | 수평선 | `----` |

### 목록
| 문법 | 설명 |
|------|------|
| ` * 항목` | 글머리 기호 목록 |
| ` 1. 항목` | 번호 목록 |
| ` * 항목` | 들여쓰기로 중첩 가능 |

### 특수 문법
| 문법 | 설명 |
|------|------|
| `[* 각주]` | 각주 |
| `[include(틀:이름)]` | 템플릿 삽입 |
| `[[분류:이름]]` | 분류 태그 |
| `#redirect '문서명'` | 리다이렉트 |
| `[youtube(동영상ID)]` | YouTube 삽입 |
| `[br]` | 줄바꿈 |

## 📱 반응형 레이아웃

### 데스크톱 (1024px 이상)
- 좌측 사이드바 표시
- 헤더에 전체 검색창
- 우측 하단 플로팅 버튼

### 모바일 (768px 이하)
- 사이드바 숨김
- 헤더 아래 검색 바 고정
- 하단 네비게이션 바 (대문/최근/문서/도구/설정)
- 우측 하단 플로팅 버튼

## 🍓 라즈베리 파이 배포

```bash
# 자동 설치 (권장)
chmod +x install.sh
./install.sh

# 또는 수동 설치
cd backend && npm install --production
cd ../frontend && npm install && npm run build

# 프로덕션 실행
npm run start:prod
```

자세한 내용은 [라즈베리 파이 배포 가이드](docs/RASPBERRY_PI.md)를 참조하세요.

## 🐳 Docker 배포

```bash
docker-compose up -d
```

## 📄 라이선스

MIT License

---

**Neo-Wiki** - 현대적인 위키 엔진 🌳
