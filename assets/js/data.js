/* ==========================================================================
   YunSee CTF Team — 站点数据源
   --------------------------------------------------------------------------
   全站内容集中在本文件。修改这里即可更新网站，无需改动 HTML / CSS / main.js。

   全部为真实数据。仍待补：PARTNERS 里三家的 url
   （留空只是渲染成不可点击的卡片，不会产生死链）
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. 站点基础信息  ← 上线前请务必修改 joinEmail / github
   -------------------------------------------------------------------------- */
const SITE = {
  name:       'YunSee',
  nameUpper:  'YUNSEE',
  slogan:     '攻防对抗 · 漏洞研究 · 安全竞赛',
  intro:      'YunSee 是一支专注于 CTF 竞赛与漏洞研究的安全战队，覆盖 Web、Pwn、Reverse、Crypto、Misc 与区块链方向。',
  founded:    2025,                    // ★ 成立年份：页眉 / 首屏 / 页脚统一取这个值
  joinEmail:  'root@yunsee.team',      // ★ 招新收件邮箱：投递申请会发到这里
  contactEmail: 'hacker@yunsee.team', // ★ 对外联系邮箱
  github:     'https://github.com/YunSeeTeam',
  qqGroup:    '1034296865',
  location:   'CN / REMOTE'
};

/* --------------------------------------------------------------------------
   2. 方向定义（用于标签与筛选，key 需与成员的 field 对应）
   -------------------------------------------------------------------------- */
const FIELDS = [
  { key: 'WEB',    label: 'Web 安全' },
  { key: 'PWN',    label: '二进制利用' },
  { key: 'RE',     label: '逆向工程' },
  { key: 'CRYPTO', label: '密码学' },
  { key: 'MISC',   label: '杂项取证' },
  { key: 'IR',     label: '应急响应' },
  { key: 'DEV',    label: '软件开发' },
  { key: 'BC',     label: '区块链' }
];

/* --------------------------------------------------------------------------
   3. 战队核心成员
   field  单方向写字符串，多方向写数组（第一个视为主攻，显示在卡片右上角编号处）
   skills 数量不限，1—3 条都能正常排版
   links  值为 '#' 或留空的条目不会渲染按钮，避免死链
   -------------------------------------------------------------------------- */
const CORE_MEMBERS = [
  {
    handle: '江思澄',
    name:   '队长 / Captain',
    field:  'WEB',
    since:  2025,
    bio:    '擅长 Misc、Web、应急处置、SRC 漏洞挖掘、Agent 调优工作。',
    skills: [['web渗透', 60], ['Misc', 50], ['应急响应', 70]],
    links:  { github: '#', blog: '#' }
  },
  {
    handle: '顾白',
    name:   '成员 / Member',
    field:  'PWN',
    since:  2025,
    bio:    '负责 PWN 方向攻坚，擅长 Linux 下二进制漏洞利用。',
    skills: [['用户态', 95], ['逆向', 50], ['内核态', 30]],
    links:  { github: 'https://github.com/gubaiovo/', blog: 'https://blog.gubaiovo.com/' }
  },
  {
    handle: 'Tsuk1',
    name:   '成员 / Member',
    field:  'PWN',
    since:  2025,
    bio:    '擅长二进制漏洞挖掘与利用。',
    skills: [['二进制安全', 75], ['逆向工程', 65], ['模糊测试', 60]],
    links:  { github: 'https://github.com/tsuk1ctf', blog: 'https://tsuk1.top' }
  },
  {
    handle: '散秋风',
    name:   '成员 / Member',
    field:  'RE',
    since:  2025,
    bio:    '对各种加密算法有深刻的理解，比如 RC4、TEA 等等。',
    skills: [['算法分析', 95], ['应急响应', 80], ['网站运维', 75]],
    links:  { github: 'https://github.com/yanserein', blog: 'https://bk.aurorapoint.cn' }
  },
  {
    handle: 'Dark River',
    name:   '成员 / Member',
    field:  'MISC',
    since:  2025,
    bio:    'Web 杂项，在研究逆向。',
    skills: [['WEB', 85], ['MISC', 95], ['Reverse', 50]],
    links:  { github: '#', blog: '#' }
  },
  {
    handle: 'FISHqianli',
    name:   '成员 / Member',
    field:  'WEB',
    since:  2025,
    bio:    '擅长实战攻防、CTF 解题。',
    skills: [['web渗透', 50], ['代码审计', 50], ['SRC', 30]],
    links:  { github: '#', blog: '#' }
  },
  {
    handle: 'Zekk',
    name:   '成员 / Member',
    field:  'WEB',
    since:  2025,
    bio:    '擅长 web 通用漏洞利用，目前正在重拾研究学习新技术的习惯。',
    skills: [['黑盒渗透', 85], ['安全研究', 70], ['攻防对抗', 65]],
    links:  { github: 'https://github.com/CoHyu', blog: '#' }
  },
  {
    handle: 'yuiiijuk',
    name:   '成员 / Member',
    field:  ['CRYPTO', 'IR', 'MISC'],
    since:  2025,
    bio:    '主攻密码方向，进行蓝队应急响应分析，杂项多思路解决。',
    skills: [['密码', 61], ['应急响应', 78], ['杂项', 55]],
    links:  { github: '#', blog: '#' }
  },
  {
    handle: '川意',
    name:   '成员 / Member',
    field:  'DEV',
    since:  2026,
    bio:    '擅长 Android 深度应用开发与移动安全防护。',
    skills: [['安卓开发', 90], ['移动安全', 75], ['逆向工程', 70]],
    links:  { github: 'https://github.com/MiChongs', blog: '#' }
  },
  {
    handle: 'cyl-love',
    name:   '成员 / Member',
    field:  'WEB',
    since:  2026,
    bio:    '擅长 Web 渗透与漏洞挖掘。',
    skills: [['Web 渗透测试', 40], ['漏洞挖掘与利用', 35], ['CTF/靶机实战', 25]],
    links:  { github: 'https://github.com/cyl-love', blog: 'https://cyl-love.github.io/' }
  },
  {
    handle: '漫长',
    name:   '成员 / Member',
    field:  'MISC',
    since:  2025,
    bio:    '流量分析、取证。',
    skills: [['流量分析', 40], ['取证', 40], ['渗透', 20]],
    links:  { github: '#', blog: '#' }
  },
  {
    handle: '瓜皮唐',
    name:   '成员 / Member',
    field:  ['MISC', 'WEB'],
    since:  2025,
    bio:    '擅长电子取证、流量分析、Top10、SRC 漏洞挖掘。',
    skills: [['电子取证', 60], ['SRC漏洞挖掘', 45], ['综合渗透', 40]],
    links:  { github: '#', blog: '#' }
  }
];

/* --------------------------------------------------------------------------
   4. 战队俱乐部成员（外围 / 预备 / 训练营）
   数组顺序即展示顺序；方向筛选按钮只会显示这里实际出现过的方向。
   field 单方向写字符串，多方向写数组：field: ['RE', 'PWN']
   多方向成员在任一方向的筛选下都会出现。
   -------------------------------------------------------------------------- */
const CLUB_MEMBERS = [
  { handle: '世茶之火',   field: ['RE', 'PWN'], since: 2025, status: '在役' },
  { handle: 'dnw',        field: 'WEB',         since: 2025, status: '训练营' },
  { handle: 'jake',       field: 'WEB',         since: 2026, status: '训练营' },
  { handle: '懒羊羊大王', field: 'WEB',         since: 2026, status: '训练营' },
  { handle: '小猫咪',     field: 'CRYPTO',      since: 2026, status: '训练营' },
  { handle: 'Xray Wire Link',     field: 'WEB',      since: 2026, status: '训练营' },
  { handle: 'Odlteyl',    field: 'WEB',         since: 2026, status: '训练营' }
];

/* --------------------------------------------------------------------------
   5. 战队奖项
   level: 国际 / 国家级 / 省级 / 行业
   -------------------------------------------------------------------------- */
const AWARDS = [
  { year: 2026, event: 'D^3CTF', rank: '三等奖',   level: '行业', note: '排名第三' },
  { year: 2026, event: 'NepCTF',                  rank: '一等奖',   level: '行业',   note: '排名第二' },
  { year: 2026, event: 'H&NCTF',            rank: '一等奖',   level: '行业', note: '排名第二' },
  { year: 2026, event: '国际盘古石杯电子取证大赛',                rank: '二等奖',   level: '国际', note: 'APK&流量分析&内存取证零失分' },
  { year: 2026, event: '河南省御网杯网络安全大赛',                  rank: '一等奖',  level: '国家级',   note: '应急响应&安全加固零失分' },
  { year: 2026, event: '獬豸杯电子取证大赛',               rank: '一等奖',   level: '行业',   note: '排名第一' },
  { year: 2026, event: 'FIC电子取证大赛',                 rank: '三等奖',   level: '国家级',   note: '*' },
  { year: 2026, event: 'PolarisCTF',              rank: '三等奖',     level: '行业', note: '排名第九' },
  { year: 2025, event: '“羊城杯” 粤港澳大湾区网络安全大赛',        rank: '三等奖',     level: '国家级',   note: '数据安全零失分' },
  { year: 2025, event: '一带一路金砖国家网络安全与治理',        rank: '二等奖',     level: '国家级',   note: '应急响应&流量分析零失分' }
];

/* --------------------------------------------------------------------------
   6. 战队开源项目（GitHub）
   lang 可以写复合串，色点取其中第一个能识别的语言
   -------------------------------------------------------------------------- */
const PROJECTS = [
  {
    name: 'Wayfort',
    desc: '一个面向运维与安全团队的 Web 特权访问管理平台。它把传统运维需要的一大堆客户端（mstsc、SecureCRT、Navicat、FileZilla、各家对象存储工具……）统一收敛进浏览器，并在统一的代理链路、RBAC + 资产授权、审批工作流、会话录像、异步审计、KMS 凭据加密之上，把所有运维动作纳入可观测、可追溯、可治理的轨道。',
    lang: 'Go + TypeScript（React + Next.js）',
    tag:  'Ops',
    url:  'https://github.com/MiChongs/Wayfort'
  },
  {
    name: 'syscage',
    desc: '基于 Rust 的 ELF 文件保护和沙箱检测工具。',
    lang: 'Rust',
    tag:  'PWN',
    url:  'https://github.com/Find-key/syscage'
  },
  {
    name: 'MiscTools',
    desc: '常见 CTF 杂项算法解密集成工具箱。',
    lang: 'Python',
    tag:  'Misc',
    url:  'https://github.com/achenc1013/YunSee-MiscTools'
  }
];

/* --------------------------------------------------------------------------
   7. 合作伙伴（顺序即展示顺序）
   logo 放在 assets/images/，建议正方形；卡片按 1:1 裁切。
   url 留空时卡片不可点击（不会产生死链），补上官网地址后自动变为链接。
   -------------------------------------------------------------------------- */
const PARTNERS = [
  {
    name:  '好靶场',
    en:    'CYBER RANGE',
    logo:  'assets/images/haobachang.jpg',
    desc:  '网络安全实战靶场平台，提供贴近真实环境的攻防演练与赛题训练场景。',
    tags:  ['靶场', '实战训练'],
    url:   ''                       // ★ 待补：好靶场官网地址
  },
  {
    name:  '终渊二进制安全实验室',
    en:    'BINARY SECURITY LAB',
    logo:  'assets/images/zhongyuan-lab.jpg',
    desc:  '专注二进制安全的研究团队，覆盖逆向工程、漏洞挖掘与利用技术研究。',
    tags:  ['二进制', '漏洞研究'],
    url:   ''                       // ★ 待补：终渊实验室官网 / 主页地址
  },
  {
    name:  '鱼影安全',
    en:    'FISH SHADOW SECURITY',
    logo:  'assets/images/yuying.jpg',
    desc:  '网络安全服务与攻防对抗团队，提供安全评估、应急响应与技术共建。',
    tags:  ['安全服务', '攻防对抗'],
    url:   ''                       // ★ 待补：鱼影安全官网地址
  }
];

/* --------------------------------------------------------------------------
   8. 友链（顺序即展示顺序）
   name 为站点名，desc 选填；域名由 url 自动解析，不用重复写。
   -------------------------------------------------------------------------- */
const FRIEND_LINKS = [
  {
    name: '叁玖の小博客',
    desc: '叁玖的小博客喵~~~',
    url:  'https://www.sanjiuctf.com/'
  },
  {
    name: 'TianFu Sec',
    desc: '',
    url:  'https://tianfusec.top/'
  },
  {
    name: 'LUOYE BLOG',
    desc: '写代码，也写生活里的风。',
    url:  'https://luoyeye.cn/'
  }
];

/* --------------------------------------------------------------------------
   9. 加入战队 — 招新说明
   -------------------------------------------------------------------------- */
const JOIN_NOTES = [
  { t: '有基础方向',   d: '至少在 Web / Pwn / Reverse / Crypto / Misc 中的一个方向有持续投入。' },
  { t: '能长期参与',   d: '每周可稳定投入训练与赛事，能够配合队内排期参加线上线下比赛。' },
  { t: '愿意分享',     d: '赛后按队内规范输出 Writeup，参与知识库与开源项目维护。' },
  { t: '不设门槛限制', d: '不限学校与年级，训练营面向零基础但有强烈兴趣的同学开放。' }
];
