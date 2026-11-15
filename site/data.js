'use strict';

globalThis.FINN_DATA = (() => {
  const filing = 'https://www.infosys.com/investors/documents/exchange-filings/2026/outcome-board-meeting-23apr2026.pdf';
  const infyReport = 'https://www.infosys.com/investors/reports-filings/annual-report/annual-reports/ar-2025-26.html';
  const infyCall = 'https://www.infosys.com/investors/reports-filings/quarterly-results/2025-2026/q4/documents/transcripts/earningscall.pdf';
  const hclReport = 'https://www.hcltech.com/hcl-annual-report-2026';
  const hclCall = 'https://www.hcltech.com/sites/default/files/document/open/call-trans/2026-04/hcltech-earnings-q4-fy26-transcript.pdf';
  const hclDirector = 'https://www.hcltech.com/sites/default/files/en/appointmentofdirector.pdf';
  const tcsReport = 'https://www.ar.tcs.com/';
  const tcsCall = 'https://www.tcs.com/content/dam/tcs/investor-relations/financial-statements/2025-26/q4/Management%20Commentary/Transcript%20of%20the%20Q4%202025-26%20Earnings%20Conference%20Call%20held%20at%201900%20hrs%20IST%20on%20April%209%2C%202026.pdf';
  const wiproReport = 'https://www.wipro.com/investors/annual-reports/2025-26/';
  const wiproCall = 'https://www.wipro.com/content/dam/nexus/en/investor/quarterly-results/2025-2026/q4fy26/q4fy26-earnings-transcript.pdf';
  const wiproTracker = 'https://www.wipro.com/investors/guidance-vs-actuals/';
  const portfolio = [
    ['INFY', 'Infosys', 'IT services'], ['HCLTECH', 'HCLTech', 'IT services'],
    ['TCS', 'Tata Consultancy Services', 'IT services'], ['RELIANCE', 'Reliance Industries', 'Energy & retail'],
    ['HDFCBANK', 'HDFC Bank', 'Banking'], ['ICICIBANK', 'ICICI Bank', 'Banking'],
    ['AUBANK', 'AU Small Finance Bank', 'Banking'], ['BHARTIARTL', 'Bharti Airtel', 'Telecom'],
    ['SUNPHARMA', 'Sun Pharma', 'Pharma'], ['DIVISLAB', 'Divi’s Laboratories', 'Pharma'],
    ['LT', 'Larsen & Toubro', 'Industrials'], ['KEI', 'KEI Industries', 'Industrials'],
    ['TITAN', 'Titan Company', 'Consumer'], ['MARUTI', 'Maruti Suzuki', 'Automotive'],
    ['TATASTEEL', 'Tata Steel', 'Metals'], ['ASIANPAINT', 'Asian Paints', 'Consumer'],
    ['PIDILITIND', 'Pidilite Industries', 'Chemicals'],
  ];
  const events = [
    {id:'infy-q4', ticker:'INFY', date:'2026-04-23', kind:'Results', weight:95,
      title:'Profit rebounds as sequential demand softens',
      summary:'Q4 reported revenue rose 2.0% sequentially in rupees, while constant-currency revenue fell 1.3%. The prior quarter included a ₹1,289 cr labour-code charge.',
      question:'How much of the sequential profit rebound comes from the absence of the prior-quarter charge?',
      source:filing, sourceName:'Exchange filing · consolidated results',
      results:[['Revenue',46402,45479,40925], ['Operating EBITDA',11167,9510,9874], ['PBT',10797,9229,9663], ['PAT',8509,6666,7038]],
      note:'Consolidated, ₹ crore. Operating EBITDA is derived as operating profit plus D&A, using reported figures. PAT includes non-controlling interests.'},
    {id:'hcl-director', ticker:'HCLTECH', date:'2026-04-20', kind:'Leadership', weight:86,
      title:'HCLTech appoints Kimsuka Narsimhan to its board',
      summary:'The incoming independent director held regional CFO roles at Kimberly-Clark and PepsiCo and has served on several corporate boards.',
      question:'Which finance and risk topics could her operating experience bring to the board?',
      source:hclDirector, sourceName:'Exchange filing · board appointment',
      bio:'Chartered and cost accountant. Former Asia Pacific CFO at Kimberly-Clark, former India-region CFO at PepsiCo, and previously held leadership roles at Unilever.',
      bioSource:'https://www.hcltech.com/en-us/press-releases/hcltech-appoints-kimsuka-narsimhan-independent-director',
      person:'kimsuka'},
    {id:'hcl-q4', ticker:'HCLTECH', date:'2026-04-21', kind:'Results', weight:82,
      title:'HCLTech flags late-quarter pressure on services',
      summary:'Management reported 2.4% YoY constant-currency growth for Q4. It flagged deferred procurement and the discontinuation of two SAP programmes.',
      question:'Which delays are moving into the next quarter and which represent lost work?',
      source:'https://www.hcltech.com/investor-relations/statutory-reporting', sourceName:'Issuer statutory reporting · Q4 FY26'},
    {id:'infy-timing', ticker:'INFY', date:'2026-04-23', kind:'Routine', weight:18, dateOnly:true,
      title:'Infosys publishes earnings call materials',
      summary:'Audio and the transcript accompany the Q4 results.', source:infyCall, sourceName:'Issuer earnings call'},
    {id:'hcl-timing', ticker:'HCLTECH', date:'2026-04-13', kind:'Routine', weight:12,
      title:'HCLTech schedules its Q4 conference call',
      summary:'The company issued its call notice ahead of results.', source:'https://www.hcltech.com/investor-relations/archives?page=0', sourceName:'Issuer exchange disclosure archive'},
    {id:'infy-acq', ticker:'INFY', date:'2026-03-25', kind:'M&A', weight:90,
      title:'Infosys approves two US acquisitions',
      summary:'The board approved acquisitions in healthcare IT and insurance technology. The later results filing disclosed up to US$560m combined including earn-outs, before excluded incentives and closing adjustments.',
      question:'How much of the consideration is contingent, and what delivery capability is hard to replicate organically?',
      source:'https://www.infosys.com/investors/documents/exchange-filings/2026/intimation-regulation30-sebi-25mar2026.pdf', sourceName:'Exchange filing · Regulation 30'},
  ];
  const research = {
    INFY:{name:'Infosys', period:'FY26 · year ended 31 Mar 2026', thesis:'Revenue grew faster than reported operating profit.',
      metrics:[['Revenue','₹178,650 cr','+9.6% YoY'], ['Operating margin','20.3%','−0.8 pp YoY'], ['FCF / net profit','112.3%','Issuer definition']],
      pairs:[['What management said','Management reported 3.1% FY26 constant-currency revenue growth and cited about 70 basis points of acquisition contribution.',infyCall,'Q4 transcript · CFO remarks'],
        ['What the annual report shows','FY26 revenue grew 9.6% in reported rupees. The reported 20.3% operating margin rises to 21.0% on the company’s adjusted basis excluding the labour-code impact.',infyReport,'FY26 annual report · business highlights']],
      take:'Keep reported rupee growth, constant-currency growth and acquisition contribution distinct. A higher growth headline does not alone settle the question of organic demand.',
      ask:'How much new scope is clients’ AI spending creating after productivity savings on existing contracts?'},
    HCLTECH:{name:'HCLTech', period:'FY26 · year ended 31 Mar 2026', thesis:'Services growth and software softness tell different stories.',
      metrics:[['Revenue','₹130,144 cr','+11.2% YoY'], ['CC growth','3.9%','FY26'], ['EBIT margin','17.2%','Reported FY26']],
      pairs:[['What management said','On the Q4 call, management reported software revenue down 14% YoY and services up 4.2% YoY in constant currency.',hclCall,'Q4 transcript · p. 3'],
        ['What the annual report shows','FY26 constant-currency revenue grew 3.9%. The company reports the full-year results separately from the Q4 effects discussed on the call.',hclReport,'FY26 annual report · performance highlights']],
      take:'Stress-test the software decline separately from services. The segment mix matters to the group margin.',
      ask:'Which software renewals slipped on timing, and which represent permanent contraction?'},
    TCS:{name:'Tata Consultancy Services', period:'FY26 · year ended 31 Mar 2026', thesis:'The quarter turned sequentially while full-year constant-currency revenue contracted.',
      metrics:[['Revenue','₹267,021 cr','+4.6% reported YoY'], ['CC growth','−2.4%','FY26'], ['Operating margin','25.0%','FY26 · excludes one-offs']],
      pairs:[['What management said','Q4 revenue grew 1.2% sequentially in constant currency. Management highlighted Q4 operating cash flow equal to 106.7% of net income.',tcsCall,'Q4 transcript · financial discussion'],
        ['What the annual report shows','FY26 revenue was ₹267,021 crore, up 4.6% in reported rupees. Full-year constant-currency revenue was down 2.4%.',tcsReport,'FY26 annual report · performance']],
      take:'Use the sequential constant-currency improvement as the starting point for checking whether revenue is recovering over multiple quarters.',
      ask:'Which Q4 starts were newly signed deals, and which were ramp-ups of existing programmes?'},
    WIPRO:{name:'Wipro', period:'FY26 · year ended 31 Mar 2026', thesis:'All four FY26 quarters met guidance on the company’s guided-currency basis.',
      metrics:[['Gross revenue','₹926.2 bn','+4.0% YoY'], ['IT services margin','17.3%','Q4 FY26'], ['OCF / net income','112.6%','FY26']],
      pairs:[['What management said','On the Q4 call Wipro gave Q1 FY27 IT-services revenue guidance of US$2,597m–2,651m.',wiproCall,'Q4 transcript · CFO outlook'],
        ['What the annual report shows','The annual report records FY26 results and the December closing of the DTS acquisition. This gives context for how changes in scope can affect revenue comparisons.',wiproReport,'FY26 integrated annual report']],
      guidance:{source:wiproTracker, rows:[['Q1 FY26',2505,2557,2543.3],['Q2 FY26',2560,2612,2594.2],['Q3 FY26',2591,2644,2641.8],['Q4 FY26',2635,2688,2641.4]]},
      take:'Q4 landed near the bottom of its range, while Q3 finished near the top. Comparing the position within each range adds signal beyond whether guidance was met.',
      ask:'How much support came from acquired revenue, and how is organic demand changing?'},
  };
  const contacts = [
    {id:'mira', name:'Mira Shah', role:'Former delivery director', color:'plum', employer:'Infosys', ticker:'INFY', tenure:'2017–2023', themes:['IT services','AI delivery','Insurance technology'], met:'Feb 2026', why:'Ran financial-services delivery at Infosys. Can explain where automation changes effort and contract economics.'},
    {id:'arjun', name:'Arjun Rao', role:'Former software product lead', color:'green', employer:'HCLTech', ticker:'HCLTECH', tenure:'2018–2024', themes:['IT services','Enterprise software'], met:'Nov 2025', why:'Worked in enterprise software at HCLTech. Can contextualise renewals, procurement cycles and cross-sell.'},
    {id:'neha', name:'Neha Menon', role:'Former regional finance controller', color:'gold', employer:'Kimberly-Clark', tenure:'2016–2021', themes:['Corporate governance','Consumer goods','Finance'], met:'Aug 2025', why:'Can explain how a regional FMCG finance function approaches audit and risk.'},
    {id:'dev', name:'Dev Bhat', role:'Former managed-services lead', color:'blue', employer:'Wipro', ticker:'WIPRO', tenure:'2019–2024', themes:['IT services','Cloud migration'], met:'Oct 2025', why:'Can help distinguish short-term project ramp-ups from recurring managed-services work.'},
    {id:'isha', name:'Isha Kulkarni', role:'Former IT sourcing manager', color:'plum', employer:'Tata Consultancy Services', ticker:'TCS', tenure:'2015–2021', themes:['IT services','Vendor procurement'], met:'Jan 2026', why:'Can describe the procurement and transition stages that separate a signed contract from recognised revenue.'},
    {id:'kabir', name:'Kabir Sen', role:'Former credit risk manager', color:'green', employer:'AU Small Finance Bank', ticker:'AUBANK', tenure:'2018–2024', themes:['Rural lending','Banking','Credit risk'], met:'Jul 2025', why:'Can contextualise underwriting and collection practices for small-business and rural borrowers.'},
  ];
  const paths = [{person:'kimsuka', name:'Kimsuka Narsimhan', via:'neha', basis:'Shared employer · Kimberly-Clark', detail:'Synthetic employer overlap with the appointee’s public career history. Confirm relevant dates and whether they worked together before asking for an introduction.'}];
  const market = globalThis.FINN_MARKET;
  return {portfolio, events, research, contacts, paths, market, replay:'2026-04-24T00:00:00+05:30'};
})();
