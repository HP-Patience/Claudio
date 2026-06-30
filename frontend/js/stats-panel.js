// Claudio FM — 统计面板
import { dom } from './dom.js';

function renderReportContent(data) {
  const existing = dom.statsPanel.querySelectorAll('.stats-report');
  existing.forEach(el => el.remove());

  const card = document.createElement('div');
  card.className = 'stats-report';

  const insight = document.createElement('div');
  insight.className = 'stats-insight';
  insight.textContent = data.insight;
  card.appendChild(insight);

  if (data.stat) {
    const detail = document.createElement('div');
    detail.className = 'stats-detail';
    const stat = data.stat;
    const lines = [
      `总播放: ${stat.totalPlays} 次`,
      `最爱歌手: ${(stat.topArtists || []).map(a => a.name).join(', ') || '—'}`,
      `新发现: ${(stat.newDiscoveries || []).map(d => d.name).join(', ') || '—'}`,
    ];
    detail.textContent = lines.join('  ·  ');
    card.appendChild(detail);
  }

  const genBtn = dom.statsPanel.querySelector('.stats-gen-btn');
  if (genBtn) {
    dom.statsPanel.insertBefore(card, genBtn);
  } else {
    dom.statsPanel.appendChild(card);
  }
}

export async function renderStatsPanel() {
  dom.statsPanel.innerHTML = '<div class="panel-empty">Loading...</div>';
  try {
    const listRes = await fetch('/api/stats/list');
    const listData = await listRes.json();
    const periods = listData.periods || [];
    const currentPeriod = periods[0]?.period || new Date().toISOString().slice(0, 7);

    const res = await fetch('/api/stats?period=' + currentPeriod);
    const data = await res.json();

    dom.statsPanel.innerHTML = '';

    if (periods.length > 1) {
      const sel = document.createElement('select');
      sel.className = 'stats-period-select';
      for (const p of periods) {
        const opt = document.createElement('option');
        opt.value = p.period;
        opt.textContent = p.period;
        opt.selected = p.period === currentPeriod;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', async () => {
        const r = await fetch('/api/stats?period=' + sel.value);
        const d = await r.json();
        renderReportContent(d);
      });
      dom.statsPanel.appendChild(sel);
    }

    if (data.insight) {
      renderReportContent(data);
    } else {
      const empty = document.createElement('div');
      empty.className = 'panel-empty';
      empty.textContent = '暂无报告';
      dom.statsPanel.appendChild(empty);
    }

    const btn = document.createElement('button');
    btn.className = 'stats-gen-btn';
    btn.textContent = '生成本月报告';
    btn.addEventListener('click', async () => {
      btn.textContent = '生成中…';
      btn.disabled = true;
      try {
        const r = await fetch('/api/stats/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        const d = await r.json();
        renderReportContent(d);
      } catch { /* ignore */ } finally {
        btn.textContent = '生成本月报告';
        btn.disabled = false;
      }
    });
    dom.statsPanel.appendChild(btn);
  } catch {
    dom.statsPanel.innerHTML = '<div class="panel-empty">加载失败</div>';
  }
}
