// 由舊站 profile.html / index.html 整理的初始內容，匯入後可由後台「網站內容」編輯。

export const SITE_PAGES: { key: string; title: string; content: unknown }[] = [
  {
    key: 'about',
    title: '關於 YAC',
    content: {
      lead: '台灣同業界有史以來唯一獲得「台灣精品獎」肯定推薦的傳動軸品牌。',
      sections: [
        {
          title: '台灣精品獎',
          body: [
            '1999 年台灣精品獎獲獎產品公佈，YAC 傳動軸產品以其世界一流品質的創新價值與高標準的競爭條件，獲得台灣傳動軸業界有史以來唯一獲得台灣精品獎的肯定與推薦，得獎型號為 YAC-BJ-75、82、87、92、100 系列，正是 YAC 所生產兩百五十多種車系的共同標準與品質要求。',
            'YAC 品牌代表與政府單位（工業技術研究院機械所）密切合作、通過 ISO 9000 國際品保認證、榮獲國家設計月品牌優良形象設計獎及台灣精品獎推薦，同時也是致力於無污染生產環境、提高能源使用效率的實踐者。',
          ],
        },
        {
          title: '原創性技術',
          body: ['中周波熱處理、熱鍛造漸伸加工、冷鍛造齒型修整。'],
        },
        {
          title: '少量多樣的彈性製造',
          body: [
            'YAC 的彈性製造條件，創造客戶在售後維修市場的有利競爭條件，並隨客戶的市場成長提供多元組合支援；此能力來自 YAC 電腦自動化生產排程管理系統（FMS）的持續改良，滿足全球化的協同成長任務。',
          ],
        },
        {
          title: '品質政策',
          body: ['堅持世界品質、研發製程技術、製造一流產品、符合顧客需求。'],
        },
        {
          title: '產品特點',
          list: [
            '充分提高燃油效率，降低耗油成本。',
            '提高車輛耐久、磨耗限度，降低行駛噪音。',
            '品質均勻度高，硬化深度比一般提高 1.8 倍。',
            '適用較高轉速之傳動連結，靈活自如轉動。',
            '耐衝擊、高扭力值，精度保證在標準值 0.02 以內。',
            '安裝維修簡易，更省時方便。',
          ],
          body: [
            '除產品安全品質保障外，YAC 更致力環保生產，以先進的中週波熱處理取代低成本高污染的滲碳法，環境無污染之虞。',
          ],
        },
      ],
      gallery: ['/images/pics/company-1s.jpg', '/images/pics/company-2s.jpg', '/images/pics/company-4s.jpg', '/images/pics/company-18s.jpg', '/images/pics/company-19s.jpg', '/images/pics/company-20s.jpg'],
    },
  },
  {
    key: 'contact',
    title: '聯絡我們',
    content: {
      company: '華佑科技 YAC（C.V. JOINT CO., LTD）',
      address: '彰化縣埔鹽鄉好修村光明路二段 200-2 號（No.200-2, Sec.2, Kwang-Ming Rd., Hao-Shiou Village, Pu-Yan Hsiang, Changhua, Taiwan, R.O.C.）',
      tel: '886-4-865-0926',
      fax: '886-4-865-6238',
      email: 'yac106@yac.com.tw',
      website: 'https://www.yac.com.tw',
    },
  },
  {
    key: 'home',
    title: '首頁內容',
    content: {
      heroTitle: '傳動與底盤零件，\n精準對應每一款車型。',
      heroSubtitle: '台灣精品獎推薦品牌，提供等速接頭、傳動軸、轉向機、輪轂等 11 大產品線型錄，可依 YAC / OEM 料號或車型快速查詢。',
      quality: [
        { title: '台灣精品獎', text: '傳動軸業界唯一獲獎品牌（1999）' },
        { title: 'ISO 9000', text: '國際品保認證' },
        { title: '少量多樣', text: 'FMS 彈性製造，支援售後市場' },
      ],
    },
  },
];

export const NEWS_SEED = [
  { slug: 'yac-new-01', title: 'YAC 新產品 NEW 01', cover: '/images/new-p/yacnew01.jpg' },
  { slug: 'atv-ad', title: 'ATV-AD 新產品', cover: '/images/new-p/ATV-AD.jpg' },
  { slug: 'atv-ad-2', title: 'ATV-AD 新產品（二）', cover: '/images/new-p/ATV-AD-2.jpg' },
];
