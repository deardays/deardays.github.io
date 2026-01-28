/**
 * Site Configuration - 사이트 설정
 * 
 * 이 파일에서 모든 사이트 메타데이터를 관리합니다.
 * TODO 표시된 항목들을 실제 값으로 교체해주세요.
 */

const SITE_CONFIG = {
  // ============================================
  // Google Analytics 4
  // ============================================
  ga4MeasurementId: 'G-XXXXXXXXXX', // TODO: GA4 측정 ID 입력

  // ============================================
  // KakaoTalk 오픈채팅
  // ============================================
  kakaoTalkUrl: 'https://open.kakao.com/o/XXXXXXXXX', // TODO: 오픈채팅 URL 입력

  // ============================================
  // 사업자 정보 (법적 필수 정보)
  // ============================================
  businessInfo: {
    companyName: '디어데이즈', // TODO: 회사명
    companyNameEn: 'Deardays', // TODO: 영문 회사명
    ceo: '홍길동', // TODO: 대표자명
    ceoEn: 'Hong Gildong', // TODO: 영문 대표자명
    businessNumber: '000-00-00000', // TODO: 사업자등록번호
    address: '서울특별시 강남구 테헤란로 123', // TODO: 사업장 주소
    addressEn: '123 Teheran-ro, Gangnam-gu, Seoul, Korea', // TODO: 영문 주소
    phone: '02-0000-0000', // TODO: 대표 전화번호
    email: 'contact@deardays.co.kr', // TODO: 대표 이메일
  },

  // ============================================
  // 통계 데이터
  // ============================================
  stats: {
    influencerCount: 300, // 협업 인플루언서 수
    brandCount: 50, // 협업 브랜드 수 (선택)
    campaignCount: 100, // 진행 캠페인 수 (선택)
    satisfactionRate: 98, // 만족도 % (선택)
  },

  // ============================================
  // 브랜드 컬러
  // ============================================
  colors: {
    primary: '#1e3a5f', // Navy - 메인 컬러
    secondary: '#2563eb', // Blue - 보조 컬러
    accent: '#0ea5e9', // Light Blue - 강조 컬러
    dark: '#0f172a', // Dark Navy - 진한 배경
    light: '#f8fafc', // Off White - 밝은 배경
  },

  // ============================================
  // 포트폴리오 케이스 스터디
  // ============================================
  portfolio: [
    {
      id: 1,
      titleKo: '뷰티 브랜드 A사',
      titleEn: 'Beauty Brand A',
      resultKo: '인지도 제로에서 5차 공구 완판',
      resultEn: 'From zero awareness to 5th group buy sold out',
      metricKo: '5차 완판',
      metricEn: '5x Sold Out',
      category: 'beauty',
    },
    {
      id: 2,
      titleKo: '식품 브랜드 B사',
      titleEn: 'Food Brand B',
      resultKo: '론칭 6시간 만에 전량 소진',
      resultEn: 'Sold out in 6 hours after launch',
      metricKo: '6시간 완판',
      metricEn: '6hr Sellout',
      category: 'food',
    },
    {
      id: 3,
      titleKo: '라이프스타일 브랜드 C사',
      titleEn: 'Lifestyle Brand C',
      resultKo: '신규 고객 유입 300% 증가',
      resultEn: '300% increase in new customers',
      metricKo: '+300%',
      metricEn: '+300%',
      category: 'lifestyle',
    },
  ],

  // ============================================
  // 서비스 목록
  // ============================================
  services: [
    {
      id: 1,
      iconClass: 'fas fa-users', // Font Awesome icon (optional)
      titleKo: '인플루언서 매칭',
      titleEn: 'Influencer Matching',
      descKo: '브랜드에 최적화된 인플루언서를 데이터 기반으로 매칭합니다.',
      descEn: 'Data-driven matching with influencers optimized for your brand.',
    },
    {
      id: 2,
      iconClass: 'fas fa-chart-line',
      titleKo: '캠페인 기획',
      titleEn: 'Campaign Planning',
      descKo: '목표 달성을 위한 전략적 캠페인을 기획하고 실행합니다.',
      descEn: 'Strategic campaign planning and execution for your goals.',
    },
    {
      id: 3,
      iconClass: 'fas fa-bullhorn',
      titleKo: '콘텐츠 제작',
      titleEn: 'Content Creation',
      descKo: '브랜드 아이덴티티에 맞는 고품질 콘텐츠를 제작합니다.',
      descEn: 'High-quality content creation aligned with brand identity.',
    },
    {
      id: 4,
      iconClass: 'fas fa-analytics',
      titleKo: '성과 분석',
      titleEn: 'Performance Analysis',
      descKo: '실시간 데이터 분석으로 캠페인 효과를 극대화합니다.',
      descEn: 'Maximize campaign effectiveness with real-time data analysis.',
    },
  ],

  // ============================================
  // 차별화 포인트 (Pink Penguin - Selection Criteria)
  // ============================================
  differentiators: [
    {
      id: 1,
      titleKo: '검증된 인플루언서 네트워크',
      titleEn: 'Verified Influencer Network',
      descKo: '300명 이상의 검증된 인플루언서와 직접 협업합니다.',
      descEn: 'Direct collaboration with 300+ verified influencers.',
    },
    {
      id: 2,
      titleKo: '데이터 기반 의사결정',
      titleEn: 'Data-Driven Decisions',
      descKo: '감이 아닌 데이터로 최적의 인플루언서를 매칭합니다.',
      descEn: 'Optimal matching based on data, not guesswork.',
    },
    {
      id: 3,
      titleKo: '원스톱 캠페인 관리',
      titleEn: 'One-Stop Campaign Management',
      descKo: '기획부터 분석까지 모든 과정을 한 번에 관리합니다.',
      descEn: 'End-to-end management from planning to analysis.',
    },
    {
      id: 4,
      titleKo: '성과 보장 시스템',
      titleEn: 'Performance Guarantee',
      descKo: 'KPI 달성률 98% 이상의 검증된 성과를 제공합니다.',
      descEn: 'Proven results with 98%+ KPI achievement rate.',
    },
  ],

  // ============================================
  // SEO & Open Graph
  // ============================================
  seo: {
    titleKo: '디어데이즈 - 브랜드 성장을 위한 인플루언서 마케팅',
    titleEn: 'Deardays - Influencer Marketing for Brand Growth',
    descriptionKo: '300명 이상의 검증된 인플루언서와 함께 브랜드 성장을 이끌어드립니다. 데이터 기반 매칭, 성과 보장 시스템.',
    descriptionEn: 'Drive brand growth with 300+ verified influencers. Data-driven matching and performance guarantee system.',
    keywords: '인플루언서 마케팅, 브랜드 마케팅, 공구, SNS 마케팅, influencer marketing, brand marketing',
    ogImage: 'https://deardays.co.kr/assets/og-image.jpg', // TODO: OG 이미지 URL
  },
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SITE_CONFIG;
}
