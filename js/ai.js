/* 语朵朵 - AI 批改服务（兼容 OpenAI Chat Completions 接口） */
window.AIHelper = (function () {
  'use strict';

  const KEY = 'yuduoduo_ai_config_v1';
  const PRESETS = {
    deepseek: { name: 'DeepSeek', url: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat', tip: '推荐：对中文作文批改效果好，支持浏览器直连' },
    qwen: { name: '通义千问', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-plus', tip: '阿里云兼容模式，中文理解能力强' },
    kimi: { name: 'Kimi', url: 'https://api.moonshot.cn/v1/chat/completions', model: 'moonshot-v1-8k', tip: '月之暗面，长文本支持好' },
    openai: { name: 'OpenAI', url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', tip: '可能需要代理才能从浏览器直连' },
    custom: { name: '自定义接口', url: '', model: '', tip: '任何兼容 OpenAI 格式的接口都可以' }
  };

  function getConfig() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return Object.assign({ preset: 'custom', url: '', model: '', key: '' }, JSON.parse(raw));
    } catch (e) { return null; }
  }
  function saveConfig(cfg) {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  }
  function clearConfig() {
    localStorage.removeItem(KEY);
  }
  function isConfigured() {
    const c = getConfig();
    return !!(c && c.url && c.model && c.key);
  }

  function parseJSON(text) {
    let s = String(text || '').trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start >= 0 && end > start) s = s.slice(start, end + 1);
    try {
      return JSON.parse(s);
    } catch (e) {
      throw new Error('AI 返回的内容格式不正确，请再试一次');
    }
  }

  async function request(messages, maxTokens) {
    const cfg = getConfig();
    if (!isConfigured()) throw new Error('请先在设置中配置 AI 接口');
    let res;
    try {
      res = await fetch(cfg.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.key
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: messages,
          temperature: 0.7,
          max_tokens: maxTokens || 1200
        })
      });
    } catch (e) {
      throw new Error('网络请求失败：可能是跨域限制、网络不通或接口地址错误');
    }
    if (!res.ok) {
      let msg = '接口返回 HTTP ' + res.status;
      try {
        const j = await res.json();
        if (j && j.error && j.error.message) msg = j.error.message;
      } catch (e) { /* 忽略解析错误 */ }
      throw new Error(msg);
    }
    const data = await res.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error('AI 没有返回内容，请重试');
    return content;
  }

  function reviewPrompt(title, content) {
    return '请以小学五年级语文老师的身份，批改下面这篇五年级学生的作文。\n\n' +
      '作文题目：' + (title || '（未写题目）') + '\n' +
      '作文正文：\n' + content + '\n\n' +
      '评分标准（总分100）：内容具体30分、结构清晰20分、语言生动20分、情感真实15分、标点与书写规范15分。\n\n' +
      '请严格只返回一个 JSON 对象（不要使用 markdown 代码块，不要任何多余文字），格式如下：\n' +
      '{\n' +
      '  "score": 85,\n' +
      '  "level": "良好",\n' +
      '  "summary": "一段50字以内的总体评价，语气温暖鼓励",\n' +
      '  "highlights": ["具体指出文中写得好的地方1", "写得好的地方2"],\n' +
      '  "suggestions": ["具体可操作的改进建议1", "改进建议2", "改进建议3"],\n' +
      '  "rewrite": "挑选文中一句最值得修改的句子，写出你的修改示例"\n' +
      '}\n\n' +
      '要求：评语要针对这篇作文的实际内容，不要说空话；建议要具体到“可以怎么做”；语气亲切，多用鼓励。';
  }

  async function reviewEssay(title, content) {
    const text = await request([
      { role: 'system', content: '你是一位温和、专业的小学语文老师，专门辅导小学五年级学生写作文。你的评语具体、可操作，语气鼓励，符合五年级孩子的理解水平。你只返回要求的 JSON。' },
      { role: 'user', content: reviewPrompt(title, content) }
    ], 1600);
    const j = parseJSON(text);
    return {
      score: Math.max(0, Math.min(100, Number(j.score) || 70)),
      level: j.level || '良好',
      summary: j.summary || '',
      highlights: Array.isArray(j.highlights) ? j.highlights : [],
      suggestions: Array.isArray(j.suggestions) ? j.suggestions : [],
      rewrite: j.rewrite || ''
    };
  }

  async function weeklyComment(data) {
    const text = await request([
      { role: 'system', content: '你是一位小学班主任，正在给家长写一周的学习反馈。语气客观、温暖、具体，不夸大也不批评。你只返回要求的 JSON。' },
      { role: 'user', content:
        '请根据以下数据，为一位小学五年级女生写一段给家长看的一周语文学习反馈。\n\n' +
        '统计周期：' + data.range + '\n' +
        '获得星星：' + data.stars + ' 颗\n' +
        '完成基础练习：' + data.sets + ' 套，共 ' + data.total + ' 题，正确率 ' + data.accuracy + '%\n' +
        '完成阅读：' + data.reading + ' 篇\n' +
        '完成作文：' + data.essays + ' 篇，平均得分 ' + data.avgScore + ' 分\n' +
        '连续学习：' + data.streak + ' 天\n' +
        '掌握较弱的题型：' + (data.weak.length ? data.weak.join('、') : '暂无明显薄弱项') + '\n\n' +
        '请严格只返回 JSON 对象（不要 markdown 代码块）：\n' +
        '{\n' +
        '  "comment": "150字以内写给家长的总体反馈",\n' +
        '  "focus": "本周最值得肯定的一个进步点",\n' +
        '  "advice": ["给家长的家庭辅导建议1", "建议2"]\n' +
        '}'
      }
    ], 900);
    const j = parseJSON(text);
    return {
      comment: j.comment || '',
      focus: j.focus || '',
      advice: Array.isArray(j.advice) ? j.advice : []
    };
  }

  function arr(v) { return Array.isArray(v) ? v : []; }

  async function analyzeLearning(profile) {
    const text = await request([
      { role: 'system', content: '你是一位资深小学语文教研员，擅长根据学生的长期练习数据做学情诊断。你的分析客观、具体、有可操作性，语气温暖鼓励。你只返回要求的 JSON。' },
      { role: 'user', content:
        '请根据以下长期学习数据，诊断一位小学五年级女生的语文基础，并给出针对性提升方案。\n\n' +
        '学习跨度：' + profile.days + ' 天，累计答题 ' + profile.total + ' 道，连续学习 ' + profile.streak + ' 天\n' +
        '各题型正确率：\n' + profile.skills.map(function (s) { return '- ' + s.name + '：' + s.rate + '%（' + s.total + '题）'; }).join('\n') + '\n' +
        '错题集中题型：' + (profile.wrongTop.length ? profile.wrongTop.join('、') : '暂无明显集中') + '\n' +
        '作文得分记录：' + (profile.essayScores.length ? profile.essayScores.join('、') + ' 分' : '暂无') + '\n' +
        '阅读理解完成：' + profile.reading + ' 篇\n\n' +
        '请严格只返回 JSON 对象（不要 markdown 代码块）：\n' +
        '{\n' +
        '  "level": "基础扎实 / 中等偏上 / 中等 / 基础偏弱 四选一",\n' +
        '  "summary": "150字以内的总体诊断，指出基础水平和最突出的特点",\n' +
        '  "strengths": ["已经掌握得好的地方1", "地方2"],\n' +
        '  "weaknesses": [{"name":"题型名","rate":45,"cause":"可能的薄弱原因","advice":"具体怎么练"}],\n' +
        '  "trend": "从数据看长期变化趋势与学习习惯评价",\n' +
        '  "plan": [{"priority":1,"focus":"薄弱题型名","action":"每天具体做什么","days":7}],\n' +
        '  "encouragement": "一段给孩子和家长看的鼓励话"\n' +
        '}\n\n' +
        '要求：weaknesses 最多列3项，只列正确率低于80%且题量足够的题型；plan 最多3条，按优先级排序，动作要具体可执行。'
      }
    ], 2000);
    const j = parseJSON(text);
    return {
      level: j.level || '中等',
      summary: j.summary || '',
      strengths: arr(j.strengths),
      weaknesses: arr(j.weaknesses).map(function (w) {
        return { name: w.name || '', rate: Number(w.rate) || 0, cause: w.cause || '', advice: w.advice || '' };
      }),
      trend: j.trend || '',
      plan: arr(j.plan).map(function (p) {
        return { priority: Number(p.priority) || 1, focus: p.focus || '', action: p.action || '', days: Number(p.days) || 7 };
      }),
      encouragement: j.encouragement || ''
    };
  }

  async function generateDrill(profile, focus) {
    const weakText = focus && focus.length
      ? focus.map(function (w) { return w.name + '（正确率' + w.rate + '%）'; }).join('、')
      : '请针对正确率最低的题型出题';
    const text = await request([
      { role: 'system', content: '你是一位小学五年级语文老师，正在为学生出针对性练习题。你只返回要求的 JSON，题目难度符合部编版五年级水平。' },
      { role: 'user', content:
        '请针对以下薄弱点，出 5 道五年级语文练习题：' + weakText + '\n' +
        '学生已掌握：' + (profile.skills.filter(function (s) { return s.rate >= 80; }).map(function (s) { return s.name; }).join('、') || '暂无') + '\n\n' +
        '要求：\n' +
        '1. 题目要围绕薄弱点，难度适中，不要超纲；\n' +
        '2. 填空题和选择题混合，填空题用 fill:true 和 a 表示答案，选择题用 opts 数组和 a 表示正确选项下标（从0开始）；\n' +
        '3. 每题给一句简短的解析 why，语气鼓励。\n\n' +
        '严格只返回 JSON 对象（不要 markdown 代码块）：\n' +
        '{"questions":[{"q":"题目文字","fill":true,"a":"答案","why":"解析"},{"q":"题目文字","opts":["选项A","选项B","选项C"],"a":0,"why":"解析"}]}'
      }
    ], 2200);
    const j = parseJSON(text);
    const questions = arr(j.questions).map(function (q) {
      if (!q || !q.q) return null;
      if (q.fill) return { q: String(q.q), fill: true, a: String(q.a || ''), why: String(q.why || '') };
      if (Array.isArray(q.opts) && q.opts.length >= 2) {
        let a = Number(q.a);
        if (!Number.isInteger(a) || a < 0 || a >= q.opts.length) a = 0;
        return { q: String(q.q), opts: q.opts.map(String), a: a, why: String(q.why || '') };
      }
      return null;
    }).filter(Boolean);
    if (!questions.length) throw new Error('AI 没有生成有效题目，请重试');
    return questions;
  }

  async function testConnection() {
    const text = await request([{ role: 'user', content: '请只回复“连接成功”三个字。' }], 30);
    return String(text).trim();
  }

  return {
    PRESETS: PRESETS,
    getConfig: getConfig,
    saveConfig: saveConfig,
    clearConfig: clearConfig,
    isConfigured: isConfigured,
    reviewEssay: reviewEssay,
    weeklyComment: weeklyComment,
    analyzeLearning: analyzeLearning,
    generateDrill: generateDrill,
    testConnection: testConnection
  };
})();
