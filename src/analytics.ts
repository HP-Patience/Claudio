import type Database from 'better-sqlite3';
import { invokeClaude } from './claude.js';
import { setPlayStats } from './db.js';

interface PlayAggregation {
  totalPlays: number;
  topArtists: { name: string; count: number }[];
  topSongs: { name: string; artist: string; count: number }[];
  hourDistribution: Record<string, number>;
  newDiscoveries: { name: string; artist: string }[];
}

function aggregatePlays(db: Database.Database, period: string): PlayAggregation {
  const [year, month] = period.split('-').map(Number);
  const allRows = db.prepare(
    "SELECT song_id, song_name, artist, played_at FROM plays WHERE played_at >= ? AND played_at < ?"
  ).all(
    `${year}-${String(month).padStart(2, '0')}-01`,
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
  ) as { song_id: string; song_name: string; artist: string; played_at: string }[];

  const totalPlays = allRows.length;

  const artistCount = new Map<string, number>();
  const songCount = new Map<string, { name: string; artist: string; count: number }>();
  const hourDist: Record<string, number> = { '0-6': 0, '6-12': 0, '12-18': 0, '18-24': 0 };

  for (const row of allRows) {
    artistCount.set(row.artist, (artistCount.get(row.artist) || 0) + 1);
    const key = `${row.song_name}|${row.artist}`;
    const existing = songCount.get(key);
    if (existing) { existing.count++; } else { songCount.set(key, { name: row.song_name, artist: row.artist, count: 1 }); }
    const h = new Date(row.played_at + 'Z').getHours();
    if (h < 6) hourDist['0-6']++;
    else if (h < 12) hourDist['6-12']++;
    else if (h < 18) hourDist['12-18']++;
    else hourDist['18-24']++;
  }

  const topArtists = [...artistCount.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const topSongs = [...songCount.values()]
    .sort((a, b) => b.count - a.count).slice(0, 5);

  // New discoveries: artists in this month but not before
  const prevArtists = new Set(
    (db.prepare(
      "SELECT DISTINCT artist FROM plays WHERE played_at < ?"
    ).all(`${period}-01`) as { artist: string }[]).map(r => r.artist)
  );
  const newDiscoveries = [...new Set(allRows.map(r => `${r.song_name}|${r.artist}`))]
    .map(s => { const [name, artist] = s.split('|'); return { name, artist }; })
    .filter(d => !prevArtists.has(d.artist))
    .slice(0, 5);

  return { totalPlays, topArtists, topSongs, hourDistribution: hourDist, newDiscoveries };
}

export async function generateReport(db: Database.Database, period?: string): Promise<{
  period: string; stat: PlayAggregation; insight: string;
}> {
  const p = period || new Date().toISOString().slice(0, 7);
  const stat = aggregatePlays(db, p);

  if (stat.totalPlays === 0) {
    const fallback = `${p} 月度听歌报告\n\n本月暂无播放数据，多听点歌再来吧！`;
    setPlayStats(db, p, JSON.stringify(stat), fallback);
    return { period: p, stat, insight: fallback };
  }

  const prompt = `你是一名音乐数据分析师。根据以下统计生成月度听歌报告：

- 总播放 ${stat.totalPlays} 次
- Top 歌手: ${stat.topArtists.map(a => `${a.name}(${a.count})`).join(', ')}
- Top 歌曲: ${stat.topSongs.map(s => `${s.name}(${s.count})`).join(', ')}
- 时段分布: 0-6点 ${stat.hourDistribution['0-6']}, 6-12点 ${stat.hourDistribution['6-12']}, 12-18点 ${stat.hourDistribution['12-18']}, 18-24点 ${stat.hourDistribution['18-24']}
- 本月新发现: ${stat.newDiscoveries.map(d => `${d.name} - ${d.artist}`).join(', ') || '无'}

请生成自然中文报告，4句话以内：
1. 总体画像（1句话）
2. 时间习惯（1句话）
3. 品味变化（1句话）
4. 下月推荐方向（1句话）

直接输出报告文案，不要 JSON。`;

  try {
    const result = await invokeClaude(prompt, { db, timeout: 30000 });
    setPlayStats(db, p, JSON.stringify(stat), result.say);
    return { period: p, stat, insight: result.say };
  } catch {
    const fallback = `${p} 月度听歌报告\n\n总播放 ${stat.totalPlays} 次\n最爱歌手: ${stat.topArtists[0]?.name || '未知'}\n最爱歌曲: ${stat.topSongs[0]?.name || '未知'}`;
    setPlayStats(db, p, JSON.stringify(stat), fallback);
    return { period: p, stat, insight: fallback };
  }
}
