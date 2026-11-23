/* 语朵朵 · 语文学习助手 - 应用逻辑 */
(function () {
  'use strict';

  const D = window.APP_DATA;
  const KEY = 'yuduoduo_state_v1';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------------- 状态 ---------------- */
  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function daysBetween(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }
  function defaultState() {
    return {
      stars: 0, streak: 1, lastActive: '',
      daily: { date: today(), tasks: { basic: false, reading: false, writing: false } },
      stats: { basicSets: 0, basicCorrect: 0, basicTotal: 0, readingSets: 0, essays: 0, perfect: 0, byType: {} },
      weekly: [0, 0, 0, 0, 0, 0, 0],
      starLog: [], wrongBook: [], essays: [], history: [], diagnoses: []
    };
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const s = Object.assign(defaultState(), JSON.parse(raw));
      s.stats = Object.assign({ basicSets: 0, basicCorrect: 0, basicTotal: 0, readingSets: 0, essays: 0, perfect: 0, byType: {} }, s.stats || {});
      if (!s.stats.byType) s.stats.byType = {};
      if (!Array.isArray(s.starLog)) s.starLog = [];
      if (!Array.isArray(s.diagnoses)) s.diagnoses = [];
      if (s.daily.date !== today()) {
        s.daily = { date: today(), tasks: { basic: false, reading: false, writing: false } };
      }
      return s;
    } catch (e) { return defaultState(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 隐私模式忽略 */ }
  }
  let S = loadState();

  function checkIn() {
    const t = today();
    if (S.lastActive === t) return;
    if (S.lastActive && daysBetween(S.lastActive, t) === 1) S.streak += 1;
    else if (S.lastActive) S.streak = 1;
    S.lastActive = t;
    S.daily.date = t;
    save();
  }

  function addStars(n) {
    S.stars += n;
    const d = new Date();
    const idx = (d.getDay() + 6) % 7;
    S.weekly[idx] += n;
    S.starLog.push({ date: today(), n: n });
    if (S.starLog.length > 500) S.starLog = S.starLog.slice(-500);
    save();
    renderTopStats();
  }
  function logHistory(icon, text, score, meta) {
    S.history.unshift({ date: today(), icon: icon, text: text, score: score || '', meta: meta || null });
    S.history = S.history.slice(0, 200);
    save();
  }
  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
  }
  function openModal(html, wide) {
    $('#modal-box').innerHTML = html;
    $('#modal-box').classList.toggle('modal-wide', !!wide);
    $('#modal-mask').hidden = false;
  }
  function closeModal() { $('#modal-mask').hidden = true; }

  /* ---------------- 页面导航 ---------------- */
  const META = {
    home: ['今日计划', '今天也要加油哦，小朋友！'],
    basic: ['基础巩固', '字词句天天练，打牢语文基本功'],
    reading: ['阅读提升', '读懂一篇文章，学会一种思考'],
    writing: ['写作工坊', '从积累素材开始，写出自己的精彩'],
    growth: ['成长记录', '每一点努力，都值得被看见'],
    drill: ['针对性训练', 'AI 根据你的薄弱点出的专属练习']
  };
  let page = 'home';
  let basicTab = 'pinyin';
  let readingTab = 0;
  let writingTab = 'material';
  let materialTab = '写人';
  let textbookBook = '五上';
  let textbookUnit = null;
  let lastAIReview = null;
  let currentDiagnosis = null;
  let quiz = null;

  function setPage(p) {
    if (!META[p]) return;
    page = p;
    $('#page-title').textContent = META[p][0];
    $('#page-subtitle').textContent = META[p][1];
    $$('[data-page]').forEach(function (b) { b.classList.toggle('active', b.dataset.page === p); });
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function renderTopStats() {
    $('#stat-streak').textContent = S.streak;
    $('#stat-stars').textContent = S.stars;
  }

  function render() {
    renderTopStats();
    if (page === 'home') renderHome();
    else if (page === 'basic') renderBasic();
    else if (page === 'reading') renderReading();
    else if (page === 'writing') renderWriting();
    else if (page === 'growth') renderGrowth();
    else if (page === 'drill') renderDrill();
    hwSetup();
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    const tasks = S.daily.tasks;
    const doneCount = Object.values(tasks).filter(Boolean).length;
    const hour = new Date().getHours();
    const greet = hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    const weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][new Date().getDay()];

    const taskRows = [
      { key: 'basic', icon: '📖', name: '基础巩固练习', desc: '字词句闯关，建议 10 分钟', page: 'basic', color: 'var(--primary-soft)' },
      { key: 'reading', icon: '🔍', name: '阅读一篇短文', desc: '读完想一想，答案藏在文章里', page: 'reading', color: 'var(--accent-soft)' },
      { key: 'writing', icon: '✍️', name: '写一段小练笔', desc: '用好词好句，把画面写具体', page: 'writing', color: 'var(--green-soft)' }
    ];

    $('#page-container').innerHTML = `
      <div class="hero">
        <div class="hero-text">
          <div class="hero-greeting">${greet}，小朋友 · ${weekday}</div>
          <h2>今天也一起把语文学好吧！</h2>
          <p>每天一点点积累，字词会更牢，文章会更美。你已经连续学习 ${S.streak} 天啦，继续保持哦～</p>
        </div>
        <div class="hero-badge"><strong>${doneCount}/3</strong><span>今日任务完成</span></div>
      </div>

      <div class="section-title"><h2>📊 我的学习小档案</h2><span class="more">数据每天自动更新</span></div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-ico" style="background:var(--accent-soft)">🔥</div><div><b>${S.streak}</b><small>连续学习天数</small></div></div>
        <div class="stat-card"><div class="stat-ico" style="background:#FFF7DA">⭐</div><div><b>${S.stars}</b><small>累计获得星星</small></div></div>
        <div class="stat-card"><div class="stat-ico" style="background:var(--primary-soft)">📝</div><div><b>${S.stats.basicSets}</b><small>完成练习套数</small></div></div>
        <div class="stat-card"><div class="stat-ico" style="background:var(--green-soft)">✍️</div><div><b>${S.stats.essays}</b><small>写过的作文</small></div></div>
      </div>

      <div class="section-title"><h2>✅ 今日任务</h2><span class="more">完成 ${doneCount} / 3</span></div>
      <div class="task-list">
        ${taskRows.map(function (t) {
          return `<div class="task-item ${tasks[t.key] ? 'done' : ''}" style="border-left-color:${tasks[t.key] ? 'var(--green)' : t.color}">
            <div class="task-check">✓</div>
            <div class="task-info"><div class="task-name">${t.icon} ${t.name}</div><div class="task-desc">${t.desc}</div></div>
            <button class="task-go" data-act="go" data-page="${t.page}">${tasks[t.key] ? '已完成' : '去完成 →'}</button>
          </div>`;
        }).join('')}
      </div>

      <div class="section-title"><h2>🚀 学习模块</h2><span class="more">点一点，马上开始</span></div>
      <div class="module-grid">
        <button class="module-card mc-1" data-act="go" data-page="basic"><span class="m-arrow">→</span><div class="m-ico">拼音 · 字词 · 成语 · 病句</div><h3>基础巩固</h3><p>6 类专项练习，把基础打扎实</p></button>
        <button class="module-card mc-2" data-act="go" data-page="reading"><span class="m-arrow">→</span><div class="m-ico">📖</div><h3>阅读提升</h3><p>短文配理解题，学会抓住关键信息</p></button>
        <button class="module-card mc-3" data-act="go" data-page="writing"><span class="m-arrow">→</span><div class="m-ico">✍️</div><h3>写作工坊</h3><p>素材、框架、范文、智能点评全都有</p></button>
        <button class="module-card mc-4" data-act="go" data-page="growth"><span class="m-arrow">→</span><div class="m-ico">🏅</div><h3>成长记录</h3><p>看看自己攒下的星星和徽章</p></button>
      </div>

      ${S.wrongBook.length ? `
      <div class="section-title"><h2>📌 错题回顾</h2><span class="more">共 ${S.wrongBook.length} 道，温故知新</span></div>
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="font-size:13px;color:var(--ink-2)">最近错的是：<b>${esc(S.wrongBook[0].q).slice(0, 40)}</b></div>
        <button class="btn btn-ghost btn-sm" data-act="wrongbook">查看错题本</button>
      </div>` : ''}
    `;
  }

  /* ---------------- 练习引擎 ---------------- */
  const BASIC_TYPES = {
    pinyin: { name: '看拼音写词语', icon: '🔤', desc: '读准拼音，写出正确的词语', build: function () {
      return D.pinyinWords.map(function (x) { return { q: x.p, a: x.a, why: x.tip, fill: true, hint: x.tip }; });
    }, tip: ['读拼音时先看清声调，再想想学过的词语。', '写完后默读一遍，检查有没有错别字。'] },
    chars: { name: '选字填空', icon: '✏️', desc: '形近字最容易混，放进句子里辨一辨', build: function () {
      return D.chooseChars.map(function (x) { return { q: x.q, a: x.a, why: x.tip, fill: true }; });
    }, tip: ['先看句子意思，再想这个字为什么是这个偏旁。', '“辨、辩、辫、瓣”靠中间部分区分：点撇、言、绞丝、瓜。'] },
    idiom: { name: '成语理解', icon: '🏮', desc: '弄懂成语的意思，才能用得恰当', build: function () {
      return D.idioms.map(function (x) { return { q: '「' + x.w + '」的意思是？', opts: x.opts, a: x.a, why: x.ex }; });
    }, tip: ['成语不要只看字面意思，很多都有比喻义。', '记住例句，比死背解释更有效。'] },
    bug: { name: '病句修改', icon: '🩹', desc: '找出句子的问题，学会把话说通顺', build: function () {
      return D['病句'].map(function (x) { return { q: x.q + '<br><span style="font-size:13px;color:var(--ink-3)">下面修改最恰当的一项是？</span>', opts: x.opts, a: x.a, why: x.why }; });
    }, tip: ['常见病因：搭配不当、成分残缺、前后矛盾、重复啰嗦、语序颠倒。', '改病句要“最小改动”，能删一个词就不要换一整句。'] },
    figure: { name: '修辞手法', icon: '🌈', desc: '认出句子用的修辞，体会表达的好处', build: function () {
      return D.figures.map(function (x) { return { q: x.q + '<br><span style="font-size:13px;color:var(--ink-3)">这句话运用了什么修辞手法？</span>', opts: x.opts, a: x.a, why: x.why }; });
    }, tip: ['比喻要有本体和喻体；拟人是把物当人写。', '反问的答案在句中，设问是自问自答。'] },
    conjunction: { name: '关联词填空', icon: '🔗', desc: '分清句子关系，选对关联词', build: function () {
      return D.conjunctions.map(function (x) { return { q: x.q + '<br><span style="font-size:13px;color:var(--ink-3)">填入哪组关联词最合适？</span>', opts: x.opts, a: x.a, why: '先判断前后分句的关系，再选对应的关联词。' }; });
    }, tip: ['常见关系：因果、转折、递进、条件、假设、并列。', '代入读一遍，通顺自然的就是正确答案。'] }
  };

  function startQuiz(type, context) {
    let cfg;
    if (type.indexOf('unit:') === 0) {
      const parts = type.split(':');
      const u = D.textbook[parts[1]][Number(parts[2])];
      cfg = {
        name: parts[1] + ' 第' + u.unit + '单元 · ' + u.theme,
        list: u.questions.map(function (q) { return Object.assign({}, q); }),
        tip: [u.focus, '练习后回到课文里找一找对应的句子，印象更深。']
      };
    } else if (type.indexOf('reading') === 0) {
      const r = D.readings[parseInt(type.slice(7), 10)];
      cfg = {
        name: '阅读理解的 ' + r.title,
        list: r.questions.map(function (q) { return { q: q.q, opts: q.opts, a: q.a, why: q.why }; }),
        tip: ['答案一般能在原文中找到，先回到文章里定位。', '概括题要用自己的话，但不要偏离原文意思。']
      };
    } else {
      const base = BASIC_TYPES[type];
      cfg = { name: base.name, list: base.build(), tip: base.tip };
    }
    const list = cfg.list.map(function (q) { return Object.assign({}, q); });
    // 固定顺序，方便复习；选择题选项不打乱以免答案含义变化
    quiz = { type: type, context: context, name: cfg.name, list: list, i: 0, correct: 0, answered: false, wrong: [], tip: cfg.tip, hwPendingAnswer: false, hwImage: '' };
    render();
  }

  function answerText(q) {
    if (q.fill) return q.a;
    return q.opts[q.a];
  }

  function submitAnswer(value, selfCheck) {
    if (!quiz || quiz.answered) return;
    const q = quiz.list[quiz.i];
    let ok;
    if (q.fill) {
      if (selfCheck === true || selfCheck === false) {
        ok = selfCheck;
        q.userAnswer = '手写';
      } else {
        const user = String(value || '').trim().replace(/\s/g, '');
        ok = user === q.a.replace(/\s/g, '');
        q.userAnswer = String(value || '').trim();
      }
    } else {
      ok = Number(value) === q.a;
    }
    quiz.answered = true;
    if (ok) {
      quiz.correct++;
      addStars(quiz.context === 'reading' ? 3 : 2);
    } else {
      quiz.wrong.push({ type: quiz.name, q: q.fill ? q.q : q.q.replace(/<br>.*/, ''), a: answerText(q), user: q.fill ? q.userAnswer : q.opts[Number(value)], why: q.why || '', time: today() });
    }
    renderQuizArea();
  }

  /* 手写板：田字格中用手指/鼠标书写，写完自评对照 */
  let handwritingMode = localStorage.getItem('yuduoduo_handwriting') !== '0';
  let hwStrokes = [];
  let hwDrawing = false;
  let hwCanvasEl = null;

  function hwSetup() {
    const cv = $('#hw-canvas');
    if (!cv) { hwCanvasEl = null; hwStrokes = []; return; }
    hwCanvasEl = cv;
    hwStrokes = [];
    const wrap = cv.parentElement;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = rect.width * dpr;
    cv.height = rect.height * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2E3352';

    function pos(e) {
      const r = cv.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      return { x: p.clientX - r.left, y: p.clientY - r.top };
    }
    function start(e) {
      e.preventDefault();
      hwDrawing = true;
      const pt = pos(e);
      hwStrokes.push([pt]);
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x + 0.1, pt.y + 0.1);
      ctx.stroke();
    }
    function move(e) {
      if (!hwDrawing) return;
      e.preventDefault();
      const pt = pos(e);
      hwStrokes[hwStrokes.length - 1].push(pt);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    }
    function end(e) { if (hwDrawing) { e.preventDefault(); hwDrawing = false; } }
    cv.addEventListener('mousedown', start);
    cv.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    cv.addEventListener('touchstart', start, { passive: false });
    cv.addEventListener('touchmove', move, { passive: false });
    cv.addEventListener('touchend', end, { passive: false });
  }
  function hwRedraw() {
    if (!hwCanvasEl) return;
    const ctx = hwCanvasEl.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, hwCanvasEl.width, hwCanvasEl.height);
    ctx.scale(dpr, dpr);
    hwStrokes.forEach(function (stroke) {
      if (!stroke.length) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      stroke.forEach(function (p) { ctx.lineTo(p.x, p.y); });
      ctx.stroke();
    });
  }
  function hwClear() {
    hwStrokes = [];
    hwRedraw();
  }
  function hwUndo() {
    hwStrokes.pop();
    hwRedraw();
  }
  function hwDone() {
    if (!hwStrokes.length) { toast('先在田字格里写一写吧～'); return; }
    const cv = $('#hw-canvas');
    quiz.hwImage = cv ? cv.toDataURL('image/png') : '';
    quiz.hwPendingAnswer = true;
    renderQuizArea();
  }

  function nextQuestion() {
    if (!quiz) return;
    if (quiz.i < quiz.list.length - 1) {
      quiz.i++;
      quiz.answered = false;
      quiz.hwPendingAnswer = false;
      quiz.hwImage = '';
      renderQuizArea();
    } else {
      finishQuiz();
    }
  }

  function finishQuiz() {
    const total = quiz.list.length;
    const correct = quiz.correct;
    const score = Math.round(correct / total * 100);
    let extra = 5;
    if (correct === total) { extra += 5; S.stats.perfect++; }
    addStars(extra);
    S.stats.basicTotal += total;
    S.stats.basicCorrect += correct;
    const key = quiz.type;
    const meta = { type: key, name: quiz.name, total: total, correct: correct };
    if (!S.stats.byType[key]) S.stats.byType[key] = { name: quiz.name, total: 0, correct: 0 };
    S.stats.byType[key].total += total;
    S.stats.byType[key].correct += correct;
    S.wrongBook = quiz.wrong.concat(S.wrongBook).slice(0, 50);
    if (quiz.context === 'reading') {
      S.stats.readingSets++;
      S.daily.tasks.reading = true;
      logHistory('🔍', '完成阅读《' + D.readings[parseInt(quiz.type.slice(7), 10)].title + '》', score + '分', meta);
    } else if (quiz.context === 'drill') {
      S.daily.tasks.basic = true;
      logHistory('🎯', '完成 AI 针对性训练', score + '分', meta);
    } else {
      S.stats.basicSets++;
      S.daily.tasks.basic = true;
      logHistory('📖', '完成《' + quiz.name + '》练习', score + '分', meta);
    }
    save();
    quiz.finished = true;
    renderQuizArea();
    renderTopStats();
  }

  function quizHTML() {
    if (!quiz) return '';
    if (quiz.finished) {
      const total = quiz.list.length;
      const score = Math.round(quiz.correct / total * 100);
      const emoji = score === 100 ? '🏆' : score >= 80 ? '🎉' : score >= 60 ? '👍' : '💪';
      const word = score === 100 ? '太棒了，全对！' : score >= 80 ? '做得很好！' : score >= 60 ? '不错，继续加油！' : '别灰心，错的题记住就好！';
      return `<div class="quiz-card result-card">
        <div class="result-emoji">${emoji}</div>
        <h3>${word}</h3>
        <p>本套练习《${esc(quiz.name)}》已完成</p>
        <div class="result-score">${score}<small> 分</small></div>
        <p>答对 ${quiz.correct} 题 / 共 ${total} 题　·　获得 ${5 + (score === 100 ? 5 : 0)} 颗星星</p>
        ${quiz.wrong.length ? `<p style="margin-top:8px">有 ${quiz.wrong.length} 道题进了错题本，记得回头看看哦。</p>` : ''}
        <div class="quiz-actions" style="justify-content:center;margin-top:24px">
          <button class="btn btn-outline" data-act="go" data-page="${quiz.context === 'reading' ? 'reading' : quiz.context === 'drill' ? 'growth' : 'basic'}">返回</button>
          <button class="btn btn-primary" data-act="retry">再练一次 🔁</button>
        </div>
      </div>`;
    }

    const q = quiz.list[quiz.i];
    const pct = (quiz.i / quiz.list.length * 100).toFixed(0);
    let body = '';
    const isHW = q.fill && handwritingMode;
    if (q.fill) {
      if (isHW && !quiz.answered) {
        body = `<div class="hw-mode-tip">✍️ 用手指或鼠标在田字格里写字，不用键盘，避免输入法提示答案。</div>
          <div class="hw-board-wrap"><div class="hw-grid"><canvas id="hw-canvas" class="hw-canvas"></canvas></div></div>
          <div class="hw-tools">
            <button class="btn btn-outline btn-sm" data-act="hw-undo">↶ 撤销一笔</button>
            <button class="btn btn-outline btn-sm" data-act="hw-clear">清空重写</button>
          </div>`;
      } else {
        body = `<input class="fill-input" id="fill-answer" placeholder="在这里输入答案" autocomplete="off" value="${esc(q.userAnswer || '')}" ${quiz.answered ? 'disabled' : ''}>`;
      }
      if (!quiz.answered) {
        body += `<div style="margin-top:12px"><button class="hw-toggle" data-act="toggle-handwriting">${isHW ? '改用键盘输入' : '改用手写板 ✍️'}</button></div>`;
      }
    } else {
      body = `<div class="options">${q.opts.map(function (o, i) {
        let cls = 'option';
        if (quiz.answered) {
          cls += ' disabled';
          if (i === q.a) cls += ' correct';
          else if (i === quiz.userChoice) cls += ' wrong';
        }
        return `<button class="${cls}" data-act="answer" data-i="${i}" ${quiz.answered ? 'disabled' : ''}>
          <span class="option-key">${'ABCD'[i]}</span><span>${esc(o)}</span>
        </button>`;
      }).join('')}</div>`;
    }

    let feedback = '';
    if (quiz.answered) {
      const ok = q.fill ? q.selfChecked === true || (q.userAnswer || '').replace(/\s/g, '') === q.a.replace(/\s/g, '') : quiz.userChoice === q.a;
      feedback = `<div class="feedback ${ok ? 'ok' : 'no'}">
        <b>${ok ? '✅ 答对啦！' : '❌ 再看一看'}</b>
        ${ok ? (q.why ? esc(q.why) : '真棒，继续保持！') : '正确答案是：<b style="display:inline">' + esc(answerText(q)) + '</b>' + (q.why ? '<br>' + esc(q.why) : '')}
      </div>
      <div class="quiz-actions"><button class="btn btn-primary" data-act="next">${quiz.i === quiz.list.length - 1 ? '查看结果 🎊' : '下一题 →'}</button></div>`;
    } else if (isHW && quiz.hwPendingAnswer) {
      feedback = `<div class="hw-compare">
        <h4>核对一下：你写的是不是这个词？</h4>
        <div class="hw-answer">${esc(q.a)}</div>
        ${quiz.hwImage ? '<img class="hw-mine" src="' + quiz.hwImage + '" alt="我写的字">' : ''}
        <div style="font-size:11.5px;color:var(--ink-2);margin-top:8px">对照上面的正确答案，诚实判断自己写对了没有。</div>
        <div class="hw-self-btns">
          <button class="btn hw-self-yes" data-act="hw-self" data-ok="1">✅ 我写对了</button>
          <button class="btn hw-self-no" data-act="hw-self" data-ok="0">❌ 写错了</button>
        </div>
      </div>`;
    } else if (isHW) {
      feedback = `<div class="quiz-actions"><button class="btn btn-primary" data-act="hw-done">我写好了 ✓</button></div>`;
    } else if (q.fill) {
      feedback = `<div class="quiz-actions"><button class="btn btn-primary" data-act="submit-fill">确定 ✓</button></div>`;
    }

    return `<div class="quiz-card">
      <div class="quiz-head">
        <span class="tag tag-purple">${esc(quiz.name)}</span>
        <span class="quiz-progress-text">第 ${quiz.i + 1} / ${quiz.list.length} 题　·　已答对 ${quiz.correct} 题</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="quiz-q"><span class="q-num">Q${quiz.i + 1}.</span> ${q.q}</div>
      ${body}
      ${feedback}
    </div>`;
  }

  function sidePanelHTML(tip) {
    return `<div class="side-panel">
      <div class="panel-card"><h3>💡 答题小提示</h3>${(tip || []).map(function (t) { return '<div class="tip-line">' + esc(t) + '</div>'; }).join('')}</div>
      <div class="panel-card"><div class="score-ring"><b>${S.stars}</b><span>我攒下的星星 ⭐</span></div></div>
      <div class="panel-card"><h3>🎯 小贴士</h3><div class="tip-line">做错的题会自动收进错题本，在「成长记录」里可以随时复习。</div></div>
    </div>`;
  }

  /* ---------------- 基础巩固页 ---------------- */
  function renderBasic() {
    let main = '', tip = [];
    if (basicTab === 'textbook') {
      const u = D.textbook[textbookBook][textbookUnit];
      const typeKey = 'unit:' + textbookBook + ':' + textbookUnit;
      const activeQuiz = quiz && quiz.context === 'basic' && quiz.type === typeKey;
      if (textbookUnit !== null) {
        tip = [u.focus, '练习后回到课文里找一找对应的句子，印象更深。'];
        main = `<button class="unit-back" data-act="unit-back">← 返回单元列表</button>
          <div class="unit-detail-head">
            <h2>第 ${u.unit} 单元 · ${esc(u.theme)}</h2>
            <p>${esc(u.lessons)}</p>
            <p style="margin-top:5px;color:var(--primary-dark)">🎯 ${esc(u.focus)}</p>
          </div>
          ${activeQuiz ? quizHTML() : `<div class="quiz-card">
            <div style="font-size:38px">📚</div>
            <h2 style="font-size:19px;margin:8px 0 6px">本单元同步练习</h2>
            <p style="color:var(--ink-2);font-size:14px">共 ${u.questions.length} 道题，围绕本单元课文与知识点编写。</p>
            <div class="quiz-actions" style="justify-content:flex-start;margin-top:18px">
              <button class="btn btn-primary" data-act="start-unit" data-book="${textbookBook}" data-u="${textbookUnit}">开始练习 →</button>
            </div>
          </div>`}`;
      } else {
        tip = ['按教材单元练习，复习时更有针对性。', '做完一个单元，记得回到错题本看看。'];
        main = `<div class="textbook-switch">
            <button class="tab-btn ${textbookBook === '五上' ? 'active' : ''}" data-act="textbook-book" data-book="五上">📗 五年级上册</button>
            <button class="tab-btn ${textbookBook === '五下' ? 'active' : ''}" data-act="textbook-book" data-book="五下">📘 五年级下册</button>
          </div>
          <div class="unit-grid">${D.textbook[textbookBook].map(function (u, i) {
            return `<button class="unit-card" data-act="textbook-unit" data-i="${i}">
              <div class="unit-top"><span class="unit-num">第 ${u.unit} 单元</span><span class="tag tag-green">${u.questions.length} 题</span></div>
              <h3>${esc(u.theme)}</h3>
              <div class="unit-lessons">${esc(u.lessons)}</div>
              <div class="unit-focus">🎯 ${esc(u.focus)}</div>
            </button>`;
          }).join('')}</div>`;
      }
    } else {
      const type = BASIC_TYPES[basicTab];
      const activeQuiz = quiz && quiz.context === 'basic' && quiz.type === basicTab;
      tip = type.tip;
      main = activeQuiz ? quizHTML() : `<div class="quiz-card">
        <div style="font-size:42px">${type.icon}</div>
        <h2 style="font-size:20px;margin:8px 0 6px">${type.name}</h2>
        <p style="color:var(--ink-2);font-size:14px">${type.desc}</p>
        <div style="background:var(--primary-soft);border-radius:12px;padding:14px 16px;margin:18px 0;font-size:13px;color:var(--primary-dark);line-height:1.8">
          📌 本套共 ${type.build().length} 道题。答对得星星，全对还有额外奖励！
        </div>
        <button class="btn btn-primary" data-act="start-basic" data-type="${basicTab}">开始练习 →</button>
      </div>`;
    }
    $('#page-container').innerHTML = `
      <div class="tabs">
        <button class="tab-btn ${basicTab === 'textbook' ? 'active' : ''}" data-act="basic-tab" data-tab="textbook">📚 教材同步</button>
        ${Object.keys(BASIC_TYPES).map(function (k) {
          return `<button class="tab-btn ${k === basicTab ? 'active' : ''}" data-act="basic-tab" data-tab="${k}">${BASIC_TYPES[k].icon} ${BASIC_TYPES[k].name}</button>`;
        }).join('')}
      </div>
      <div class="quiz-layout"><div>${main}</div>${sidePanelHTML(tip)}</div>`;
  }

  function renderQuizArea() {
    if (page === 'basic') renderBasic();
    else if (page === 'reading') renderReading();
    else if (page === 'drill') renderDrill();
    hwSetup();
  }

  /* ---------------- 阅读提升页 ---------------- */
  function renderReading() {
    const r = D.readings[readingTab];
    const typeKey = 'reading' + readingTab;
    const activeQuiz = quiz && quiz.context === 'reading' && quiz.type === typeKey;
    $('#page-container').innerHTML = `
      <div class="tabs">${D.readings.map(function (item, i) {
        return `<button class="tab-btn ${i === readingTab ? 'active' : ''}" data-act="reading-tab" data-i="${i}">📄 ${item.title}</button>`;
      }).join('')}</div>
      <div class="quiz-layout">
        <div>
          <div class="article-card">
            <div class="article-title">${esc(r.title)}</div>
            <div class="article-meta">短篇阅读 · 建议先通读两遍再答题</div>
            <div class="article-body">${r.text.split('\n').map(function (p) { return p.trim() ? '<p>' + esc(p) + '</p>' : ''; }).join('')}</div>
            <div class="article-actions">
              ${activeQuiz ? '' : `<button class="btn btn-primary" data-act="start-reading" data-type="${typeKey}">我读完了，开始答题 →</button>`}
            </div>
          </div>
          ${activeQuiz ? '<div style="margin-top:20px">' + quizHTML() + '</div>' : ''}
        </div>
        ${sidePanelHTML(['第一遍读懂内容，第二遍划出关键词。', '答题时先找原文依据，再写自己的理解。', '遇到“为什么”“体现了什么”，要多想一层。'])}
      </div>`;
  }

  /* ---------------- 写作工坊页 ---------------- */
  const WRITE_TABS = [
    { key: 'material', icon: '🧰', name: '素材宝库' },
    { key: 'frame', icon: '🏗️', name: '写作框架' },
    { key: 'essay', icon: '📚', name: '范文赏析' },
    { key: 'practice', icon: '✍️', name: '我的练笔' }
  ];

  function renderWriting() {
    const cfg = AIHelper.getConfig();
    const aiOn = AIHelper.isConfigured();
    const aiName = aiOn ? (AIHelper.PRESETS[cfg.preset] ? AIHelper.PRESETS[cfg.preset].name : '自定义接口') : '未配置';
    $('#page-container').innerHTML = `
      <div class="sub-tabs">${WRITE_TABS.map(function (t) {
        return `<button class="sub-tab ${t.key === writingTab ? 'active' : ''}" data-act="write-tab" data-tab="${t.key}">${t.icon} ${t.name}</button>`;
      }).join('')}</div>
      <div class="ai-bar">
        <div>🤖 <b>AI 深度批改</b>：<span class="ai-dot ${aiOn ? 'on' : ''}"></span>${aiOn ? '已接入 ' + esc(aiName) : '未配置，当前使用本地点评'}</div>
        <button class="btn btn-outline btn-sm" data-act="ai-settings">⚙️ ${aiOn ? '修改设置' : '配置接口'}</button>
      </div>
      <div id="write-content"></div>`;
    const box = $('#write-content');
    if (writingTab === 'material') box.innerHTML = renderMaterials();
    else if (writingTab === 'frame') box.innerHTML = renderFrames();
    else if (writingTab === 'essay') box.innerHTML = renderEssays();
    else box.innerHTML = renderPractice();
  }

  function renderMaterials() {
    const m = D.materials[materialTab];
    return `
      <div class="tabs">${Object.keys(D.materials).map(function (k) {
        return `<button class="tab-btn ${k === materialTab ? 'active' : ''}" data-act="material-tab" data-tab="${k}">${D.materials[k].icon} ${k}</button>`;
      }).join('')}</div>
      <div class="material-grid">
        <div class="material-card">
          <div class="material-head"><span class="mi">📝</span><h3>好词积累</h3><span class="tag tag-purple">点一下可复制</span></div>
          <div class="word-cloud">${m.words.map(function (w) { return `<span class="word-chip" data-act="copy-word" data-w="${esc(w)}">${esc(w)}</span>`; }).join('')}</div>
        </div>
        <div class="material-card">
          <div class="material-head"><span class="mi">💎</span><h3>好句欣赏</h3></div>
          <ul class="sentence-list">${m.sentences.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('')}</ul>
        </div>
        <div class="material-card">
          <div class="material-head"><span class="mi">🚪</span><h3>精彩开头</h3></div>
          <ul class="sentence-list">${m.openings.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('')}</ul>
        </div>
        <div class="material-card">
          <div class="material-head"><span class="mi">🏁</span><h3>巧妙结尾</h3></div>
          <ul class="sentence-list">${m.endings.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('')}</ul>
        </div>
      </div>
      <div class="card" style="margin-top:16px;background:linear-gradient(135deg,#FFF9EF,#FFF4E6)">
        <div style="font-size:13.5px;color:#A9642E;line-height:1.9">
          💡 <b>怎么用素材？</b> 好词好句不是搬进作文就行。先想清楚自己要写什么，再挑合适的词句，把它们变成“你的话”。用得恰当才是加分，硬塞反而显得不自然。
        </div>
      </div>`;
  }

  function renderFrames() {
    return D.frames.map(function (f) {
      return `<div class="frame-card" style="margin-bottom:16px">
        <div class="frame-head"><span class="fi">${f.icon}</span><h3>${f.name}</h3><span class="tag tag-orange">${f.tag}</span></div>
        <p class="frame-desc">${f.desc}</p>
        <div class="step-list">${f.steps.map(function (s, i) {
          return `<div class="step-item"><span class="step-num">${i + 1}</span>${esc(s)}</div>`;
        }).join('')}</div>
        <div class="frame-tip">🌟 ${esc(f.tip)}</div>
      </div>`;
    }).join('');
  }

  function renderEssays() {
    return `<div class="essay-list">${D.essays.map(function (e) {
      return `<div class="essay-card">
        <div class="essay-head"><div><h3>${esc(e.title)}</h3><span class="tag tag-purple">${e.type}</span></div><span class="tag tag-green">${e.words} 字左右</span></div>
        <div class="essay-body">${esc(e.content)}</div>
        <div class="highlights"><h4>🔎 亮点在哪里？</h4>${e.highlights.map(function (h) {
          return `<div class="hl-item"><b>“${esc(h.text)}”</b>${esc(h.why)}</div>`;
        }).join('')}</div>
      </div>`;
    }).join('')}</div>`;
  }

  /* ---------------- 智能点评引擎 ---------------- */
  function analyzeEssay(title, content) {
    const text = (content || '').trim();
    const plain = text.replace(/\s/g, '');
    const len = plain.length;
    const paras = text.split(/\n+/).filter(function (p) { return p.trim().length > 0; });
    const allWords = [];
    Object.keys(D.materials).forEach(function (k) { D.materials[k].words.forEach(function (w) { allWords.push(w); }); });
    const found = allWords.filter(function (w, i) { return text.indexOf(w) >= 0 && allWords.indexOf(w) === i; });
    const simile = /像|仿佛|好像|宛如|好似/.test(text);
    const dialogue = /[""]/.test(text) || /(说|问|喊|叫|道)[:：]/.test(text);
    const marks = (text.match(/[，。！？；：、""'']/g) || []).length;
    const goodMarks = len > 0 && marks >= len / 22;
    const items = [];
    let score = 0;

    if (title.trim()) { score += 5; items.push({ t: 'good', title: '标题完整', text: '「' + esc(title.trim()) + '」这个标题很清楚，读者一眼就知道你要写什么。' }); }
    else items.push({ t: 'warn', title: '还没有标题', text: '给作文起个合适的题目吧，比如“记一次拔河比赛”“我的好朋友”。' });

    if (len >= 400) { score += 15; items.push({ t: 'good', title: '字数充实（' + len + ' 字）', text: '内容写得很充分，五年级作文这个长度很棒！' }); }
    else if (len >= 300) { score += 11; items.push({ t: 'good', title: '字数达标（' + len + ' 字）', text: '字数基本够了，如果把重点部分再写具体一点会更好。' }); }
    else if (len >= 200) { score += 6; items.push({ t: 'warn', title: '字数偏少（' + len + ' 字）', text: '重点段落可以再加些细节：人物说了什么、做了什么、心里想什么。' }); }
    else items.push({ t: 'warn', title: '内容太少（' + len + ' 字）', text: '先把事情或景物的样子写清楚，试着写到 300 字以上。' });

    if (paras.length >= 4) { score += 10; items.push({ t: 'good', title: '段落清楚（' + paras.length + ' 段）', text: '分段合理，读起来不累，说明你已经有了结构意识。' }); }
    else if (paras.length >= 3) { score += 7; items.push({ t: 'good', title: '有分段（' + paras.length + ' 段）', text: '开头、中间、结尾分开了，结构清楚。' }); }
    else if (paras.length === 2) { score += 4; items.push({ t: 'warn', title: '段落偏少', text: '试着按“事情发展的不同阶段”分成 3～4 段。' });
    } else items.push({ t: 'warn', title: '还没有分段', text: '一段到底会让人读不下去。按开头、经过、结尾分成几段吧。' });

    if (found.length >= 3) { score += 10; items.push({ t: 'good', title: '好词用得不错', text: '用了 ' + found.length + ' 个积累过的词语：' + found.slice(0, 8).join('、') + '。' }); }
    else if (found.length >= 1) { score += 6; items.push({ t: 'good', title: '有好词意识', text: '用到了：' + found.join('、') + '。再多用一两个就更精彩了。' }); }
    else items.push({ t: 'warn', title: '缺少亮点词语', text: '去素材宝库挑 2～3 个合适的词，用在最关键的句子里。' });

    if (simile) { score += 8; items.push({ t: 'good', title: '用了比喻', text: '“像、仿佛”这类词让画面更生动，继续用！' }); }
    else items.push({ t: 'warn', title: '可以试试比喻', text: '把看到的写成“像什么”，比如“月亮像弯弯的小船”。' });

    if (dialogue) { score += 5; items.push({ t: 'good', title: '有人物语言', text: '写人物时加入对话，人物就“活”起来了。' }); }
    else items.push({ t: 'warn', title: '缺少人物对话', text: '写人记事时，让人物说一句话，比单纯描写更生动。' });

    if (goodMarks) { score += 7; items.push({ t: 'good', title: '标点使用得当', text: '逗号、句号用得比较到位，读起来很顺畅。' }); }
    else items.push({ t: 'warn', title: '注意标点', text: '一句话说完要加句号，较长的句子中间用逗号停一停。' });

    if (/[！!]{2,}/.test(text)) items.push({ t: 'warn', title: '感叹号别连用', text: '连续多个感叹号会显得不够自然，一个就够啦。' });
    score = Math.min(100, score);

    const level = score >= 90 ? '优秀' : score >= 75 ? '良好' : score >= 60 ? '及格' : '加油';
    return { score: score, level: level, found: found, items: items };
  }

  function renderPractice() {
    const saved = S.essays;
    return `<div class="writer-layout">
      <div class="editor-card">
        <input class="editor-title-input" id="essay-title" placeholder="给作文起个题目吧…" maxlength="40">
        <textarea class="editor-area" id="essay-content" placeholder="在这里写下你的作文。\n\n小提示：\n· 写事：交代清楚时间、地点、人物、起因、经过、结果\n· 写人：用一两件事写出他的特点\n· 写景：调动眼睛、耳朵、鼻子、手去观察"></textarea>
        <div class="editor-bar">
          <div class="char-count">正文 <b id="char-count">0</b> 字　·　建议 300 字以上</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-outline btn-sm" data-act="clear-essay">清空</button>
            <button class="btn btn-ghost btn-sm" data-act="analyze">本地点评 ✨</button>
            <button class="btn btn-primary btn-sm" data-act="ai-analyze">🤖 AI 深度批改</button>
            <button class="btn btn-outline btn-sm" data-act="save-essay">保存作文</button>
          </div>
        </div>
      </div>
      <div>
        <div class="analysis-card" id="analysis-card">
          <div class="analysis-head"><h3>✨ 智能点评</h3><span class="tag tag-purple">写完后点一点</span></div>
          <p style="font-size:12.5px;color:var(--ink-3);line-height:1.8">写完作文后点击「智能点评」，会从字数、段落、好词、修辞、标点等方面给出建议，帮你发现自己的进步和可以改进的地方。</p>
        </div>
        <div class="analysis-card saved-essays" style="margin-top:14px">
          <div class="analysis-head"><h3>📁 我的作文</h3><span class="tag tag-green">${saved.length} 篇</span></div>
          ${saved.length ? saved.map(function (e, i) {
            return `<div class="saved-item"><span title="${esc(e.title)}">${esc(e.title)} · ${e.score}分</span>
              <span style="display:flex;gap:8px;flex-shrink:0"><button data-act="load-essay" data-i="${i}" style="color:var(--primary)">打开</button><button data-act="del-essay" data-i="${i}">删除</button></span></div>`;
          }).join('') : '<p style="font-size:12px;color:var(--ink-3)">还没有保存的作文，写完第一篇就能看到啦。</p>'}
        </div>
      </div>
    </div>`;
  }

  function renderLocalReview(r) {
    $('#analysis-card').className = 'analysis-card';
    $('#analysis-card').innerHTML = `
      <div class="analysis-head"><h3>✨ 本地智能点评</h3><div class="analysis-score">${r.score}<small> / 100</small></div></div>
      <div style="font-size:12.5px;color:var(--ink-2);margin-bottom:6px">综合评价：<b style="color:var(--primary)">${r.level}</b>　·　继续保持，每一次练习都在进步！</div>
      ${r.items.map(function (it) {
        return `<div class="analysis-item ${it.t}"><div class="ai-title">${it.t === 'good' ? '✅' : '💡'} ${it.title}</div><div style="color:var(--ink-2)">${it.text}</div></div>`;
      }).join('')}`;
  }

  function renderAIReview(r) {
    $('#analysis-card').className = 'analysis-card ai-review';
    $('#analysis-card').innerHTML = `
      <div class="analysis-head"><h3>🤖 AI 深度批改</h3><div class="analysis-score">${r.score}<small> / 100</small></div></div>
      <div class="ai-summary">${esc(r.summary)}</div>
      <div class="ai-section"><h4>🌟 写得好的地方</h4>${r.highlights.length ? r.highlights.map(function (h) { return '<div class="ai-line good">' + esc(h) + '</div>'; }).join('') : '<div class="ai-line good">继续保持写作热情！</div>'}</div>
      <div class="ai-section"><h4>💡 下次可以更好</h4>${r.suggestions.length ? r.suggestions.map(function (s) { return '<div class="ai-line tip">' + esc(s) + '</div>'; }).join('') : '<div class="ai-line tip">整体写得不错，再注意细节就更好啦。</div>'}</div>
      ${r.rewrite ? '<div class="ai-section"><h4>✏️ 修改示例</h4><div class="ai-line rewrite">' + esc(r.rewrite) + '</div></div>' : ''}
      <div class="ai-source">AI 评语仅供参考，老师的话才是最重要的 🌷</div>`;
  }

  async function updateAnalysis(useAI) {
    const title = $('#essay-title') ? $('#essay-title').value : '';
    const content = $('#essay-content') ? $('#essay-content').value : '';
    if (!content.trim()) { toast('先写一点内容，再来点评吧～'); return; }
    if (!useAI || !AIHelper.isConfigured()) {
      lastAIReview = null;
      renderLocalReview(analyzeEssay(title, content));
      toast('点评完成，看看老师说了什么！');
      return;
    }
    $('#analysis-card').className = 'analysis-card ai-review';
    $('#analysis-card').innerHTML = '<div class="ai-loading"><div class="spinner"></div>AI 老师正在认真读你的作文…<br><small>首次调用可能需要 10～30 秒</small></div>';
    try {
      const r = await AIHelper.reviewEssay(title, content);
      lastAIReview = r;
      renderAIReview(r);
      toast('AI 批改完成！');
    } catch (err) {
      toast('AI 批改失败：' + err.message);
      lastAIReview = null;
      renderLocalReview(analyzeEssay(title, content));
    }
  }

  function saveEssay() {
    const title = $('#essay-title').value.trim();
    const content = $('#essay-content').value.trim();
    if (!content) { toast('还没写内容呢，先写几句吧～'); return; }
    const r = analyzeEssay(title, content);
    const score = lastAIReview ? lastAIReview.score : r.score;
    S.essays.unshift({ title: title || '无题作文', content: content, score: score, aiReview: lastAIReview, date: today() });
    S.essays = S.essays.slice(0, 30);
    S.stats.essays = S.essays.length;
    S.daily.tasks.writing = true;
    addStars(10);
    logHistory('✍️', '完成作文《' + (title || '无题作文') + '》', score + '分', { score: score });
    save();
    toast('作文已保存，奖励 10 颗星星！');
    renderWriting();
  }

  /* ---------------- 成长记录 ---------------- */
  const BADGES = [
    { icon: '🌱', name: '初出茅庐', desc: '完成 1 套练习', ok: function () { return S.stats.basicSets >= 1; } },
    { icon: '🔥', name: '坚持不懈', desc: '连续学习 3 天', ok: function () { return S.streak >= 3; } },
    { icon: '🏆', name: '满分达人', desc: '练习获得满分', ok: function () { return S.stats.perfect >= 1; } },
    { icon: '🔍', name: '阅读之星', desc: '完成 1 篇阅读', ok: function () { return S.stats.readingSets >= 1; } },
    { icon: '✍️', name: '小小作家', desc: '保存 1 篇作文', ok: function () { return S.stats.essays >= 1; } },
    { icon: '⭐', name: '集星高手', desc: '累计 100 颗星', ok: function () { return S.stars >= 100; } },
    { icon: '📚', name: '练习百题', desc: '累计答 100 道题', ok: function () { return S.stats.basicTotal >= 100; } },
    { icon: '💎', name: '词语大王', desc: '累计答对 80 题', ok: function () { return S.stats.basicCorrect >= 80; } }
  ];

  function renderGrowth() {
    const max = Math.max(10, ...S.weekly);
    const labels = ['一', '二', '三', '四', '五', '六', '日'];
    const unlocked = BADGES.filter(function (b) { return b.ok(); }).length;
    const profile = buildLearningProfile();
    const skillBars = profile.skills.length ? profile.skills.map(function (s) {
      const color = s.rate >= 85 ? 'var(--green)' : s.rate >= 70 ? 'var(--primary)' : 'var(--accent)';
      return '<div class="skill-row"><div class="skill-name">' + esc(s.name) + '</div><div class="skill-track"><div class="skill-fill" style="width:' + s.rate + '%;background:' + color + '"></div></div><div class="skill-rate">' + s.rate + '%</div></div>';
    }).join('') : '<p style="font-size:12.5px;color:var(--ink-3)">还没有足够的练习数据，先去做几套练习吧。</p>';
    const diagHistory = S.diagnoses.length ? '<div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--line)"><div style="font-size:12px;font-weight:700;color:var(--ink-2);margin-bottom:8px">📂 历史诊断（' + S.diagnoses.length + ' 次）</div>' + S.diagnoses.map(function (d, i) {
      return '<div class="saved-item"><span>' + d.date + ' · ' + esc(d.result.level) + '</span><button data-act="diagnosis-history" data-i="' + i + '" style="color:var(--primary)">查看</button></div>';
    }).join('') + '</div>' : '';
    $('#page-container').innerHTML = `
      <div class="growth-top">
        <div class="growth-stat"><div class="gi">⭐</div><b>${S.stars}</b><small>累计星星</small></div>
        <div class="growth-stat"><div class="gi">🔥</div><b>${S.streak}</b><small>连续学习天数</small></div>
        <div class="growth-stat"><div class="gi">📝</div><b>${S.stats.basicTotal}</b><small>累计答题数</small></div>
      </div>

      <div class="section-title"><h2>📈 最近一周的星星</h2><span class="more">坚持每天学一点</span></div>
      <div class="chart-card">
        <div class="bar-chart">${S.weekly.map(function (v, i) {
          return `<div class="bar-col"><span class="bar-num">${v || ''}</span><div class="bar" style="height:${Math.max(4, v / max * 120)}px"></div><small>周${labels[i]}</small></div>`;
        }).join('')}</div>
      </div>

      <div class="section-title"><h2>🏅 我的徽章</h2><span class="more">已解锁 ${unlocked} / ${BADGES.length}</span></div>
      <div class="badge-grid">${BADGES.map(function (b) {
        return `<div class="badge-item ${b.ok() ? '' : 'locked'}"><div class="bi">${b.icon}</div><b>${b.name}</b><small>${b.desc}</small></div>`;
      }).join('')}</div>

      <div class="section-title"><h2>🧠 学情诊断</h2><span class="more">基于全部练习数据的长期分析</span></div>
      <div class="card">
        <div style="font-size:12.5px;color:var(--ink-2);margin-bottom:12px">各题型掌握度（绿色=扎实，紫色=尚可，橙色=需加强）</div>
        ${skillBars}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
          <button class="btn btn-primary btn-sm" data-act="diagnose">🤖 AI 深度学情诊断</button>
          <button class="btn btn-ghost btn-sm" data-act="drill-generate">🎯 生成针对性训练</button>
        </div>
        ${diagHistory}
      </div>

      <div class="section-title"><h2>👨‍👩‍👧 家长周报</h2><span class="more">一键生成本周学习报告</span></div>
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:linear-gradient(135deg,#F2F0FF,#FFF4EC)">
        <div style="font-size:13px;color:var(--ink-2);line-height:1.8">汇总本周星星、练习、阅读与作文情况，分析薄弱点，<br>可生成 AI 评语并打印带给家长。</div>
        <button class="btn btn-primary btn-sm" data-act="report">生成周报 📋</button>
      </div>

      <div class="section-title"><h2>📌 错题本</h2><span class="more">共 ${S.wrongBook.length} 道</span></div>
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="font-size:13px;color:var(--ink-2)">把错题再做一遍，才是真正的掌握。</div>
        <button class="btn btn-ghost btn-sm" data-act="wrongbook">${S.wrongBook.length ? '开始复习' : '暂无错题'}</button>
      </div>

      <div class="section-title"><h2>🕒 学习记录</h2><span class="more">最近 30 条</span></div>
      <div class="history-list">${S.history.length ? S.history.map(function (h) {
        return `<div class="history-row"><div class="hr-left"><span class="hr-icon">${h.icon}</span><div><div>${esc(h.text)}</div><div class="hr-date">${h.date}</div></div></div><span class="hr-score">${esc(h.score)}</span></div>`;
      }).join('') : '<div class="empty" style="padding:30px"><div class="empty-icon">🌱</div>还没有学习记录，去完成第一个任务吧！</div>'}</div>`;
  }

  function showWrongBook() {
    if (!S.wrongBook.length) { toast('太棒了，现在还没有错题！'); return; }
    openModal(`<h3>📌 我的错题本</h3>
      <p style="margin-bottom:12px">共 ${S.wrongBook.length} 道题，看看当时错在哪里。</p>
      <div style="max-height:55vh;overflow:auto">
      ${S.wrongBook.map(function (w, i) {
        return `<div style="padding:12px 0;border-bottom:1px dashed var(--line)">
          <div style="font-size:13px;font-weight:600">${i + 1}. ${esc(w.q).slice(0, 90)}</div>
          <div style="font-size:12px;color:var(--ink-2);margin-top:4px">你的答案：${esc(w.user || '未作答')}　→　正确答案：<b style="color:var(--green)">${esc(w.a)}</b></div>
          ${w.why ? '<div style="font-size:11.5px;color:var(--ink-3);margin-top:4px">' + esc(w.why) + '</div>' : ''}
        </div>`;
      }).join('')}
      </div>
      <div class="modal-actions"><button class="btn btn-primary btn-sm" data-act="close-modal">知道了</button></div>`);
  }

  /* ---------------- 学情画像与针对性训练 ---------------- */
  function buildLearningProfile() {
    const skills = Object.keys(S.stats.byType).map(function (k) {
      const x = S.stats.byType[k];
      return { name: x.name, total: x.total, correct: x.correct, rate: x.total ? Math.round(x.correct / x.total * 100) : 0 };
    }).filter(function (x) { return x.total > 0; }).sort(function (a, b) { return a.rate - b.rate; });
    const wrongCount = {};
    S.wrongBook.forEach(function (w) { wrongCount[w.type] = (wrongCount[w.type] || 0) + 1; });
    const wrongTop = Object.keys(wrongCount).sort(function (a, b) { return wrongCount[b] - wrongCount[a]; }).slice(0, 3);
    const dates = {};
    S.starLog.forEach(function (x) { dates[x.date] = 1; });
    return {
      days: Math.max(1, Object.keys(dates).length),
      total: S.stats.basicTotal,
      streak: S.streak,
      skills: skills,
      wrongTop: wrongTop,
      essayScores: S.essays.slice(0, 10).map(function (e) { return e.score; }),
      reading: S.stats.readingSets
    };
  }

  function startCustomQuiz(questions, name) {
    closeModal();
    quiz = {
      type: 'custom:' + Date.now(), context: 'drill', name: name,
      list: questions.map(function (q) { return Object.assign({}, q); }),
      i: 0, correct: 0, answered: false, wrong: [],
      tip: ['这些题是根据你的薄弱点专门出的，认真做哦。', '做完看解析，把错题记牢，下次就不会再错啦。']
    };
    setPage('drill');
  }

  function renderDrill() {
    if (!quiz || quiz.context !== 'drill') {
      $('#page-container').innerHTML = '<div class="card empty" style="padding:60px 20px"><div class="empty-icon">🎯</div><h3>还没有针对性训练</h3><p>到「成长记录 → 学情诊断」让 AI 分析后，就能生成专属练习。</p><div style="margin-top:16px"><button class="btn btn-primary" data-act="go" data-page="growth">去学情诊断</button></div></div>';
      return;
    }
    $('#page-container').innerHTML = '<div class="quiz-layout"><div>' + quizHTML() + '</div>' + sidePanelHTML(quiz.tip) + '</div>';
  }

  function renderDiagnosisResult(r, fresh) {
    const box = $('#diagnosis-box');
    if (!box) return;
    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px"><span class="tag tag-purple">' + esc(r.level) + '</span><span style="font-size:11.5px;color:var(--ink-3)">' + today() + '</span></div>' +
      '<div class="report-text" style="margin-bottom:14px">' + esc(r.summary) + '</div>' +
      (r.strengths.length ? '<div class="diag-section"><h4>✅ 掌握得好的地方</h4>' + r.strengths.map(function (s) { return '<div class="ai-line good">' + esc(s) + '</div>'; }).join('') + '</div>' : '') +
      (r.weaknesses.length ? '<div class="diag-section"><h4>⚠️ 需要加强</h4>' + r.weaknesses.map(function (w) { return '<div class="diag-weak"><b>' + esc(w.name) + ' · ' + w.rate + '%</b><div>' + esc(w.cause) + '</div><div class="diag-advice">' + esc(w.advice) + '</div></div>'; }).join('') + '</div>' : '') +
      (r.trend ? '<div class="diag-section"><h4>📈 长期趋势</h4><div class="report-text">' + esc(r.trend) + '</div></div>' : '') +
      (r.plan.length ? '<div class="diag-section"><h4>🎯 提升计划</h4>' + r.plan.map(function (p) { return '<div class="diag-plan"><b>第 ' + p.priority + ' 步 · ' + esc(p.focus) + '（' + p.days + ' 天）</b><div>' + esc(p.action) + '</div></div>'; }).join('') + '</div>' : '') +
      (r.encouragement ? '<div class="report-focus">💌 ' + esc(r.encouragement) + '</div>' : '') +
      '<div class="modal-actions">' + (fresh ? '<button class="btn btn-primary btn-sm" data-act="drill-generate">🎯 生成针对性训练题</button>' : '') + '<button class="btn btn-outline btn-sm" data-act="close-modal">关闭</button></div>';
  }

  async function showDiagnosis() {
    if (!AIHelper.isConfigured()) { toast('请先配置 AI 接口'); aiSettings(); return; }
    const profile = buildLearningProfile();
    if (profile.total < 3) { toast('题目练得还太少，先做几套练习再来诊断吧'); return; }
    openModal('<h3>🧠 AI 学情诊断</h3><p>正在分析全部练习数据，请稍候…</p><div id="diagnosis-box"><div class="ai-loading"><div class="spinner"></div>AI 老师正在读你的学习档案…</div></div>', true);
    try {
      const r = await AIHelper.analyzeLearning(profile);
      currentDiagnosis = r;
      S.diagnoses.unshift({ date: today(), result: r });
      S.diagnoses = S.diagnoses.slice(0, 10);
      save();
      renderDiagnosisResult(r, true);
      toast('学情诊断完成');
    } catch (err) {
      $('#diagnosis-box').innerHTML = '<p style="color:var(--red);font-size:13px">诊断失败：' + esc(err.message) + '</p>';
      toast('诊断失败：' + err.message);
    }
  }

  function showDiagnosisHistory(i) {
    const d = S.diagnoses[i];
    if (!d) return;
    currentDiagnosis = d.result;
    openModal('<h3>🧠 学情诊断 · ' + d.date + '</h3><div id="diagnosis-box"></div>', true);
    renderDiagnosisResult(d.result, false);
  }

  async function generateDrill() {
    if (!AIHelper.isConfigured()) { toast('请先配置 AI 接口'); aiSettings(); return; }
    const profile = buildLearningProfile();
    const focus = (currentDiagnosis && currentDiagnosis.weaknesses && currentDiagnosis.weaknesses.length)
      ? currentDiagnosis.weaknesses
      : profile.skills.filter(function (s) { return s.rate < 80; }).slice(0, 3);
    toast('AI 正在出题，请稍候…');
    try {
      const qs = await AIHelper.generateDrill(profile, focus);
      startCustomQuiz(qs, 'AI 针对性训练 · ' + (focus.length ? focus[0].name : '薄弱点'));
      toast('专属练习已生成，开始吧！');
    } catch (err) {
      console.error('[generateDrill]', err);
      toast('出题失败：' + err.message);
    }
  }

  /* ---------------- AI 接口设置 ---------------- */
  function aiSettings() {
    const cfg = AIHelper.getConfig() || { preset: 'deepseek', url: '', model: '', key: '' };
    const preset = cfg.preset || 'deepseek';
    const info = AIHelper.PRESETS[preset] || AIHelper.PRESETS.deepseek;
    const options = Object.keys(AIHelper.PRESETS).map(function (k) {
      return '<option value="' + k + '" ' + (k === preset ? 'selected' : '') + '>' + AIHelper.PRESETS[k].name + '</option>';
    }).join('');
    openModal(`<h3>🤖 AI 批改设置</h3>
      <p>选好服务商后，只需填入 API Key 即可；地址和模型会自动填好。密钥只保存在本机浏览器。</p>
      <div class="form-row"><label>服务商</label><select id="ai-preset">${options}</select><div class="form-tip" id="preset-tip">${esc(info.tip || '')}</div></div>
      <div class="form-row"><label>接口地址（API URL）</label><input id="ai-url" value="${esc(cfg.url || info.url || '')}" placeholder="https://api.deepseek.com/v1/chat/completions"></div>
      <div class="form-row"><label>模型名称</label><input id="ai-model" value="${esc(cfg.model || info.model || '')}" placeholder="deepseek-chat"></div>
      <div class="form-row"><label>API Key</label><input id="ai-key" type="password" value="${esc(cfg.key || '')}" placeholder="sk-..."><div class="form-tip">密钥请到对应服务商平台申请，复制时不要带空格或引号。</div></div>
      <div id="ai-test-result"></div>
      <div class="modal-actions">
        <button class="btn btn-outline btn-sm" data-act="ai-clear">清空</button>
        <button class="btn btn-outline btn-sm" data-act="close-modal">取消</button>
        <button class="btn btn-ghost btn-sm" data-act="ai-test">测试连接</button>
        <button class="btn btn-primary btn-sm" data-act="ai-save">保存设置</button>
      </div>`);
  }
  function collectAIConfig() {
    return {
      preset: $('#ai-preset').value,
      url: $('#ai-url').value.trim(),
      model: $('#ai-model').value.trim(),
      key: $('#ai-key').value.trim()
    };
  }
  function saveAISettings() {
    const cfg = collectAIConfig();
    if (!cfg.url || !cfg.model || !cfg.key) { toast('请把接口地址、模型名和密钥都填上'); return; }
    AIHelper.saveConfig(cfg);
    closeModal();
    if (page === 'writing') renderWriting();
    toast('AI 接口配置已保存');
  }
  async function testAIConnection() {
    const cfg = collectAIConfig();
    const box = $('#ai-test-result');
    if (!cfg.url || !cfg.model || !cfg.key) {
      if (box) box.innerHTML = '<div class="form-tip" style="color:var(--red)">请把接口地址、模型名和 API Key 都填完整。</div>';
      return;
    }
    AIHelper.saveConfig(cfg);
    if (box) box.innerHTML = '<div class="form-tip">正在测试连接，请稍候…</div>';
    try {
      const res = await AIHelper.testConnection();
      if (box) box.innerHTML = '<div class="form-tip" style="color:var(--green)">✅ 连接成功！AI 回复：' + esc(String(res).slice(0, 30)) + '</div>';
      toast('连接成功');
    } catch (err) {
      const msg = String(err.message || err);
      let advice = '';
      if (/401|invalid|authentication|unauthorized/i.test(msg)) advice = '密钥无效或已过期，请检查 Key 是否复制完整、有没有多余空格。';
      else if (/402|balance|insufficient|quota/i.test(msg)) advice = '账户余额不足或没有额度，请到服务商平台充值或开通。';
      else if (/404|not found|model|deploy/i.test(msg)) advice = '模型名或接口地址不正确，请检查模型名是否与你申请的服务匹配。';
      else if (/网络|fetch|failed|timeout|CORS/i.test(msg)) advice = '网络不通或被跨域限制。国内用户建议用 DeepSeek 或通义千问；OpenAI 通常需要代理。';
      if (box) box.innerHTML = '<div class="form-tip" style="color:var(--red)">❌ 连接失败：' + esc(msg) + (advice ? '<br>💡 ' + advice : '') + '</div>';
      toast('连接失败，详情见窗口内提示');
    }
  }

  /* ---------------- 家长周报 ---------------- */
  function fmtDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function buildReportData() {
    const now = new Date();
    const day = (now.getDay() + 6) % 7;
    const mon = new Date(now);
    mon.setDate(now.getDate() - day); mon.setHours(0, 0, 0, 0);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const start = fmtDate(mon), end = fmtDate(sun);
    const hs = S.history.filter(function (h) { return h.date >= start && h.date <= end; });
    const stars = S.starLog.filter(function (x) { return x.date >= start && x.date <= end; }).reduce(function (a, b) { return a + b.n; }, 0);
    let total = 0, correct = 0, sets = 0, reading = 0;
    const essayScores = [];
    const typeMap = {};
    hs.forEach(function (h) {
      if (h.meta && h.meta.total) {
        total += h.meta.total; correct += h.meta.correct;
        const k = h.meta.type || h.meta.name;
        if (!typeMap[k]) typeMap[k] = { name: h.meta.name, total: 0, correct: 0 };
        typeMap[k].total += h.meta.total; typeMap[k].correct += h.meta.correct;
      }
      if (h.icon === '📖') sets++;
      if (h.icon === '🔍') reading++;
      if (h.icon === '✍️' && h.score) {
        const n = parseInt(h.score, 10);
        if (!isNaN(n)) essayScores.push(n);
      }
    });
    const weak = Object.keys(typeMap).map(function (k) {
      const x = typeMap[k];
      return { name: x.name, rate: Math.round(x.correct / x.total * 100), total: x.total };
    }).filter(function (x) { return x.total >= 3; }).sort(function (a, b) { return a.rate - b.rate; })
      .slice(0, 2).map(function (x) { return x.name + '（' + x.rate + '%）'; });
    const dailyStars = [];
    for (let i = 0; i < 7; i++) {
      const dt = fmtDate(new Date(mon.getTime() + i * 86400000));
      dailyStars.push(S.starLog.filter(function (x) { return x.date === dt; }).reduce(function (a, b) { return a + b.n; }, 0));
    }
    return {
      range: start + ' 至 ' + end, stars: stars, sets: sets, total: total, correct: correct,
      accuracy: total ? Math.round(correct / total * 100) : 0,
      reading: reading, essays: essayScores.length,
      avgScore: essayScores.length ? Math.round(essayScores.reduce(function (a, b) { return a + b; }, 0) / essayScores.length) : 0,
      streak: S.streak, weak: weak, dailyStars: dailyStars
    };
  }
  function localReportComment(d) {
    let s = '本周（' + d.range + '），孩子共获得 ' + d.stars + ' 颗星星，完成 ' + d.sets + ' 套基础练习、' + d.reading + ' 篇阅读';
    if (d.essays) s += '，写了 ' + d.essays + ' 篇作文，平均 ' + d.avgScore + ' 分';
    s += '。';
    if (d.total) {
      s += '基础题共作答 ' + d.total + ' 道，正确率 ' + d.accuracy + '%';
      s += d.accuracy >= 85 ? '，掌握得比较扎实。' : '，还有提升空间，建议把错题再练一遍。';
    } else {
      s += '本周还没有基础练习记录，建议每天安排 10 分钟字词句练习。';
    }
    if (d.weak.length) s += '相对薄弱的题型是：' + d.weak.join('、') + '，下周可以多花一点时间。';
    else if (d.total) s += '各题型表现比较均衡，值得表扬！';
    return s;
  }
  function showReport() {
    const d = buildReportData();
    const max = Math.max(10, ...d.dailyStars);
    const labels = ['一', '二', '三', '四', '五', '六', '日'];
    openModal(`<div class="report-paper" id="report-paper">
      <div class="report-header"><div class="ri">📋</div><h2>语文学习周报</h2><p>${d.range}　·　小学五年级</p></div>
      <div class="report-grid">
        <div class="report-stat"><b>${d.stars}</b><small>本周星星</small></div>
        <div class="report-stat"><b>${d.sets}</b><small>基础练习(套)</small></div>
        <div class="report-stat"><b>${d.accuracy}%</b><small>答题正确率</small></div>
        <div class="report-stat"><b>${d.reading}</b><small>阅读篇数</small></div>
        <div class="report-stat"><b>${d.essays}</b><small>作文篇数</small></div>
      </div>
      <div class="report-section"><h3>📊 每日星星分布</h3>
        <div class="report-days">${d.dailyStars.map(function (v, i) {
          return '<div class="report-day"><div class="rnum">' + (v || '') + '</div><div class="rbar" style="height:' + Math.max(3, v / max * 80) + 'px"></div><small>周' + labels[i] + '</small></div>';
        }).join('')}</div>
      </div>
      <div class="report-section"><h3>📝 本周学习小结</h3><div class="report-text">${esc(localReportComment(d))}</div></div>
      <div class="report-section"><h3>🤖 AI 家长评语</h3>
        <div class="report-ai-box" id="report-ai-box"><p style="font-size:12px;color:var(--ink-3)">配置 AI 接口后可生成更贴心的个性化评语；也可以直接使用上面的小结。</p></div>
      </div>
      <div class="modal-actions no-print">
        <button class="btn btn-ghost btn-sm" data-act="report-ai">🤖 生成 AI 评语</button>
        <button class="btn btn-outline btn-sm" data-act="close-modal">关闭</button>
        <button class="btn btn-primary btn-sm" data-act="print-report">🖨️ 打印周报</button>
      </div>
    </div>`, true);
  }
  async function generateReportAI() {
    if (!AIHelper.isConfigured()) { toast('请先在写作工坊配置 AI 接口'); aiSettings(); return; }
    const d = buildReportData();
    $('#report-ai-box').innerHTML = '<div class="ai-loading"><div class="spinner"></div>AI 老师正在整理本周反馈…</div>';
    try {
      const r = await AIHelper.weeklyComment({
        range: d.range, stars: d.stars, sets: d.sets, total: d.total,
        accuracy: d.accuracy, reading: d.reading, essays: d.essays,
        avgScore: d.avgScore, streak: d.streak, weak: d.weak
      });
      $('#report-ai-box').innerHTML =
        (r.focus ? '<div class="report-focus">🌟 本周亮点：' + esc(r.focus) + '</div>' : '') +
        '<div class="report-text">' + esc(r.comment) + '</div>' +
        (r.advice.length ? '<h4 style="font-size:12.5px;margin:12px 0 4px">🏠 给家长的建议</h4>' + r.advice.map(function (a) { return '<div class="report-advice">' + esc(a) + '</div>'; }).join('') : '');
      toast('AI 评语已生成');
    } catch (err) {
      $('#report-ai-box').innerHTML = '<p style="font-size:12px;color:var(--red)">生成失败：' + esc(err.message) + '</p>';
      toast('生成失败：' + err.message);
    }
  }

  /* ---------------- 事件 ---------------- */
  document.addEventListener('click', function (e) {
    const nav = e.target.closest('[data-page]');
    if (nav && !nav.dataset.act) { setPage(nav.dataset.page); return; }

    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;

    if (act === 'go') setPage(t.dataset.page);
    else if (act === 'close-modal') closeModal();
    else if (act === 'wrongbook') showWrongBook();
    else if (act === 'textbook-book') { textbookBook = t.dataset.book; textbookUnit = null; quiz = null; renderBasic(); }
    else if (act === 'textbook-unit') { textbookUnit = Number(t.dataset.i); quiz = null; renderBasic(); }
    else if (act === 'unit-back') { textbookUnit = null; quiz = null; renderBasic(); }
    else if (act === 'start-unit') { startQuiz('unit:' + t.dataset.book + ':' + t.dataset.u, 'basic'); }
    else if (act === 'basic-tab') { basicTab = t.dataset.tab; quiz = null; renderBasic(); }
    else if (act === 'reading-tab') { readingTab = Number(t.dataset.i); quiz = null; renderReading(); }
    else if (act === 'write-tab') { writingTab = t.dataset.tab; renderWriting(); }
    else if (act === 'material-tab') { materialTab = t.dataset.tab; renderWriting(); }
    else if (act === 'start-basic') startQuiz(t.dataset.type, 'basic');
    else if (act === 'start-reading') startQuiz(t.dataset.type, 'reading');
    else if (act === 'answer') {
      quiz.userChoice = Number(t.dataset.i);
      submitAnswer(Number(t.dataset.i));
    }
    else if (act === 'submit-fill') {
      const input = $('#fill-answer');
      submitAnswer(input ? input.value : '');
    }
    else if (act === 'toggle-handwriting') {
      handwritingMode = !handwritingMode;
      localStorage.setItem('yuduoduo_handwriting', handwritingMode ? '1' : '0');
      if (quiz) { quiz.hwPendingAnswer = false; quiz.hwImage = ''; }
      renderQuizArea();
    }
    else if (act === 'hw-undo') hwUndo();
    else if (act === 'hw-clear') hwClear();
    else if (act === 'hw-done') hwDone();
    else if (act === 'hw-self') {
      const ok = t.dataset.ok === '1';
      quiz.list[quiz.i].selfChecked = ok;
      quiz.hwPendingAnswer = false;
      quiz.hwImage = '';
      submitAnswer('', ok);
    }
    else if (act === 'next') nextQuestion();
    else if (act === 'retry') {
      const type = quiz.type, ctx = quiz.context;
      if (ctx === 'drill') startCustomQuiz(quiz.list, quiz.name);
      else startQuiz(type, ctx);
    }
    else if (act === 'copy-word') {
      const w = t.dataset.w;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(w).catch(function () {});
      toast('已复制「' + w + '」，可以用到作文里啦');
    }
    else if (act === 'analyze') updateAnalysis(false);
    else if (act === 'ai-analyze') {
      if (!AIHelper.isConfigured()) { toast('请先配置 AI 接口'); aiSettings(); return; }
      updateAnalysis(true);
    }
    else if (act === 'ai-settings') aiSettings();
    else if (act === 'ai-save') saveAISettings();
    else if (act === 'ai-test') testAIConnection();
    else if (act === 'ai-clear') { AIHelper.clearConfig(); closeModal(); if (page === 'writing') renderWriting(); toast('已清空 AI 配置'); }
    else if (act === 'save-essay') saveEssay();
    else if (act === 'clear-essay') {
      if ($('#essay-content') && $('#essay-content').value && !confirm('确定要清空当前作文吗？')) return;
      $('#essay-title').value = '';
      $('#essay-content').value = '';
      $('#char-count').textContent = '0';
      toast('已清空');
    }
    else if (act === 'load-essay') {
      const e = S.essays[Number(t.dataset.i)];
      if (e) { $('#essay-title').value = e.title; $('#essay-content').value = e.content; updateCharCount(); toast('作文已打开'); }
    }
    else if (act === 'del-essay') {
      const i = Number(t.dataset.i);
      if (!confirm('确定删除这篇作文吗？')) return;
      S.essays.splice(i, 1);
      S.stats.essays = S.essays.length;
      save();
      renderWriting();
      toast('已删除');
    }
    else if (act === 'diagnose') showDiagnosis();
    else if (act === 'drill-generate') generateDrill();
    else if (act === 'diagnosis-history') showDiagnosisHistory(Number(t.dataset.i));
    else if (act === 'back-top') window.scrollTo({ top: 0, behavior: 'smooth' });
    else if (act === 'report') showReport();
    else if (act === 'report-ai') generateReportAI();
    else if (act === 'print-report') window.print();
  });

  document.addEventListener('input', function (e) {
    if (e.target.id === 'essay-content') { updateCharCount(); lastAIReview = null; }
  });
  window.addEventListener('scroll', function () {
    const btn = $('#back-top');
    if (btn) btn.hidden = window.scrollY < 300;
  }, { passive: true });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'ai-preset') {
      const p = AIHelper.PRESETS[e.target.value];
      if (p) {
        $('#ai-url').value = p.url;
        $('#ai-model').value = p.model;
        $('#preset-tip').textContent = p.tip || '';
      }
    }
  });
  function updateCharCount() {
    const el = $('#char-count'), ta = $('#essay-content');
    if (el && ta) el.textContent = ta.value.replace(/\s/g, '').length;
  }

  $('#modal-mask').addEventListener('click', function (e) {
    if (e.target.id === 'modal-mask') closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter' && e.target.id === 'fill-answer' && quiz && !quiz.answered) submitAnswer(e.target.value);
  });

  /* ---------------- 启动 ---------------- */
  checkIn();
  setPage('home');
})();
