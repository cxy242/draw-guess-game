process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT:', err.message, err.stack);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED:', err.message, err.stack);
});

const fastify = require('fastify')({ logger: false });

// ============ In-memory state ============
let currentRound = null;
let scores = {}; // { player: score }
let savedDrawings = []; // 画廊：所有完成的画作
let onlinePlayers = {}; // { name: lastSeen }
let playerGuessCorrect = {}; // { name: correctCount } 玩家猜对次数

// ============ SVG helpers ============
function svgEscape(v) {
  return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function normalizePointPairs(points) {
  if (!points || points.length === 0) return [];
  if (Array.isArray(points[0])) return points;
  const pairs = [];
  for (let i = 0; i < points.length - 1; i += 2) pairs.push([points[i], points[i + 1]]);
  return pairs;
}

function strokesToSvg(strokes, w = 1000, h = 700) {
  const limited = (strokes || []).slice(0, 100);
  let paths = '';
  for (const s of limited) {
    const c = s.color || '#4f454b', sw = s.width || 8;
    const tool = s.tool || 'polyline';
    if (tool === 'polyline') {
      const pairs = normalizePointPairs(s.points || s);
      if (pairs.length < 2) continue;
      const d = pairs.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
      paths += `  <path d="${svgEscape(d)}" stroke="${svgEscape(c)}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>\n`;
    } else if (tool === 'rect') {
      const pairs = normalizePointPairs(s.points || s);
      if (pairs.length < 2) continue;
      const [x1,y1]=pairs[0],[x2,y2]=pairs[1];
      const rx=Math.min(x1,x2),ry=Math.min(y1,y2),rw=Math.abs(x2-x1),rh=Math.abs(y2-y1);
      paths += `  <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" stroke="${svgEscape(c)}" stroke-width="${sw}" fill="none" stroke-linejoin="round"/>\n`;
    } else if (tool === 'circle') {
      const pairs = normalizePointPairs(s.points || s);
      if (pairs.length < 2) continue;
      const [x1,y1]=pairs[0],[x2,y2]=pairs[1];
      const cx=(x1+x2)/2,cy=(y1+y2)/2,rx=Math.abs(x2-x1)/2,ry=Math.abs(y2-y1)/2;
      paths += `  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" stroke="${svgEscape(c)}" stroke-width="${sw}" fill="none"/>\n`;
    } else if (tool === 'line') {
      const pairs = normalizePointPairs(s.points || s);
      if (pairs.length < 2) continue;
      const [x1,y1]=pairs[0],[x2,y2]=pairs[1];
      paths += `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${svgEscape(c)}" stroke-width="${sw}" stroke-linecap="round"/>\n`;
    } else if (tool === 'arrow') {
      const pairs = normalizePointPairs(s.points || s);
      if (pairs.length < 2) continue;
      const [x1,y1]=pairs[0],[x2,y2]=pairs[1];
      const angle=Math.atan2(y2-y1,x2-x1);
      const hl=Math.max(12,sw*3);
      const ax1=x2-hl*Math.cos(angle-Math.PI/6), ay1=y2-hl*Math.sin(angle-Math.PI/6);
      const ax2=x2-hl*Math.cos(angle+Math.PI/6), ay2=y2-hl*Math.sin(angle+Math.PI/6);
      paths += `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${svgEscape(c)}" stroke-width="${sw}" stroke-linecap="round"/>\n`;
      paths += `  <line x1="${x2}" y1="${y2}" x2="${ax1.toFixed(1)}" y2="${ay1.toFixed(1)}" stroke="${svgEscape(c)}" stroke-width="${sw}" stroke-linecap="round"/>\n`;
      paths += `  <line x1="${x2}" y1="${y2}" x2="${ax2.toFixed(1)}" y2="${ay2.toFixed(1)}" stroke="${svgEscape(c)}" stroke-width="${sw}" stroke-linecap="round"/>\n`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="color-scheme:light">
  <rect width="${w}" height="${h}" fill="#fffafc" rx="16"/>
${paths}</svg>`;
}

function makeAsciiGrid(strokes, w = 1000, h = 700, cols = 80, rows = 56) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill('.'));
  const sx = cols / w, sy = rows / h;
  for (const s of (strokes || [])) {
    const pairs = normalizePointPairs(s.points || s);
    for (let i = 0; i < pairs.length - 1; i++) {
      const [x0, y0] = pairs[i], [x1, y1] = pairs[i + 1];
      let cx = Math.round(x0 * sx), cy = Math.round(y0 * sy);
      const cx1 = Math.round(x1 * sx), cy1 = Math.round(y1 * sy);
      const dx = Math.abs(cx1 - cx), dy = Math.abs(cy1 - cy);
      const ssx = cx < cx1 ? 1 : -1, ssy = cy < cy1 ? 1 : -1;
      let err = dx - dy;
      while (true) {
        if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) grid[cy][cx] = '#';
        if (cx === cx1 && cy === cy1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; cx += ssx; }
        if (e2 < dx) { err += dx; cy += ssy; }
      }
    }
  }
  return grid.map(r => r.join('')).join('\n');
}


// 把线条数据转成自然语言描述，帮助AI理解画作
function describeStrokes(strokes) {
  if (!strokes || !strokes.length) return '（空白画布）';
  const colorName = {'#000':'黑色','#fff':'白色','#e53935':'红色','#ff9800':'橙色','#ffeb3b':'黄色','#4caf50':'绿色','#2196f3':'蓝色','#9c27b0':'紫色','#e91e63':'粉色','#795548':'棕色','#607d8b':'灰色','#ff5722':'深橙','#4f454b':'深灰'};
  const parts = [];
  let totalPoints = 0;
  
  strokes.forEach((s, i) => {
    if (!s.points || s.points.length < 2) return;
    const pts = s.points;
    totalPoints += pts.length;
    const c = colorName[s.color] || s.color || '黑色';
    const xs = pts.map(p=>p[0]), ys = pts.map(p=>p[1]);
    const minX=Math.min(...xs), maxX=Math.max(...xs);
    const minY=Math.min(...ys), maxY=Math.max(...ys);
    const w=maxX-minX, h=maxY-minY;
    const cx=Math.round((minX+maxX)/2), cy=Math.round((minY+maxY)/2);
    const sx=pts[0][0], sy=pts[0][1];
    const ex=pts[pts.length-1][0], ey=pts[pts.length-1][1];
    const closed = Math.abs(sx-ex)<25 && Math.abs(sy-ey)<25;
    
    let desc = '';
    if (closed && w>20 && h>20) {
      // 闭合形状
      const ratio = w/Math.max(h,1);
      if (ratio > 0.7 && ratio < 1.4) desc = `${c}的圆形或方形`;
      else if (ratio >= 1.4) desc = `${c}的横向椭圆或长方形(宽${w}高${h})`;
      else desc = `${c}的纵向椭圆或长方形(宽${w}高${h})`;
      desc += `，位置在画布${cx<400?'左侧':cx>600?'右侧':'中间'}${cy<300?'偏上':cy>450?'偏下':'中间'}`;
    } else if (w<15 && h<15) {
      desc = `${c}的一个小点`;
    } else {
      // 开放线条 - 描述走向
      const turns = [];
      for (let j=1; j<pts.length; j++) {
        const dx=pts[j][0]-pts[j-1][0], dy=pts[j][1]-pts[j-1][1];
        if (Math.abs(dx)>5 || Math.abs(dy)>5) {
          const angle = Math.atan2(dy,dx)*180/Math.PI;
          let dir = '';
          if (angle>-22.5&&angle<=22.5) dir='右';
          else if (angle>22.5&&angle<=67.5) dir='右下';
          else if (angle>67.5&&angle<=112.5) dir='下';
          else if (angle>112.5&&angle<=157.5) dir='左下';
          else if (angle>157.5||angle<=-157.5) dir='左';
          else if (angle>-157.5&&angle<=-112.5) dir='左上';
          else if (angle>-112.5&&angle<=-67.5) dir='上';
          else dir='右上';
          if (!turns.length || turns[turns.length-1]!==dir) turns.push(dir);
        }
      }
      desc = `${c}的线条，从(${sx},${sy})开始`;
      if (turns.length <= 3) {
        desc += `，走向：${turns.join('→')}`;
      } else {
        desc += `，弯曲走向：${turns.slice(0,5).join('→')}${turns.length>5?'...':''}`;
      }
      desc += `，到(${ex},${ey})结束，覆盖范围${w}x${h}像素`;
    }
    parts.push(desc);
  });
  
  // 添加整体描述
  let summary = `\n整体：画布上有${strokes.length}条线（${totalPoints}个点），`;
  if (strokes.length === 1) summary += '用一笔完成';
  else summary += `分${strokes.length}笔画成`;
  
  return parts.join('\n') + summary;
}

const ASCII_NOTE = 'ascii_grid 为 80列 x 56行；# 表示线条经过，. 表示空白。请结合 SVG 路径和整体轮廓判断。';

// ============ Demo Drawings (centered around 500,350) ============

const DEMO_DRAWINGS = [
  // 1. Cat 猫
  {
    answer: '猫', aliases: ['cat', '猫咪', '小猫', 'kitty'],
    content: [
      // Body
      { tool: 'polyline', points: [[400,500],[400,350],[450,250],[500,220],[550,250],[600,350],[600,500]], color: '#ff9800', width: 10 },
      // Left ear
      { tool: 'polyline', points: [[420,280],[380,180],[450,230]], color: '#ff9800', width: 7 },
      // Right ear
      { tool: 'polyline', points: [[580,280],[620,180],[550,230]], color: '#ff9800', width: 7 },
      // Inner ears
      { tool: 'polyline', points: [[415,260],[395,200],[440,240]], color: '#e91e63', width: 4 },
      { tool: 'polyline', points: [[585,260],[605,200],[560,240]], color: '#e91e63', width: 4 },
      // Eyes
      { tool: 'polyline', points: [[460,310],[460,300],[470,300],[470,310],[460,310]], color: '#333', width: 5 },
      { tool: 'polyline', points: [[530,310],[530,300],[540,300],[540,310],[530,310]], color: '#333', width: 5 },
      // Nose
      { tool: 'polyline', points: [[490,340],[500,350],[510,340]], color: '#e91e63', width: 4 },
      // Mouth
      { tool: 'polyline', points: [[500,350],[500,365],[490,370]], color: '#4f454b', width: 3 },
      { tool: 'polyline', points: [[500,365],[510,370]], color: '#4f454b', width: 3 },
      // Whiskers
      { tool: 'polyline', points: [[460,345],[380,330]], color: '#4f454b', width: 3 },
      { tool: 'polyline', points: [[460,355],[380,360]], color: '#4f454b', width: 3 },
      { tool: 'polyline', points: [[540,345],[620,330]], color: '#4f454b', width: 3 },
      { tool: 'polyline', points: [[540,355],[620,360]], color: '#4f454b', width: 3 },
      // Tail
      { tool: 'polyline', points: [[600,500],[650,480],[680,440],[670,400],[690,380]], color: '#ff9800', width: 7 },
      // Feet
      { tool: 'polyline', points: [[400,500],[420,510],[440,500]], color: '#ff9800', width: 6 },
      { tool: 'polyline', points: [[560,500],[580,510],[600,500]], color: '#ff9800', width: 6 },
    ]
  },
  // 2. House 房子
  {
    answer: '房子', aliases: ['house', '房屋', '小屋', 'home'],
    content: [
      // Walls
      { tool: 'polyline', points: [[350,550],[350,350],[650,350],[650,550],[350,550]], color: '#795548', width: 8 },
      // Roof
      { tool: 'polyline', points: [[320,350],[500,200],[680,350]], color: '#e53935', width: 10 },
      // Roof fill lines
      { tool: 'polyline', points: [[380,350],[500,240],[620,350]], color: '#c62828', width: 5 },
      // Door
      { tool: 'polyline', points: [[460,550],[460,430],[540,430],[540,550]], color: '#5d4037', width: 6 },
      // Door knob
      { tool: 'polyline', points: [[525,490],[530,490]], color: '#ffd600', width: 5 },
      // Window left
      { tool: 'polyline', points: [[380,400],[380,460],[440,460],[440,400],[380,400]], color: '#2196f3', width: 5 },
      { tool: 'polyline', points: [[410,400],[410,460]], color: '#2196f3', width: 3 },
      { tool: 'polyline', points: [[380,430],[440,430]], color: '#2196f3', width: 3 },
      // Window right
      { tool: 'polyline', points: [[560,400],[560,460],[620,460],[620,400],[560,400]], color: '#2196f3', width: 5 },
      { tool: 'polyline', points: [[590,400],[590,460]], color: '#2196f3', width: 3 },
      { tool: 'polyline', points: [[560,430],[620,430]], color: '#2196f3', width: 3 },
      // Chimney
      { tool: 'polyline', points: [[580,280],[580,210],[620,210],[620,250]], color: '#795548', width: 7 },
      // Smoke
      { tool: 'polyline', points: [[600,210],[610,190],[590,170],[600,150]], color: '#90a4ae', width: 4 },
    ]
  },
  // 3. Tree 树
  {
    answer: '树', aliases: ['tree', '树木', '大树'],
    content: [
      // Trunk
      { tool: 'polyline', points: [[480,550],[480,380],[520,380],[520,550]], color: '#795548', width: 10 },
      // Roots
      { tool: 'polyline', points: [[480,550],[450,570],[440,560]], color: '#795548', width: 6 },
      { tool: 'polyline', points: [[520,550],[550,570],[560,560]], color: '#795548', width: 6 },
      // Crown - outer
      { tool: 'polyline', points: [[500,380],[400,340],[350,280],[370,210],[420,170],[500,150],[580,170],[630,210],[650,280],[600,340],[500,380]], color: '#4caf50', width: 8 },
      // Crown detail
      { tool: 'polyline', points: [[440,300],[460,240],[500,260],[540,230],[560,300]], color: '#66bb6a', width: 5 },
      { tool: 'polyline', points: [[420,250],[470,200],[530,200],[580,250]], color: '#81c784', width: 4 },
      // Apples
      { tool: 'polyline', points: [[430,280],[435,290],[440,280]], color: '#e53935', width: 6 },
      { tool: 'polyline', points: [[560,260],[565,270],[570,260]], color: '#e53935', width: 6 },
    ]
  },
  // 4. Sun 太阳
  {
    answer: '太阳', aliases: ['sun', '日', '太阳公公'],
    content: [
      // Circle
      { tool: 'polyline', points: [[500,310],[530,300],[555,320],[560,350],[550,380],[520,400],[490,400],[460,385],[445,360],[445,330],[460,305],[490,295],[500,310]], color: '#ffeb3b', width: 10 },
      // Inner circle detail
      { tool: 'polyline', points: [[500,330],[520,325],[535,340],[530,360],[510,370],[490,365],[478,350],[480,335],[500,330]], color: '#ffc107', width: 6 },
      // Eyes (cute)
      { tool: 'polyline', points: [[485,345],[485,340],[490,340],[490,345]], color: '#333', width: 4 },
      { tool: 'polyline', points: [[515,345],[515,340],[520,340],[520,345]], color: '#333', width: 4 },
      // Smile
      { tool: 'polyline', points: [[490,365],[500,372],[510,365]], color: '#333', width: 3 },
      // Rays
      { tool: 'polyline', points: [[500,260],[500,220]], color: '#ff9800', width: 6 },
      { tool: 'polyline', points: [[500,430],[500,470]], color: '#ff9800', width: 6 },
      { tool: 'polyline', points: [[410,350],[370,350]], color: '#ff9800', width: 6 },
      { tool: 'polyline', points: [[590,350],[630,350]], color: '#ff9800', width: 6 },
      { tool: 'polyline', points: [[440,280],[410,250]], color: '#ff9800', width: 5 },
      { tool: 'polyline', points: [[560,420],[590,450]], color: '#ff9800', width: 5 },
      { tool: 'polyline', points: [[440,420],[410,450]], color: '#ff9800', width: 5 },
      { tool: 'polyline', points: [[560,280],[590,250]], color: '#ff9800', width: 5 },
    ]
  },
  // 5. Heart 爱心
  {
    answer: '爱心', aliases: ['heart', '爱', '心', 'love', '红心'],
    content: [
      // Main heart
      { tool: 'polyline', points: [[500,480],[420,400],[370,340],[360,280],[380,230],[420,210],[470,230],[500,280],[530,230],[580,210],[620,230],[640,280],[630,340],[580,400],[500,480]], color: '#e91e63', width: 10 },
      // Inner highlight
      { tool: 'polyline', points: [[500,440],[440,380],[410,330],[400,280],[420,250],[460,240],[490,270]], color: '#f48fb1', width: 5 },
      // Shine
      { tool: 'polyline', points: [[430,260],[440,250],[450,260]], color: '#fff', width: 4 },
    ]
  },
  // 6. Flower 花
  {
    answer: '花', aliases: ['flower', '花朵', '鲜花', '小花'],
    content: [
      // Stem
      { tool: 'polyline', points: [[500,380],[500,550]], color: '#4caf50', width: 8 },
      // Leaves
      { tool: 'polyline', points: [[500,470],[450,440],[460,480],[500,470]], color: '#66bb6a', width: 5 },
      { tool: 'polyline', points: [[500,440],[550,410],[540,450],[500,440]], color: '#66bb6a', width: 5 },
      // Petals
      { tool: 'polyline', points: [[500,310],[470,260],[500,240],[530,260],[500,310]], color: '#e91e63', width: 7 },
      { tool: 'polyline', points: [[500,310],[440,300],[430,330],[460,350],[500,310]], color: '#ec407a', width: 7 },
      { tool: 'polyline', points: [[500,310],[540,350],[570,330],[560,300],[500,310]], color: '#f06292', width: 7 },
      { tool: 'polyline', points: [[500,310],[460,360],[490,380],[520,370],[500,310]], color: '#e91e63', width: 7 },
      { tool: 'polyline', points: [[500,310],[530,370],[500,380],[470,365],[500,310]], color: '#ec407a', width: 7 },
      // Center
      { tool: 'polyline', points: [[500,310],[510,305],[515,312],[508,318],[495,316],[500,310]], color: '#ffeb3b', width: 8 },
    ]
  },
  // 7. Star 星星
  {
    answer: '星星', aliases: ['star', '星', '五角星'],
    content: [
      // 5-pointed star
      { tool: 'polyline', points: [[500,200],[530,300],[630,310],[555,370],[575,470],[500,420],[425,470],[445,370],[370,310],[470,300],[500,200]], color: '#ffeb3b', width: 10 },
      // Inner detail
      { tool: 'polyline', points: [[500,250],[520,310],[580,320],[540,360],[555,430],[500,400],[445,430],[460,360],[420,320],[480,310],[500,250]], color: '#fff176', width: 5 },
      // Eyes
      { tool: 'polyline', points: [[485,340],[485,335],[490,335],[490,340]], color: '#333', width: 4 },
      { tool: 'polyline', points: [[515,340],[515,335],[520,335],[520,340]], color: '#333', width: 4 },
      // Smile
      { tool: 'polyline', points: [[490,360],[500,368],[510,360]], color: '#333', width: 3 },
    ]
  },
  // 8. Fish 鱼
  {
    answer: '鱼', aliases: ['fish', '小鱼', '金鱼'],
    content: [
      // Body
      { tool: 'polyline', points: [[400,350],[430,300],[500,280],[570,300],[600,350],[570,400],[500,420],[430,400],[400,350]], color: '#2196f3', width: 8 },
      // Body detail
      { tool: 'polyline', points: [[430,340],[500,320],[560,340]], color: '#64b5f6', width: 5 },
      // Tail
      { tool: 'polyline', points: [[400,350],[350,300],[330,350],[350,400],[400,350]], color: '#ff9800', width: 8 },
      // Top fin
      { tool: 'polyline', points: [[500,280],[490,230],[530,240],[540,280]], color: '#ff9800', width: 6 },
      // Bottom fin
      { tool: 'polyline', points: [[500,420],[490,460],[520,450],[530,420]], color: '#ff9800', width: 5 },
      // Eye
      { tool: 'polyline', points: [[550,330],[555,325],[560,330],[555,335],[550,330]], color: '#333', width: 5 },
      // Pupil
      { tool: 'polyline', points: [[553,328],[556,332]], color: '#fff', width: 3 },
      // Mouth
      { tool: 'polyline', points: [[590,350],[600,355],[590,360]], color: '#e91e63', width: 3 },
      // Bubbles
      { tool: 'polyline', points: [[610,310],[615,305],[620,310],[615,315],[610,310]], color: '#90caf9', width: 3 },
      { tool: 'polyline', points: [[625,290],[628,287],[631,290],[628,293],[625,290]], color: '#90caf9', width: 2 },
    ]
  },
];

// ============ Word Bank ============
const WORD_BANK = [
  // Animals
  { word: '猫', aliases: ['cat','猫咪','小猫'] },
  { word: '狗', aliases: ['dog','小狗','狗狗'] },
  { word: '鱼', aliases: ['fish','小鱼','金鱼'] },
  { word: '兔子', aliases: ['rabbit','bunny','小兔'] },
  { word: '鸟', aliases: ['bird','小鸟'] },
  { word: '蛇', aliases: ['snake','小蛇'] },
  { word: '蝴蝶', aliases: ['butterfly'] },
  { word: '乌龟', aliases: ['turtle','turtle','龟'] },
  // Food
  { word: '蛋糕', aliases: ['cake','生日蛋糕'] },
  { word: '冰淇淋', aliases: ['ice cream','icecream'] },
  { word: '汉堡', aliases: ['hamburger','burger'] },
  { word: '苹果', aliases: ['apple'] },
  { word: '香蕉', aliases: ['banana'] },
  { word: '披萨', aliases: ['pizza','比萨'] },
  // Objects
  { word: '手机', aliases: ['phone','电话','手机'] },
  { word: '雨伞', aliases: ['umbrella','伞'] },
  { word: '眼镜', aliases: ['glasses','墨镜'] },
  { word: '钥匙', aliases: ['key','钥匙'] },
  { word: '气球', aliases: ['balloon','气球'] },
  { word: '皇冠', aliases: ['crown','王冠'] },
  // Nature
  { word: '太阳', aliases: ['sun','日'] },
  { word: '月亮', aliases: ['moon','月'] },
  { word: '云', aliases: ['cloud','云朵','白云'] },
  { word: '花', aliases: ['flower','花朵','鲜花'] },
  { word: '树', aliases: ['tree','大树','树木'] },
  { word: '山', aliases: ['mountain','大山'] },
  // Extra
  { word: '汽车', aliases: ['car','车','小汽车'] },
  { word: '飞机', aliases: ['plane','airplane','飞机'] },
  { word: '船', aliases: ['boat','ship','小船'] },
  { word: '时钟', aliases: ['clock','钟'] },
  { word: '灯泡', aliases: ['bulb','灯'] },
  { word: '雪人', aliases: ['snowman'] },
  { word: '彩虹', aliases: ['rainbow'] },
  { word: '蜗牛', aliases: ['snail'] },
  { word: '蘑菇', aliases: ['mushroom'] },
  { word: '机器人', aliases: ['robot'] },
];

// Simple procedural drawing generator for word bank items
function generateSimpleDrawing(entry) {
  const { word } = entry;
  // Map common words to simple stroke patterns centered around (500,350)
  const drawings = {
    '狗': [
      { tool:'polyline', points:[[430,350],[430,250],[470,200],[500,190],[530,200],[570,250],[570,350]], color:'#795548', width:8 },
      { tool:'polyline', points:[[440,220],[410,170],[450,200]], color:'#795548', width:6 },
      { tool:'polyline', points:[[560,220],[590,170],[550,200]], color:'#795548', width:6 },
      { tool:'polyline', points:[[470,280],[470,275],[477,275],[477,280]], color:'#333', width:4 },
      { tool:'polyline', points:[[520,280],[520,275],[527,275],[527,280]], color:'#333', width:4 },
      { tool:'polyline', points:[[490,300],[500,310],[510,300]], color:'#333', width:4 },
      { tool:'polyline', points:[[570,350],[620,340],[650,360]], color:'#795548', width:6 },
    ],
    '兔子': [
      { tool:'polyline', points:[[450,350],[450,280],[500,260],[550,280],[550,350]], color:'#e0e0e0', width:8 },
      { tool:'polyline', points:[[470,260],[460,160],[480,170]], color:'#e0e0e0', width:6 },
      { tool:'polyline', points:[[530,260],[540,160],[520,170]], color:'#e0e0e0', width:6 },
      { tool:'polyline', points:[[460,160],[470,165]], color:'#e91e63', width:4 },
      { tool:'polyline', points:[[530,160],[540,165]], color:'#e91e63', width:4 },
      { tool:'polyline', points:[[480,310],[480,305],[487,305],[487,310]], color:'#e91e63', width:4 },
      { tool:'polyline', points:[[515,310],[515,305],[522,305],[522,310]], color:'#e91e63', width:4 },
      { tool:'polyline', points:[[495,325],[500,332],[505,325]], color:'#e91e63', width:3 },
    ],
    '鸟': [
      { tool:'polyline', points:[[460,340],[470,300],[500,280],[530,300],[540,340],[500,360],[460,340]], color:'#4caf50', width:7 },
      { tool:'polyline', points:[[530,300],[570,280],[600,300]], color:'#ff9800', width:5 },
      { tool:'polyline', points:[[520,310],[525,305],[530,310]], color:'#333', width:4 },
      { tool:'polyline', points:[[460,340],[410,360],[440,350],[410,380]], color:'#4caf50', width:5 },
      { tool:'polyline', points:[[500,360],[500,420],[480,440]], color:'#795548', width:4 },
      { tool:'polyline', points:[[500,420],[520,440]], color:'#795548', width:4 },
    ],
    '蛇': [
      { tool:'polyline', points:[[400,400],[430,380],[460,400],[490,380],[520,400],[550,380],[580,400],[600,370],[620,340],[610,310],[580,300],[560,320]], color:'#4caf50', width:8 },
      { tool:'polyline', points:[[560,320],[550,310],[540,320]], color:'#e53935', width:5 },
      { tool:'polyline', points:[[580,300],[585,295],[590,300]], color:'#333', width:4 },
    ],
    '蛋糕': [
      { tool:'polyline', points:[[400,500],[400,380],[600,380],[600,500],[400,500]], color:'#f8bbd0', width:8 },
      { tool:'polyline', points:[[380,380],[500,340],[620,380]], color:'#e91e63', width:6 },
      { tool:'polyline', points:[[480,340],[480,290]], color:'#ffeb3b', width:4 },
      { tool:'polyline', points:[[480,290],[475,275],[480,270],[485,275],[480,290]], color:'#ff9800', width:4 },
      { tool:'polyline', points:[[520,340],[520,290]], color:'#ffeb3b', width:4 },
      { tool:'polyline', points:[[520,290],[515,275],[520,270],[525,275],[520,290]], color:'#ff9800', width:4 },
    ],
    '冰淇淋': [
      { tool:'polyline', points:[[460,400],[500,520],[540,400]], color:'#d7ccc8', width:8 },
      { tool:'polyline', points:[[450,400],[460,370],[500,350],[540,370],[550,400]], color:'#f48fb1', width:7 },
      { tool:'polyline', points:[[460,370],[480,340],[500,350]], color:'#81d4fa', width:6 },
      { tool:'polyline', points:[[500,350],[520,340],[540,370]], color:'#fff176', width:6 },
      { tool:'polyline', points:[[490,330],[495,315],[500,330]], color:'#e53935', width:4 },
    ],
    '汉堡': [
      { tool:'polyline', points:[[400,350],[420,310],[500,290],[580,310],[600,350]], color:'#d4a056', width:8 },
      { tool:'polyline', points:[[400,350],[400,380],[600,380],[600,350]], color:'#4caf50', width:6 },
      { tool:'polyline', points:[[400,380],[400,410],[600,410],[600,380]], color:'#e53935', width:7 },
      { tool:'polyline', points:[[400,410],[400,430],[600,430],[600,410]], color:'#ffeb3b', width:5 },
      { tool:'polyline', points:[[400,430],[400,460],[600,460],[600,430]], color:'#d4a056', width:8 },
    ],
    '苹果': [
      { tool:'polyline', points:[[500,280],[480,300],[440,340],[430,400],[450,450],[500,470],[550,450],[570,400],[560,340],[520,300],[500,280]], color:'#e53935', width:8 },
      { tool:'polyline', points:[[500,280],[510,240],[500,230]], color:'#795548', width:5 },
      { tool:'polyline', points:[[510,250],[530,260]], color:'#4caf50', width:4 },
    ],
    '香蕉': [
      { tool:'polyline', points:[[420,400],[440,360],[480,320],[530,300],[570,310],[590,340],[580,370],[540,400],[480,420],[440,420],[420,400]], color:'#ffeb3b', width:8 },
      { tool:'polyline', points:[[570,310],[590,290],[600,280]], color:'#8d6e63', width:5 },
    ],
    '披萨': [
      { tool:'polyline', points:[[500,250],[380,450],[620,450],[500,250]], color:'#ffc107', width:8 },
      { tool:'polyline', points:[[500,280],[420,420],[580,420],[500,280]], color:'#ff5722', width:5 },
      { tool:'polyline', points:[[480,350],[470,345],[475,355]], color:'#e53935', width:6 },
      { tool:'polyline', points:[[530,380],[525,375],[535,385]], color:'#e53935', width:6 },
      { tool:'polyline', points:[[500,410],[495,405],[505,415]], color:'#4caf50', width:5 },
    ],
    '手机': [
      { tool:'polyline', points:[[440,250],[440,500],[560,500],[560,250],[440,250]], color:'#37474f', width:8 },
      { tool:'polyline', points:[[450,280],[550,280],[550,470],[450,470],[450,280]], color:'#2196f3', width:5 },
      { tool:'polyline', points:[[490,480],[510,480]], color:'#eee', width:4 },
    ],
    '雨伞': [
      { tool:'polyline', points:[[500,300],[500,500]], color:'#795548', width:6 },
      { tool:'polyline', points:[[500,500],[510,520]], color:'#795548', width:5 },
      { tool:'polyline', points:[[360,300],[500,200],[640,300]], color:'#2196f3', width:8 },
      { tool:'polyline', points:[[360,300],[370,350],[500,300]], color:'#42a5f5', width:6 },
      { tool:'polyline', points:[[500,300],[630,350],[640,300]], color:'#1e88e5', width:6 },
    ],
    '眼镜': [
      { tool:'polyline', points:[[420,350],[420,320],[480,320],[480,350],[420,350]], color:'#333', width:6 },
      { tool:'polyline', points:[[520,350],[520,320],[580,320],[580,350],[520,350]], color:'#333', width:6 },
      { tool:'polyline', points:[[480,335],[520,335]], color:'#333', width:5 },
      { tool:'polyline', points:[[420,335],[380,325]], color:'#333', width:4 },
      { tool:'polyline', points:[[580,335],[620,325]], color:'#333', width:4 },
    ],
    '钥匙': [
      { tool:'polyline', points:[[460,300],[500,280],[540,300],[540,340],[500,360],[460,340],[460,300]], color:'#ffd600', width:6 },
      { tool:'polyline', points:[[500,360],[500,480]], color:'#ffd600', width:6 },
      { tool:'polyline', points:[[500,440],[530,440]], color:'#ffd600', width:5 },
      { tool:'polyline', points:[[500,460],[520,460]], color:'#ffd600', width:5 },
    ],
    '气球': [
      { tool:'polyline', points:[[500,300],[470,320],[460,370],[470,420],[500,440],[530,420],[540,370],[530,320],[500,300]], color:'#e53935', width:8 },
      { tool:'polyline', points:[[500,440],[500,520]], color:'#333', width:3 },
      { tool:'polyline', points:[[500,520],[490,530],[510,530],[500,520]], color:'#333', width:3 },
      { tool:'polyline', points:[[480,340],[485,335],[490,340]], color:'#fff', width:3 },
    ],
    '皇冠': [
      { tool:'polyline', points:[[380,420],[380,320],[420,360],[500,280],[580,360],[620,320],[620,420],[380,420]], color:'#ffd600', width:8 },
      { tool:'polyline', points:[[420,380],[420,400]], color:'#ffd600', width:4 },
      { tool:'polyline', points:[[500,360],[500,400]], color:'#ffd600', width:4 },
      { tool:'polyline', points:[[580,380],[580,400]], color:'#ffd600', width:4 },
      { tool:'polyline', points:[[420,380],[415,375],[425,375],[420,380]], color:'#e53935', width:5 },
      { tool:'polyline', points:[[500,360],[495,355],[505,355],[500,360]], color:'#2196f3', width:5 },
      { tool:'polyline', points:[[580,380],[575,375],[585,375],[580,380]], color:'#4caf50', width:5 },
    ],
    '月亮': [
      { tool:'polyline', points:[[520,250],[480,280],[460,330],[470,380],[500,420],[540,440],[580,430],[610,400],[620,360],[610,310],[580,270],[540,250],[520,250]], color:'#ffc107', width:9 },
      { tool:'polyline', points:[[550,290],[530,310],[520,350],[530,390],[560,410],[590,400],[600,370],[595,330],[575,300],[550,290]], color:'#1a1a2e', width:10 },
    ],
    '云': [
      { tool:'polyline', points:[[400,380],[400,340],[430,310],[470,300],[500,310],[530,300],[570,310],[600,340],[600,380],[400,380]], color:'#90caf9', width:8 },
      { tool:'polyline', points:[[440,380],[440,350],[460,330],[480,325],[500,330],[520,325],[540,330],[560,350],[560,380]], color:'#bbdefb', width:5 },
    ],
    '山': [
      { tool:'polyline', points:[[300,500],[500,250],[700,500]], color:'#607d8b', width:8 },
      { tool:'polyline', points:[[400,500],[550,320],[700,500]], color:'#78909c', width:7 },
      { tool:'polyline', points:[[470,290],[500,250],[530,290]], color:'#fff', width:5 },
    ],
    '汽车': [
      { tool:'polyline', points:[[350,420],[350,380],[400,340],[600,340],[650,380],[650,420],[350,420]], color:'#e53935', width:8 },
      { tool:'polyline', points:[[380,340],[380,300],[420,280],[580,280],[620,300],[620,340]], color:'#e53935', width:7 },
      { tool:'polyline', points:[[420,280],[420,340]], color:'#87CEEB', width:4 },
      { tool:'polyline', points:[[580,280],[580,340]], color:'#87CEEB', width:4 },
      { tool:'polyline', points:[[420,340],[580,340]], color:'#87CEEB', width:4 },
      { tool:'polyline', points:[[410,420],[410,400],[450,400],[450,420]], color:'#333', width:6 },
      { tool:'polyline', points:[[550,420],[550,400],[590,400],[590,420]], color:'#333', width:6 },
    ],
    '飞机': [
      { tool:'polyline', points:[[500,280],[500,450]], color:'#eee', width:8 },
      { tool:'polyline', points:[[500,280],[480,260],[500,240],[520,260],[500,280]], color:'#e53935', width:6 },
      { tool:'polyline', points:[[500,350],[400,400],[410,410],[500,370]], color:'#90caf9', width:6 },
      { tool:'polyline', points:[[500,350],[600,400],[590,410],[500,370]], color:'#90caf9', width:6 },
      { tool:'polyline', points:[[500,430],[460,460],[470,465],[500,445]], color:'#90caf9', width:5 },
      { tool:'polyline', points:[[500,430],[540,460],[530,465],[500,445]], color:'#90caf9', width:5 },
    ],
    '船': [
      { tool:'polyline', points:[[350,420],[380,450],[620,450],[650,420],[350,420]], color:'#795548', width:8 },
      { tool:'polyline', points:[[500,420],[500,280]], color:'#795548', width:6 },
      { tool:'polyline', points:[[500,280],[500,300],[580,380],[500,380]], color:'#e53935', width:6 },
    ],
    '时钟': [
      { tool:'polyline', points:[[500,250],[550,270],[580,310],[590,350],[580,390],[550,430],[500,450],[450,430],[420,390],[410,350],[420,310],[450,270],[500,250]], color:'#333', width:8 },
      { tool:'polyline', points:[[500,350],[500,290]], color:'#333', width:5 },
      { tool:'polyline', points:[[500,350],[550,370]], color:'#333', width:4 },
      { tool:'polyline', points:[[500,350]], color:'#e53935', width:6 },
    ],
    '灯泡': [
      { tool:'polyline', points:[[500,280],[460,320],[460,380],[500,420],[540,380],[540,320],[500,280]], color:'#ffeb3b', width:8 },
      { tool:'polyline', points:[[470,420],[470,460],[530,460],[530,420]], color:'#90a4ae', width:6 },
      { tool:'polyline', points:[[475,440],[525,440]], color:'#90a4ae', width:4 },
      { tool:'polyline', points:[[475,455],[525,455]], color:'#90a4ae', width:4 },
      { tool:'polyline', points:[[500,250],[500,230]], color:'#ff9800', width:4 },
      { tool:'polyline', points:[[540,260],[560,240]], color:'#ff9800', width:4 },
      { tool:'polyline', points:[[460,260],[440,240]], color:'#ff9800', width:4 },
    ],
    '雪人': [
      { tool:'polyline', points:[[500,450],[450,450],[430,420],[430,380],[450,350],[500,340],[550,350],[570,380],[570,420],[550,450],[500,450]], color:'#e3f2fd', width:8 },
      { tool:'polyline', points:[[500,340],[470,310],[470,270],[500,250],[530,270],[530,310],[500,340]], color:'#e3f2fd', width:7 },
      { tool:'polyline', points:[[485,290],[485,285],[490,285],[490,290]], color:'#333', width:4 },
      { tool:'polyline', points:[[510,290],[510,285],[515,285],[515,290]], color:'#333', width:4 },
      { tool:'polyline', points:[[495,305],[500,310],[505,305]], color:'#e53935', width:4 },
      { tool:'polyline', points:[[470,250],[475,240],[480,250]], color:'#333', width:5 },
    ],
    '彩虹': [
      { tool:'polyline', points:[[350,450],[350,350],[500,250],[650,350],[650,450]], color:'#e53935', width:8 },
      { tool:'polyline', points:[[370,450],[370,360],[500,270],[630,360],[630,450]], color:'#ff9800', width:7 },
      { tool:'polyline', points:[[390,450],[390,370],[500,290],[610,370],[610,450]], color:'#ffeb3b', width:7 },
      { tool:'polyline', points:[[410,450],[410,380],[500,310],[590,380],[590,450]], color:'#4caf50', width:7 },
      { tool:'polyline', points:[[430,450],[430,390],[500,330],[570,390],[570,450]], color:'#2196f3', width:7 },
      { tool:'polyline', points:[[450,450],[450,400],[500,350],[550,400],[550,450]], color:'#9c27b0', width:7 },
    ],
    '蜗牛': [
      { tool:'polyline', points:[[420,420],[450,400],[480,380],[500,350],[530,340],[560,350],[570,380],[560,410],[530,420],[500,410],[490,380],[510,360],[540,360],[555,380],[545,400],[520,400]], color:'#795548', width:7 },
      { tool:'polyline', points:[[420,420],[400,430],[380,420],[370,430]], color:'#795548', width:5 },
      { tool:'polyline', points:[[400,420],[395,410],[400,400]], color:'#795548', width:4 },
      { tool:'polyline', points:[[395,405],[392,398],[396,395]], color:'#333', width:3 },
    ],
    '蘑菇': [
      { tool:'polyline', points:[[430,380],[420,340],[440,300],[500,280],[560,300],[580,340],[570,380],[430,380]], color:'#e53935', width:8 },
      { tool:'polyline', points:[[470,380],[470,460],[530,460],[530,380]], color:'#d7ccc8', width:7 },
      { tool:'polyline', points:[[470,340],[465,335],[470,330]], color:'#fff', width:5 },
      { tool:'polyline', points:[[530,320],[525,315],[530,310]], color:'#fff', width:5 },
      { tool:'polyline', points:[[500,350],[495,345],[500,340]], color:'#fff', width:4 },
    ],
    '机器人': [
      { tool:'polyline', points:[[450,280],[450,420],[550,420],[550,280],[450,280]], color:'#607d8b', width:8 },
      { tool:'polyline', points:[[470,250],[470,280],[530,280],[530,250],[500,230],[470,250]], color:'#607d8b', width:7 },
      { tool:'polyline', points:[[475,310],[490,310],[490,325],[475,325],[475,310]], color:'#2196f3', width:4 },
      { tool:'polyline', points:[[510,310],[525,310],[525,325],[510,325],[510,310]], color:'#2196f3', width:4 },
      { tool:'polyline', points:[[480,360],[520,360],[520,380],[480,380],[480,360]], color:'#ff9800', width:4 },
      { tool:'polyline', points:[[430,320],[450,320]], color:'#607d8b', width:6 },
      { tool:'polyline', points:[[550,320],[570,320]], color:'#607d8b', width:6 },
      { tool:'polyline', points:[[470,420],[470,480],[500,480],[500,420]], color:'#607d8b', width:6 },
      { tool:'polyline', points:[[500,420],[500,480],[530,480],[530,420]], color:'#607d8b', width:6 },
    ],
  };
  return drawings[word] || null;
}

// ============ API Routes ============

// 清理离线玩家（5分钟无活动）
setInterval(() => {
  const now = Date.now();
  for (const [name, lastSeen] of Object.entries(onlinePlayers)) {
    if (now - lastSeen > 5 * 60 * 1000) delete onlinePlayers[name];
  }
}, 60000);

// 玩家加入
fastify.post('/api/join', async (req) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return { ok: false, message: '请输入名字' };
  const playerName = name.trim().substring(0, 20);
  onlinePlayers[playerName] = Date.now();
  return { ok: true, name: playerName, message: playerName + ' 加入了游戏！' };
});

// 获取在线玩家
fastify.get('/api/players', async () => {
  const now = Date.now();
  for (const [name, lastSeen] of Object.entries(onlinePlayers)) {
    if (now - lastSeen > 5 * 60 * 1000) delete onlinePlayers[name];
  }
  const players = Object.keys(onlinePlayers).map(name => ({
    name,
    score: scores[name] || 0,
    correctCount: playerGuessCorrect[name] || 0,
  }));
  return { ok: true, players, count: players.length };
});

// 排行榜API
fastify.get('/api/leaderboard', async () => {
  const entries = Object.entries(playerGuessCorrect)
    .map(([name, correct]) => ({ name, correct, score: scores[name] || 0 }))
    .sort((a, b) => b.correct - a.correct);
  return { ok: true, leaderboard: entries, recentDrawings: savedDrawings.slice(-20).reverse() };
});

// 排行榜页面
fastify.get('/leaderboard', async (req, reply) => {
  const entries = Object.entries(playerGuessCorrect)
    .map(([name, correct]) => ({ name, correct, score: scores[name] || 0 }))
    .sort((a, b) => b.correct - a.correct);
  
  const rowsHtml = entries.map((e, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i+1);
    return `<tr><td>${medal}</td><td style="color:#FFB6C1;font-weight:600">${e.name}</td><td>${e.correct}</td><td>${e.score}</td></tr>`;
  }).join('');
  
  const recentHtml = savedDrawings.slice(-10).reverse().map(d => {
    const label = d.artist === 'AI' ? '🤖 ' + (d.author || 'AI画师') : '✏️ ' + (d.author || '匿名');
    return `<div style="background:#16213e;border-radius:8px;padding:8px;margin-bottom:8px;border:1px solid #2a2a4a">
      <div style="display:flex;justify-content:space-between"><span style="color:#FFB6C1">${label}</span><span style="color:#666;font-size:11px">${(d.created_at||'').slice(0,16)}</span></div>
      ${d.answer ? '<div style="color:#87CEEB;font-size:13px">答案：'+d.answer+'</div>' : ''}
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><meta name="color-scheme" content="light"><title>🏆 排行榜</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;min-height:100vh;transition:all 0.3s}

/* 主题1: 深蓝星空 */
body.theme-space{background:#0a0a2e;color:#eee}
body.theme-space .card{background:#16213e;border:1px solid #2a2a4a}
body.theme-space .tab{background:#16213e;color:#aaa;border:1px solid #2a2a4a}
body.theme-space .tab.active-blue{background:linear-gradient(135deg,#3498db,#2196f3);color:#fff;border-color:#3498db}
body.theme-space .tab.active-pink{background:linear-gradient(135deg,#e91e63,#ff5722);color:#fff;border-color:#e91e63}
body.theme-space .drawing-area{background:#fffafc}
body.theme-space .btn{border:none;padding:10px 16px;border-radius:10px;cursor:pointer;font-size:.9em;font-weight:600;transition:all .2s}
body.theme-space .btn-pink{background:linear-gradient(135deg,#e91e63,#ff5722);color:#fff}
body.theme-space .btn-blue{background:linear-gradient(135deg,#3498db,#2196f3);color:#fff}
body.theme-space input{background:#0f3460;border:2px solid #333;color:#eee}

/* 主题2: 樱花粉 */
body.theme-sakura{background:#fff5f5;color:#333}
body.theme-sakura .card{background:#fff;border:1px solid #ffcdd2}
body.theme-sakura .tab{background:#fff;color:#888;border:1px solid #ffcdd2}
body.theme-sakura .tab.active-blue{background:linear-gradient(135deg,#f48fb1,#e91e63);color:#fff;border-color:#f48fb1}
body.theme-sakura .tab.active-pink{background:linear-gradient(135deg,#ff80ab,#ff4081);color:#fff;border-color:#ff80ab}
body.theme-sakura .drawing-area{background:#fffafc}
body.theme-sakura .btn{border:none;padding:10px 16px;border-radius:10px;cursor:pointer;font-size:.9em;font-weight:600;transition:all .2s}
body.theme-sakura .btn-pink{background:linear-gradient(135deg,#f48fb1,#e91e63);color:#fff}
body.theme-sakura .btn-blue{background:linear-gradient(135deg,#80cbc4,#009688);color:#fff}
body.theme-sakura input{background:#fff;border:2px solid #ffcdd2;color:#333}

/* 主题3: 森林绿 */
body.theme-forest{background:#1b2d1b;color:#e0e0e0}
body.theme-forest .card{background:#2d4a2d;border:1px solid #3d6b3d}
body.theme-forest .tab{background:#2d4a2d;color:#aaa;border:1px solid #3d6b3d}
body.theme-forest .tab.active-blue{background:linear-gradient(135deg,#4caf50,#2e7d32);color:#fff;border-color:#4caf50}
body.theme-forest .tab.active-pink{background:linear-gradient(135deg,#ff9800,#f57c00);color:#fff;border-color:#ff9800}
body.theme-forest .drawing-area{background:#fffafc}
body.theme-forest .btn{border:none;padding:10px 16px;border-radius:10px;cursor:pointer;font-size:.9em;font-weight:600;transition:all .2s}
body.theme-forest .btn-pink{background:linear-gradient(135deg,#ff9800,#f57c00);color:#fff}
body.theme-forest .btn-blue{background:linear-gradient(135deg,#4caf50,#2e7d32);color:#fff}
body.theme-forest input{background:#1b2d1b;border:2px solid #3d6b3d;color:#e0e0e0}

/* 通用样式 */
.drawing-area{border-radius:12px;overflow:hidden;margin-bottom:12px;min-height:200px;color-scheme:light}
.drawing-area svg{width:100%;height:auto;display:block}
canvas{width:100%;border-radius:12px;touch-action:none;background:#fffafc;cursor:crosshair;display:block;color-scheme:light}
.tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;justify-content:center}
.tab{flex:1;min-width:60px;padding:10px 8px;border-radius:10px;text-align:center;cursor:pointer;font-weight:600;font-size:.85em;transition:all .2s;user-select:none}
.empty-state{text-align:center;padding:60px 20px;color:#999}
.input-row{display:flex;gap:8px}
.input-row input{flex:1;padding:10px 14px;border-radius:10px;font-size:1em;outline:0}
.input-row input:focus{border-color:#3498db}
.btn{border:none;padding:10px 16px;border-radius:10px;cursor:pointer;font-size:.9em;font-weight:600;transition:all .2s}
.btn:active{transform:scale(0.95)}
.correct-banner{position:fixed;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);z-index:100}
.correct-banner>div{font-size:2em;color:#FFD700;text-align:center}
.color-btn{width:28px;height:28px;border-radius:50%;border:2px solid transparent;cursor:pointer;transition:all .2s}
.color-btn.sel{border-color:#fff;transform:scale(1.2)}
.color-btn:active{transform:scale(0.9)}
.tool-btn{padding:6px 10px;border-radius:8px;border:2px solid transparent;cursor:pointer;font-size:.8em;transition:all .2s}
.tool-btn.active{border-color:#e91e63;background:#e91e63;color:#fff}
.theme-switcher{position:fixed;bottom:16px;right:16px;z-index:999;display:flex;gap:6px}
.theme-btn{width:36px;height:36px;border-radius:50%;border:2px solid rgba(255,255,255,0.5);cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:all .2s}
.theme-btn:hover{transform:scale(1.1)}
.theme-btn.active{border-color:#FFD700;box-shadow:0 0 12px #FFD700}
@media(max-width:480px){
  .color-btn{width:24px;height:24px}
  .tab{padding:8px 6px;font-size:.8em}
  .theme-btn{width:30px;height:30px}
}</style>
</head><body class="theme-space">
<!-- 加入游戏弹窗 -->
<div id="join-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center">
  <div style="background:#16213e;border-radius:16px;padding:32px;text-align:center;max-width:320px;width:90%">
    <div style="font-size:2em;margin-bottom:16px">🎨 你画我猜</div>
    <div style="color:#999;margin-bottom:20px">输入你的名字开始游戏</div>
    <input id="player-name-input" placeholder="你的名字（如：月汐）" style="width:100%;padding:12px;border-radius:10px;border:2px solid #3498db;background:#0f3460;color:#eee;font-size:1.1em;text-align:center;outline:0;margin-bottom:16px">
    <button onclick="joinGame()" style="width:100%;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#e91e63,#ff5722);color:#fff;font-size:1.1em;font-weight:600;cursor:pointer">开始游戏 🎮</button>
  </div>
</div>
<script>
function joinGame() {
  const input = document.getElementById("player-name-input");
  const name = input ? input.value.trim() : "";
  if (!name) return alert("请输入你的名字！");
  localStorage.setItem("draw-player", name);
  document.getElementById("join-modal").style.display = "none";
  document.getElementById("player-badge").textContent = "👤 " + name;
}
// 检查是否已加入
const saved = localStorage.getItem("draw-player");
if (saved) {
  document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("join-modal").style.display = "none";
    document.getElementById("player-badge").textContent = "👤 " + saved;
  });
}
function getPlayer() { return localStorage.getItem("draw-player") || "匿名"; }
</script>

<a href="/" class="back">← 返回游戏</a>
<h1>🏆 排行榜</h1>
${entries.length ? '<table><thead><tr><th>排名</th><th>玩家</th><th>猜对</th><th>得分</th></tr></thead><tbody>'+rowsHtml+'</tbody></table>' : '<div class="empty">还没有人猜对过~</div>'}
<h2>📜 最近画作</h2>
${savedDrawings.length ? recentHtml : '<div class="empty">还没有画作~</div>'}

<!-- 主题切换 -->
<div class="theme-switcher">
  <div class="theme-btn active" style="background:linear-gradient(135deg,#0a0a2e,#1a1a2e)" onclick="setTheme('space')" title="深蓝星空"></div>
  <div class="theme-btn" style="background:linear-gradient(135deg,#fff5f5,#ffcdd2)" onclick="setTheme('sakura')" title="樱花粉"></div>
  <div class="theme-btn" style="background:linear-gradient(135deg,#1b2d1b,#2d4a2d)" onclick="setTheme('forest')" title="森林绿"></div>
</div>
<script>
function setTheme(name) {
  document.body.className = 'theme-' + name;
  localStorage.setItem('draw-theme', name);
  document.querySelectorAll('.theme-btn').forEach((b,i) => {
    b.classList.toggle('active', ['space','sakura','forest'][i] === name);
  });
}
// 加载保存的主题
const saved = localStorage.getItem('draw-theme');
if (saved) setTheme(saved);
</script>
</body></html>`;
  reply.type('text/html; charset=utf-8');
  return html;
});

fastify.post('/api/start', async (req) => {
  const body = req.body || {};
  const { answer, content, aliases = [], artist = 'AI', author = 'AI画师' } = body;
  if (!answer || !content) return { ok: false, message: '需要 answer 和 content' };
  currentRound = {
    answer, aliases, artist, author: (author || (artist === 'AI' ? 'AI画师' : '匿名')), content,
    drawing_svg: strokesToSvg(content),
    ascii_grid: makeAsciiGrid(content),
    ascii_grid_note: ASCII_NOTE,
    canvas: '1000x700',
    created_at: new Date().toISOString(),
    guesses: [],
    hintsRevealed: 0,
    startTime: Date.now(),
  };
  return { ok: true, message: '新一局开始！画师: ' + author };
});

fastify.get('/api/status', async () => {
  if (!currentRound) return { ok: true, current: null };
  const elapsed = Math.floor((Date.now() - currentRound.startTime) / 1000);
  return {
    ok: true,
    current: {
      canvas: currentRound.canvas,
      artist: currentRound.artist,
      author: currentRound.author || '匿名',
      description: describeStrokes(currentRound.content),
      created_at: currentRound.created_at,
      drawing_svg: currentRound.drawing_svg,
      ascii_grid: currentRound.ascii_grid,
      ascii_grid_note: currentRound.ascii_grid_note,
      elapsed,
      hintsRevealed: currentRound.hintsRevealed,
      answerLength: currentRound.answer ? currentRound.answer.length : 0,
      guesses: currentRound.guesses,
    }
  };
});

fastify.post('/api/guess', async (req) => {
  if (!currentRound) return { ok: false, message: '当前没有进行中的画作' };
  const { guesser = 'user', content = '' } = req.body || {};
  const guess = content.trim().toLowerCase();
  if (!guess) return { ok: false, message: '请输入猜测内容' };
  // 用户画的画没有答案，只有AI画的才有
  if (!currentRound.answer) return { ok: false, message: '当前画作没有答案（用户画的），AI需要用draw_submit_guess来猜' };
  const validAnswers = [currentRound.answer.toLowerCase(), ...currentRound.aliases.map(a => a.toLowerCase())];
  const correct = validAnswers.includes(guess);
  currentRound.guesses.push({ guesser, content: content.trim(), correct, time: new Date().toISOString() });
  if (correct) {
    // Update score and correct count
    scores[guesser] = (scores[guesser] || 0) + 1;
    playerGuessCorrect[guesser] = (playerGuessCorrect[guesser] || 0) + 1;
    // 更新在线状态
    if (onlinePlayers[guesser]) onlinePlayers[guesser] = Date.now();
    return { ok: true, correct: true, message: '🎉 恭喜 ' + guesser + '，猜对了！答案是「' + currentRound.answer + '」', answer: currentRound.answer };
  }
  return { ok: true, correct: false, message: `❌ 「${content.trim()}」不对哦，再想想～` };
});

// AI猜用户画的画（没有标准答案，记录猜测让用户确认）
fastify.post('/api/ai_guess', async (req) => {
  if (!currentRound) return { ok: false, message: '当前没有画作' };
  if (currentRound.answer) return { ok: false, message: '当前是AI画的，用/api/guess来猜' };
  const { guess = '' } = req.body || {};
  if (!guess.trim()) return { ok: false, message: '请输入猜测' };
  currentRound.guesses.push({ guesser: 'AI', content: guess.trim(), correct: false, time: new Date().toISOString() });
  return { ok: true, guess: guess.trim(), message: `AI猜的是「${guess.trim()}」，对不对呢？` };
});

fastify.post('/api/draw', async (req) => {
  const { content, answer, aliases, author } = req.body || {};
  if (!content || !Array.isArray(content) || content.length === 0) return { ok: false, message: '需要 content（笔画数组）' };
  if (!answer || !answer.trim()) return { ok: false, message: '请填写答案！' };
  if (!author || !author.trim()) return { ok: false, message: '请填写署名！' };
  currentRound = {
    answer: answer || null, aliases: aliases || [], artist: 'user', author: author || '匿名', content,
    drawing_svg: strokesToSvg(content),
    ascii_grid: makeAsciiGrid(content),
    ascii_grid_note: ASCII_NOTE,
    canvas: '1000x700',
    created_at: new Date().toISOString(),
    guesses: [],
    hintsRevealed: 0,
    startTime: Date.now(),
  };
  // 保存到画廊
  savedDrawings.push({
    id: Date.now(),
    artist: 'user',
    author: author || '匿名',
    comments: [],
    answer: answer || null,
    drawing_svg: currentRound.drawing_svg,
    ascii_grid: currentRound.ascii_grid,
    description: describeStrokes(content),
    created_at: currentRound.created_at,
    guesses: []
  });
  // 保留最近50幅
  if (savedDrawings.length > 50) savedDrawings = savedDrawings.slice(-50);
  
  return { ok: true, ascii_grid: currentRound.ascii_grid, ascii_grid_note: ASCII_NOTE };
});

fastify.post('/api/demo', async () => {
  const demo = DEMO_DRAWINGS[Math.floor(Math.random() * DEMO_DRAWINGS.length)];
  currentRound = {
    answer: demo.answer, aliases: demo.aliases, artist: 'AI', author: 'AI画师', content: demo.content,
    drawing_svg: strokesToSvg(demo.content),
    ascii_grid: makeAsciiGrid(demo.content),
    ascii_grid_note: ASCII_NOTE,
    canvas: '1000x700',
    created_at: new Date().toISOString(),
    guesses: [],
    hintsRevealed: 0,
    startTime: Date.now(),
  };
  // 保存到画廊
  savedDrawings.push({
    id: Date.now(),
    artist: 'AI',
    author: 'AI画师',
    comments: [],
    answer: demo.answer,
    aliases: demo.aliases,
    drawing_svg: currentRound.drawing_svg,
    ascii_grid: currentRound.ascii_grid,
    description: describeStrokes(currentRound.content),
    created_at: currentRound.created_at,
    guesses: []
  });
  if (savedDrawings.length > 50) savedDrawings = savedDrawings.slice(-50);
  
  return { ok: true, message: '新一局开始！画师: AI画师', answer: demo.answer };
});

fastify.get('/api/random', async () => {
  const entry = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
  const drawing = generateSimpleDrawing(entry);
  if (!drawing) {
    // Fallback to a demo drawing
    const demo = DEMO_DRAWINGS[Math.floor(Math.random() * DEMO_DRAWINGS.length)];
    currentRound = {
      answer: demo.answer, aliases: demo.aliases, artist: 'AI', author: 'AI画师', content: demo.content,
      drawing_svg: strokesToSvg(demo.content),
      ascii_grid: makeAsciiGrid(demo.content),
      ascii_grid_note: ASCII_NOTE,
      canvas: '1000x700',
      created_at: new Date().toISOString(),
      guesses: [],
      hintsRevealed: 0,
      startTime: Date.now(),
    };
    return { ok: true, message: '随机一局开始！（画师：AI画师）', answer: demo.answer };
  }
  currentRound = {
    answer: entry.word, aliases: entry.aliases, artist: 'AI', author: 'AI画师', content: drawing,
    drawing_svg: strokesToSvg(drawing),
    ascii_grid: makeAsciiGrid(drawing),
    ascii_grid_note: ASCII_NOTE,
    canvas: '1000x700',
    created_at: new Date().toISOString(),
    guesses: [],
    hintsRevealed: 0,
    startTime: Date.now(),
  };
  return { ok: true, message: '随机一局开始！（画师：AI画师）', answer: entry.word };
});

fastify.get('/api/score', async () => {
  return { ok: true, scores };
});

// ============ Frontend ============

const FRONTEND = String.raw`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="color-scheme" content="light">
<title>🎨 你画我猜</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;min-height:100vh;overflow-x:hidden}
.header{text-align:center;padding:16px 12px 4px}
.header h1{font-size:1.5em;background:linear-gradient(135deg,var(--blue),var(--pink));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.tabs{display:flex;gap:8px;justify-content:center;margin:10px 0 8px}
.tab{padding:10px 22px;border-radius:20px;border:2px solid #333;background:0;color:#aaa;font-size:.9em;cursor:pointer;transition:all .25s;user-select:none}
.tab.active-blue{border-color:var(--blue);background:rgba(135,206,235,.12);color:var(--blue)}
.tab.active-pink{border-color:var(--pink);background:rgba(255,182,193,.12);color:var(--pink)}
.mode{display:none;max-width:640px;margin:0 auto;padding:0 12px 32px}
.mode.active{display:block}
.card{background:var(--card);border-radius:16px;padding:16px;margin-bottom:12px;border:1px solid var(--border)}
.drawing-area{background:#fffafc;border-radius:12px;overflow:hidden;margin-bottom:12px;min-height:200px;color-scheme:light}
.drawing-area svg{width:100%;height:auto;display:block}
canvas{width:100%;border-radius:12px;touch-action:none;background:#fffafc;cursor:crosshair;display:block;color-scheme:light}
.input-row{display:flex;gap:8px}
.input-row input{flex:1;padding:10px 14px;border-radius:10px;border:2px solid #333;background:#0f3460;color:#eee;font-size:1em;outline:0}
.input-row input:focus{border-color:var(--blue)}
.btn{padding:10px 18px;border-radius:10px;border:none;font-size:.9em;cursor:pointer;transition:all .2s;font-weight:600;user-select:none}
.btn:active{transform:scale(.96)}
.btn-blue{background:var(--blue);color:#1a1a2e}
.btn-pink{background:var(--pink);color:#1a1a2e}
.btn-ghost{background:0;border:2px solid #555;color:#aaa}
.btn-ghost:hover{border-color:#777;color:#ccc}
.guess-list{max-height:160px;overflow-y:auto;margin-top:8px}
.guess-item{padding:6px 10px;border-radius:8px;margin-bottom:4px;font-size:.88em;display:flex;align-items:center;gap:6px}
.gi-correct{background:rgba(80,200,120,.18);color:#50C878}
.gi-wrong{background:rgba(255,100,100,.12);color:#ff6b6b}
.tools{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
.color-btn{width:26px;height:26px;border-radius:50%;border:3px solid transparent;cursor:pointer;transition:all .2s;flex-shrink:0}
.color-btn.sel{border-color:#fff;transform:scale(1.2)}
.width-slider{width:80px;accent-color:var(--pink)}
.tool-btn{padding:6px 12px;border-radius:8px;border:1px solid #444;background:#0f3460;color:#aaa;font-size:.8em;cursor:pointer;transition:all .2s}
.tool-btn:hover{border-color:var(--blue);color:var(--blue)}
.tool-btn.active{border-color:var(--pink);color:var(--pink);background:rgba(255,182,193,.1)}
.timer-bar{height:6px;border-radius:3px;background:#333;margin:8px 0;overflow:hidden}
.timer-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--blue),var(--pink));transition:width 1s linear;width:100%}
.hint-display{text-align:center;font-size:1.4em;letter-spacing:8px;margin:8px 0;color:var(--pink);font-weight:700;min-height:1.8em}
.score-box{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:6px 0}
.score-item{background:#0f3460;padding:4px 12px;border-radius:12px;font-size:.85em;color:var(--blue)}
.empty-state{text-align:center;color:#666;padding:32px 16px;font-size:.95em}
.btn-row{display:flex;gap:8px;margin-top:10px}
.btn-row .btn{flex:1;text-align:center}
.correct-banner{background:linear-gradient(135deg,rgba(80,200,120,.2),rgba(80,200,120,.05));border:1px solid rgba(80,200,120,.3);border-radius:12px;padding:14px;text-align:center;margin-bottom:10px}
.correct-banner .emoji{font-size:32px}
.correct-banner .txt{color:#50C878;font-size:1.1em;font-weight:600;margin-top:4px}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.card{animation:fadeIn .35s ease}
@media(max-width:480px){
  .header h1{font-size:1.2em}
  .tab{padding:8px 16px;font-size:.82em}
  .color-btn{width:22px;height:22px}
  .hint-display{font-size:1.1em;letter-spacing:5px}
}
</style>
</head>
<body class="theme-space">
</script>

<div class="header"><h1>🎨 你画我猜</h1></div>
<div class="tabs">
  <button class="tab active-blue" id="tab-guess" onclick="switchMode('guess')">🎯 猜画</button>
  <button class="tab" id="tab-draw" onclick="switchMode('draw')">🖌️ 画板</button>
  <span id="player-badge" style="padding:8px 12px;border-radius:20px;background:#e91e63;color:#fff;font-size:.85em;font-weight:600;white-space:nowrap">👤 匿名</span>
  <a href="/gallery" class="tab" style="text-decoration:none;color:inherit">🖼️ 画廊</a>
  <a href="/leaderboard" class="tab" style="text-decoration:none;color:inherit">🏆 排行榜</a>
</div>

<!-- Guessing Mode -->
<div class="mode active" id="mode-guess">
  <div class="card">
    <div id="score-box" class="score-box"></div>
    <div id="timer-bar" class="timer-bar" style="display:none"><div id="timer-fill" class="timer-fill"></div></div>
    <div id="hint-display" class="hint-display" style="display:none"></div>
    <div id="guess-drawing" class="drawing-area"><div class="empty-state">点击「新一局」或「随机一局」开始游戏～</div></div>
    <div id="correct-banner" style="display:none"></div>
    <div class="input-row" style="margin:10px 0">
      <input id="guess-input" placeholder="输入你的猜测..." autocomplete="off">
      <button class="btn btn-blue" onclick="submitGuess()">猜！</button>
    </div>
    <div id="guess-history" class="guess-list"></div>
    <div class="btn-row">
      <button class="btn btn-ghost" onclick="newDemoRound()">🔄 新一局</button>
      <button class="btn btn-pink" onclick="newRandomRound()">🎲 随机一局</button>
    </div>
  </div>
</div>

<!-- Drawing Mode -->
<div class="mode" id="mode-draw">
  <div class="card">
    <div class="tools" style="gap:5px">
      <div class="color-btn sel" style="background:#000" data-c="#000" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#4f454b" data-c="#4f454b" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#9e9e9e" data-c="#9e9e9e" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#fff;border:1px solid #555" data-c="#fff" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#e53935" data-c="#e53935" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#f44336" data-c="#f44336" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#ff5722" data-c="#ff5722" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#ff9800" data-c="#ff9800" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#ffc107" data-c="#ffc107" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#ffeb3b" data-c="#ffeb3b" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#cddc39" data-c="#cddc39" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#4caf50" data-c="#4caf50" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#009688" data-c="#009688" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#00bcd4" data-c="#00bcd4" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#2196f3" data-c="#2196f3" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#1565c0" data-c="#1565c0" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#9c27b0" data-c="#9c27b0" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#e91e63" data-c="#e91e63" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#f48fb1" data-c="#f48fb1" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#795548" data-c="#795548" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#607d8b" data-c="#607d8b" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#90a4ae" data-c="#90a4ae" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#d7ccc8" data-c="#d7ccc8" onclick="pickColor(this)"></div>
      <div class="color-btn" style="background:#a1887f" data-c="#a1887f" onclick="pickColor(this)"></div>
      <input type="color" id="custom-color" value="#000" style="width:26px;height:26px;border:none;border-radius:50%;cursor:pointer;padding:0;background:none" onchange="pickCustomColor(this.value)" title="自选颜色">
    </div>
    <div class="tools">
      <span style="color:#888;font-size:.8em">粗细</span>
      <input type="range" class="width-slider" min="2" max="20" value="6" id="stroke-width" oninput="document.getElementById('wlabel').textContent=this.value+'px'">
      <span id="wlabel" style="color:#888;font-size:.8em">6px</span>
      <span style="color:#555;margin:0 2px">|</span>
      <button class="tool-btn active" id="pen-btn" onclick="setTool('polyline')">✏️ 画笔</button>
      <button class="tool-btn" id="rect-btn" onclick="setTool('rect')">▭ 矩形</button>
      <button class="tool-btn" id="circle-btn" onclick="setTool('circle')">◯ 圆形</button>
      <button class="tool-btn" id="line-btn" onclick="setTool('line')">╱ 直线</button>
      <button class="tool-btn" id="arrow-btn" onclick="setTool('arrow')">→ 箭头</button>
      <span style="color:#555;margin:0 2px">|</span>
      <button class="tool-btn" id="eraser-btn" onclick="toggleEraser()">🧹 橡皮</button>
      <button class="tool-btn" onclick="undoStroke()">↩ 撤销</button>
      <button class="tool-btn" onclick="clearCanvas()">🗑 清除</button>
    </div>
    <canvas id="draw-canvas" width="1000" height="700"></canvas>
    <div class="btn-row" style="margin-top:10px">
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
        <div style="display:flex;gap:8px">
          <input id="draw-answer" placeholder="答案（例如：猫）" style="flex:1;padding:10px 14px;border-radius:10px;border:2px solid var(--border);background:#0f3460;color:#eee;font-size:1em;outline:0">
          <input id="draw-author" placeholder="署名" style="width:80px;padding:10px 14px;border-radius:10px;border:2px solid var(--border);background:#0f3460;color:#eee;font-size:1em;outline:0;text-align:center">
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-pink" style="flex:1" onclick="submitDrawing()">📤 提交画作</button>
          <button class="btn btn-ghost" style="flex:1" onclick="saveDrawing()">💾 保存图片</button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Leaderboard Mode -->
<div class="mode" id="mode-leaderboard">
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span style="color:#FFB6C1;font-size:1.1em;font-weight:600">🏆 猜对排行榜</span>
      <span id="online-count" style="color:#87CEEB;font-size:.85em"></span>
    </div>
    <div id="leaderboard-list"></div>
    <div style="margin-top:16px">
      <span style="color:#87CEEB;font-size:.9em;font-weight:600">👥 在线玩家</span>
      <div id="players-list" style="margin-top:8px"></div>
    </div>
    <div style="margin-top:16px">
      <span style="color:#FFB6C1;font-size:.9em;font-weight:600">🖼 最近画作</span>
      <div id="recent-drawings" style="margin-top:8px"></div>
    </div>
  </div>
</div>

<script>
const $=id=>document.getElementById(id);
let guessHistory=[],timerInterval=null,currentTime=0,roundActive=false,solved=false;
let currentPlayerName=localStorage.getItem('playerName')||'';

// ===== Mode switching =====
function switchMode(m){
  $('mode-guess').classList.toggle('active',m==='guess');
  $('mode-draw').classList.toggle('active',m==='draw');
  $('mode-leaderboard').classList.toggle('active',m==='leaderboard');
  $('tab-guess').className='tab'+(m==='guess'?' active-blue':'');
  $('tab-draw').className='tab'+(m==='draw'?' active-pink':'');
  $('tab-leaderboard').className='tab'+(m==='leaderboard'?' active-blue':'');
  if(m==='draw')initCanvas();
  if(m==='leaderboard')loadLeaderboard();
}

// ===== Player Join =====
if(currentPlayerName){
  $('player-name').value=currentPlayerName;
  $('player-status').textContent='已加入';
  fetch('/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:currentPlayerName})});
}
  const d=await r.json();
  if(d.ok){
    currentPlayerName=name;
    localStorage.setItem('playerName',name);
    $('player-status').textContent='✅ '+d.message;
  }else{
    $('player-status').textContent='❌ '+d.message;
  }
}

// ===== Guessing =====
async function loadStatus(){
  try{
    const r=await fetch('/api/status');const d=await r.json();
    if(d.ok&&d.current&&d.current.drawing_svg){
      // 显示署名
      const authorLabel = d.current.artist==='user' ? '✏️ '+(d.current.author||'匿名') : '🤖 '+(d.current.author||'艾因');
      const authorHtml = '<div style="text-align:center;color:#FFB6C1;font-size:13px;margin-bottom:8px">'+authorLabel+' 的画作</div>';
      $('guess-drawing').innerHTML = authorHtml + d.current.drawing_svg;
      // 显示ASCII网格+文字描述
      let infoBox = document.getElementById('info-box');
      if(!infoBox){infoBox=document.createElement('div');infoBox.id='info-box';infoBox.style.cssText='margin-top:8px';$('guess-drawing').parentNode.insertBefore(infoBox,$('guess-drawing').nextSibling);}
      let infoHtml = '';
      if(d.current.ascii_grid){
        infoHtml += '<div style="color:#87CEEB;font-size:11px;font-family:monospace;background:#0a0a1a;padding:8px;border-radius:8px;overflow-x:auto;white-space:pre;line-height:1.1">'+d.current.ascii_grid+'</div>';
      }
      if(d.current.description){
        infoHtml += '<div style="color:#999;font-size:12px;margin-top:6px;padding:8px;background:#0a0a1a;border-radius:8px;white-space:pre-line">'+d.current.description+'</div>';
      }
      infoBox.innerHTML = infoHtml;
      roundActive=true;solved=false;
      $('correct-banner').style.display='none';
      startTimer(d.current.elapsed||0);
      if(d.current.guesses)renderGuesses(d.current.guesses);
    }
  }catch(e){}
}
loadStatus();
// 每5秒自动刷新，AI画完后页面自动更新
setInterval(loadStatus, 5000);

async function newDemoRound(){
  await fetch('/api/demo',{method:'POST'});
  resetRound();loadStatus();
}
async function newRandomRound(){
  await fetch('/api/random',{method:'POST'});
  resetRound();loadStatus();
}
function resetRound(){
  guessHistory=[];$('guess-history').innerHTML='';
  $('guess-input').value='';solved=false;
  $('correct-banner').style.display='none';
  clearInterval(timerInterval);
}
function startTimer(elapsed){
  clearInterval(timerInterval);
  currentTime=elapsed;
  $('timer-bar').style.display='block';
  updateTimerBar();
  timerInterval=setInterval(()=>{
    currentTime++;
    updateTimerBar();
    if(currentTime%15===0&&currentTime>0){}
    if(currentTime>=60){clearInterval(timerInterval);roundActive=false;}
  },1000);
}
function updateTimerBar(){
  const pct=Math.max(0,100-currentTime/60*100);
  $('timer-fill').style.width=pct+'%';
  if(pct<20)$('timer-fill').style.background='#e53935';
  else if(pct<50)$('timer-fill').style.background='linear-gradient(90deg,#ff9800,#ffeb3b)';
  else $('timer-fill').style.background='linear-gradient(90deg,var(--blue),var(--pink))';
}
function updateHint(){}
function renderGuesses(guesses){
  $('guess-history').innerHTML=guesses.map(g=>
    '<div class="guess-item '+(g.correct?'gi-correct':'gi-wrong')+'">'+(g.correct?'✅':'❌')+' <b>'+g.guesser+'</b>: '+g.content+'</div>'
  ).join('');
}
async function submitGuess(){
  if(solved)return;
  const inp=$('guess-input'),val=inp.value.trim();
  if(!val)return;inp.value='';
  const guesserName=currentPlayerName||'玩家';const r=await fetch('/api/guess',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guesser:guesserName,content:val})});
  const d=await r.json();
  guessHistory.unshift({correct:d.correct,content:val});
  renderGuesses(guessHistory);
  if(d.correct){
    solved=true;roundActive=false;clearInterval(timerInterval);
    $('correct-banner').innerHTML='<div class="emoji">🎉</div><div class="txt">恭喜猜对！答案是「'+d.answer+'」</div>';
    $('correct-banner').style.display='block';
    loadScores();
  }
  inp.focus();
}
$('guess-input').addEventListener('keydown',e=>{if(e.key==='Enter')submitGuess()});

// ===== Leaderboard =====
async function loadLeaderboard(){
  try{
    const r=await fetch('/api/leaderboard');const d=await r.json();
    if(d.ok){
      // 排行榜
      const lb=d.leaderboard||[];
      $('leaderboard-list').innerHTML=lb.length?lb.map((e,i)=>{
        const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'  '+(i+1)+'.';
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:8px;margin-bottom:4px;background:'+(i<3?'rgba(135,206,235,.08)':'#0f3460')+'">'+medal+' <b>'+e.name+'</b><span style="color:#87CEEB">'+e.correct+'次猜对</span></div>';
      }).join(''):'<div style="color:#666;text-align:center;padding:12px">还没有人猜对过～</div>';
      // 最近画作
      const rd=d.recentDrawings||[];
      $('recent-drawings').innerHTML=rd.length?rd.slice(0,8).map(d=>{
        const label=d.artist==='AI'?'🤖 '+(d.author||'AI画师'):'✏️ '+(d.author||'匿名');
        return '<div style="display:flex;gap:8px;align-items:center;padding:6px;border-bottom:1px solid #2a2a4a">'+label+'<span style="color:#87CEEB;font-size:.85em">'+(d.answer||'自由画')+'</span><span style="color:#666;font-size:.8em;margin-left:auto">'+(d.created_at||'').slice(11,16)+'</span></div>';
      }).join(''):'<div style="color:#666;text-align:center;padding:12px">暂无画作</div>';
    }
  }catch(e){}
  // 在线玩家
  try{
    const r=await fetch('/api/players');const d=await r.json();
    if(d.ok){
      $('online-count').textContent='在线: '+d.count+'人';
      $('players-list').innerHTML=d.players.length?d.players.map(p=>
        '<span style="display:inline-block;padding:4px 10px;border-radius:12px;background:#0f3460;margin:2px 4px;font-size:.85em;color:'+(p.name===currentPlayerName?'#FFB6C1':'#87CEEB')+'">'+p.name+(p.correctCount>0?' ('+p.correctCount+'次)':'')+'</span>'
      ).join(''):'<span style="color:#666;font-size:.85em">暂无在线玩家</span>';
    }
  }catch(e){}
}

// ===== Scores =====
async function loadScores(){
  try{const r=await fetch('/api/score');const d=await r.json();
  if(d.ok){
    const entries=Object.entries(d.scores).sort((a,b)=>b[1]-a[1]);
    $('score-box').innerHTML=entries.length?entries.map(([n,s])=>'<span class="score-item">🏆 '+n+': '+s+'分</span>').join(''):'';
  }}catch(e){}
}
loadScores();

// ===== Drawing Canvas =====
const canvas=$('draw-canvas');
const ctx=canvas.getContext('2d');
let drawing=false,strokes=[],curStroke=null,curColor='#000',isEraser=false;
let currentTool='polyline',shapeStart=null;

// 初始化canvas尺寸
function initCanvas(){
  const w=canvas.parentElement.clientWidth;
  const h=Math.round(w*0.7);
  canvas.width=w;
  canvas.height=h;
  canvas.style.width=w+'px';
  canvas.style.height=h+'px';
  ctx.fillStyle='#fffafc';
  ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#000';
  ctx.lineCap='round';
  ctx.lineJoin='round';
}
setTimeout(initCanvas,200);

function getXY(e){
  const r=canvas.getBoundingClientRect();
  const t=e.touches?e.touches[0]:e;
  return{x:t.clientX-r.left, y:t.clientY-r.top};
}

function isShapeTool(t){return t==='rect'||t==='circle'||t==='line'||t==='arrow';}

function startDraw(e){
  e.preventDefault();
  drawing=true;
  const p=getXY(e);
  const w=parseInt($('stroke-width').value)||6;
  const c=isEraser?'#fffafc':curColor;
  if(isShapeTool(currentTool)&&!isEraser){
    shapeStart={x:Math.round(p.x),y:Math.round(p.y)};
    curStroke=null;
  } else {
    curStroke={tool:'polyline',points:[[Math.round(p.x),Math.round(p.y)]],color:c,width:isEraser?w*2:w};
    ctx.beginPath();
    ctx.moveTo(p.x,p.y);
    ctx.strokeStyle=c;
    ctx.lineWidth=isEraser?w*2:w;
  }
}

function drawShapePreview(tool,x1,y1,x2,y2,color,lineWidth){
  ctx.save();
  ctx.strokeStyle=color;
  ctx.lineWidth=lineWidth;
  ctx.lineCap='round';
  ctx.lineJoin='round';
  ctx.setLineDash([6,4]);
  ctx.beginPath();
  if(tool==='rect'){
    ctx.strokeRect(x1,y1,x2-x1,y2-y1);
  } else if(tool==='circle'){
    const cx=(x1+x2)/2,cy=(y1+y2)/2,rx=Math.abs(x2-x1)/2,ry=Math.abs(y2-y1)/2;
    ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);
    ctx.stroke();
  } else if(tool==='line'){
    ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  } else if(tool==='arrow'){
    ctx.setLineDash([]);
    ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    // arrowhead
    const angle=Math.atan2(y2-y1,x2-x1);
    const headLen=Math.max(12,lineWidth*3);
    ctx.beginPath();
    ctx.moveTo(x2,y2);
    ctx.lineTo(x2-headLen*Math.cos(angle-Math.PI/6),y2-headLen*Math.sin(angle-Math.PI/6));
    ctx.moveTo(x2,y2);
    ctx.lineTo(x2-headLen*Math.cos(angle+Math.PI/6),y2-headLen*Math.sin(angle+Math.PI/6));
    ctx.stroke();
  }
  ctx.restore();
}

function moveDraw(e){
  if(!drawing)return;
  e.preventDefault();
  const p=getXY(e);
  if(isShapeTool(currentTool)&&shapeStart&&!isEraser){
    // Preview: redraw canvas then overlay preview shape
    redraw();
    const w=parseInt($('stroke-width').value)||6;
    drawShapePreview(currentTool,shapeStart.x,shapeStart.y,Math.round(p.x),Math.round(p.y),curColor,w);
  } else if(curStroke){
    curStroke.points.push([Math.round(p.x),Math.round(p.y)]);
    ctx.lineTo(p.x,p.y);
    ctx.stroke();
  }
}

function endDraw(e){
  if(!drawing)return;
  if(e)e.preventDefault();
  drawing=false;
  if(isShapeTool(currentTool)&&shapeStart&&!isEraser){
    const p=getXY(e)||{x:shapeStart.x,y:shapeStart.y};
    const w=parseInt($('stroke-width').value)||6;
    const x1=shapeStart.x,y1=shapeStart.y,x2=Math.round(p.x),y2=Math.round(p.y);
    // Only add if shape has some size
    if(Math.abs(x2-x1)>3||Math.abs(y2-y1)>3){
      strokes.push({tool:currentTool,points:[[x1,y1],[x2,y2]],color:curColor,width:w});
    }
    shapeStart=null;
    redraw();
  } else {
    if(curStroke&&curStroke.points.length>1)strokes.push(curStroke);
    curStroke=null;
  }
}
canvas.addEventListener('mousedown',startDraw);
canvas.addEventListener('mousemove',moveDraw);
canvas.addEventListener('mouseup',endDraw);
canvas.addEventListener('mouseleave',endDraw);
canvas.addEventListener('touchstart',startDraw,{passive:false});
canvas.addEventListener('touchmove',moveDraw,{passive:false});
canvas.addEventListener('touchend',endDraw,{passive:false});

function setTool(tool){
  currentTool=tool;
  isEraser=false;
  document.querySelectorAll('[id$="-btn"]').forEach(b=>{
    if(['pen-btn','rect-btn','circle-btn','line-btn','arrow-btn','eraser-btn'].includes(b.id))b.classList.remove('active');
  });
  const btn=$(tool==='polyline'?'pen-btn':tool+'-btn');
  if(btn)btn.classList.add('active');
  $('eraser-btn').classList.remove('active');
}
function pickColor(el){
  document.querySelectorAll('.color-btn').forEach(b=>b.classList.remove('sel'));
  el.classList.add('sel');
  curColor=el.dataset.c;
  isEraser=false;
  $('eraser-btn').classList.remove('active');
  // Reset custom color input
  const cc=$('custom-color');if(cc)cc.value=curColor;
}
function pickCustomColor(val){
  curColor=val;
  document.querySelectorAll('.color-btn').forEach(b=>b.classList.remove('sel'));
  isEraser=false;
  $('eraser-btn').classList.remove('active');
}
function toggleEraser(){
  isEraser=!isEraser;
  $('eraser-btn').classList.toggle('active',isEraser);
  if(isEraser){
    document.querySelectorAll('[id$="-btn"]').forEach(b=>{
      if(['pen-btn','rect-btn','circle-btn','line-btn','arrow-btn'].includes(b.id))b.classList.remove('active');
    });
  }
}
function undoStroke(){
  strokes.pop();
  redraw();
}
function clearCanvas(){
  strokes=[];
  ctx.fillStyle='#fffafc';
  ctx.fillRect(0,0,canvas.width,canvas.height);
}

function renderStroke(ctx2,s){
  if(s.tool==='polyline'){
    if(s.points.length<2)return;
    ctx2.beginPath();
    ctx2.strokeStyle=s.color;
    ctx2.lineWidth=s.width;
    ctx2.lineCap='round';
    ctx2.lineJoin='round';
    ctx2.moveTo(s.points[0][0],s.points[0][1]);
    for(let i=1;i<s.points.length;i++)ctx2.lineTo(s.points[i][0],s.points[i][1]);
    ctx2.stroke();
  } else if(s.tool==='rect'){
    const[x1,y1]=s.points[0],[x2,y1b]=s.points[1];
    ctx2.strokeStyle=s.color;ctx2.lineWidth=s.width;ctx2.lineJoin='round';
    ctx2.strokeRect(x1,y1,x2-x1,y1b-y1);
  } else if(s.tool==='circle'){
    const[x1,y1]=s.points[0],[x2,y2]=s.points[1];
    const cx=(x1+x2)/2,cy=(y1+y2)/2,rx=Math.abs(x2-x1)/2,ry=Math.abs(y2-y1)/2;
    ctx2.beginPath();ctx2.strokeStyle=s.color;ctx2.lineWidth=s.width;
    ctx2.ellipse(cx,cy,Math.max(rx,1),Math.max(ry,1),0,0,Math.PI*2);ctx2.stroke();
  } else if(s.tool==='line'){
    const[x1,y1]=s.points[0],[x2,y2]=s.points[1];
    ctx2.beginPath();ctx2.strokeStyle=s.color;ctx2.lineWidth=s.width;ctx2.lineCap='round';
    ctx2.moveTo(x1,y1);ctx2.lineTo(x2,y2);ctx2.stroke();
  } else if(s.tool==='arrow'){
    const[x1,y1]=s.points[0],[x2,y2]=s.points[1];
    ctx2.beginPath();ctx2.strokeStyle=s.color;ctx2.lineWidth=s.width;ctx2.lineCap='round';
    ctx2.moveTo(x1,y1);ctx2.lineTo(x2,y2);ctx2.stroke();
    const angle=Math.atan2(y2-y1,x2-x1);
    const headLen=Math.max(12,s.width*3);
    ctx2.beginPath();
    ctx2.moveTo(x2,y2);ctx2.lineTo(x2-headLen*Math.cos(angle-Math.PI/6),y2-headLen*Math.sin(angle-Math.PI/6));
    ctx2.moveTo(x2,y2);ctx2.lineTo(x2-headLen*Math.cos(angle+Math.PI/6),y2-headLen*Math.sin(angle+Math.PI/6));
    ctx2.stroke();
  }
}

function redraw(){
  ctx.fillStyle='#fffafc';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  for(const s of strokes)renderStroke(ctx,s);
}

async function submitDrawing(){
  if(!strokes.length)return alert('先画点什么吧！');
  const answerInput=$('draw-answer');
  const answer=answerInput?answerInput.value.trim():'';
  if(!answer)return alert('请输入答案！');
  const sx=1000/canvas.width, sy=700/canvas.height;
  const serverStrokes=strokes.map(s=>{
    const base={tool:s.tool,color:s.color,width:s.width};
    if(s.tool==='polyline'){
      base.points=s.points.map(p=>[Math.round(p[0]*sx),Math.round(p[1]*sy)]);
    } else {
      base.points=s.points.map(p=>[Math.round(p[0]*sx),Math.round(p[1]*sy)]);
    }
    return base;
  });
  const authorEl=$('draw-author');
  const author=authorEl?authorEl.value.trim()||'匿名':'匿名';
  serverStrokes.push({tool:'polyline',points:[[500,680],[500,680]],color:'#999',width:1,author:author});
  const r=await fetch('/api/draw',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:serverStrokes,answer:answer,aliases:[],author:author})});
  const d=await r.json();
  if(d.ok){
    alert('画作已提交！答案：'+answer);
    strokes=[];
    if(answerInput)answerInput.value='';
    initCanvas();
    switchMode('guess');
    loadStatus();
  }
}
function saveDrawing(){
  if(!strokes.length)return alert('先画点什么吧！');
  const tmpCanvas=document.createElement('canvas');
  tmpCanvas.width=canvas.width;tmpCanvas.height=canvas.height;
  const tmpCtx=tmpCanvas.getContext('2d');
  tmpCtx.fillStyle='#fffafc';tmpCtx.fillRect(0,0,tmpCanvas.width,tmpCanvas.height);
  tmpCtx.drawImage(canvas,0,0);
  const authorEl=$('draw-author');const author=authorEl?authorEl.value.trim()||'匿名':'匿名';
  const fontSize=Math.max(12,Math.round(canvas.width/40));
  tmpCtx.fillStyle='#999';tmpCtx.font=fontSize+'px sans-serif';tmpCtx.textAlign='right';
  tmpCtx.fillText('—— '+author,canvas.width-fontSize,canvas.height-fontSize);
  const link=document.createElement('a');
  link.download='你画我猜_'+author+'_'+new Date().toISOString().slice(0,10)+'.png';
  link.href=tmpCanvas.toDataURL('image/png');
  link.click();
}

async function addComment(drawingId) {
  const nameEl = document.getElementById('cmt-name-'+drawingId);
  const textEl = document.getElementById('cmt-text-'+drawingId);
  if (nameEl && !nameEl.value) nameEl.value = getPlayer();
  const author = nameEl ? nameEl.value.trim() : '';
  const text = textEl ? textEl.value.trim() : '';
  if (!author) return alert('请输入署名');
  if (!text) return alert('请输入评论');
  await fetch('/api/comment', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ drawing_id: drawingId, author, text, is_ai: false }) });
  if (textEl) textEl.value = '';
  // 不刷新，直接在页面上显示新评论
  location.reload();
}
</script>


</body>
</html>`;



// ===== 评论API =====
fastify.post('/api/comment', async (req) => {
  const { drawing_id, author, text, is_ai } = req.body || {};
  if (!drawing_id || !author || !text) return { ok: false, message: '需要 drawing_id, author, text' };
  const drawing = savedDrawings.find(d => d.id === drawing_id);
  if (!drawing) return { ok: false, message: '画作不存在' };
  if (!drawing.comments) drawing.comments = [];
  drawing.comments.push({ author, text, is_ai: !!is_ai, time: new Date().toISOString() });
  return { ok: true, comments: drawing.comments };
});

fastify.get('/api/comments/:id', async (req) => {
  const id = Number(req.params.id);
  const drawing = savedDrawings.find(d => d.id === id);
  if (!drawing) return { ok: false, message: '画作不存在' };
  return { ok: true, comments: drawing.comments || [] };
});

// ===== 画廊 API =====
// Redeploy trigger: b97bc460
fastify.get('/api/gallery', async () => {
  return { ok: true, drawings: savedDrawings.slice().reverse() };
});

fastify.get('/gallery', async (req, reply) => {
  const drawings = savedDrawings.slice().reverse();
  const cardsHtml = drawings.map((d, i) => {
    const label = d.artist === 'AI' ? '🤖 ' + (d.author || 'AI画师') : '✏️ ' + (d.author || '匿名');
    const answerHtml = d.answer ? '<div style="color:#87CEEB;font-size:13px;margin-top:4px">答案：' + d.answer + '</div>' : '';
    const descHtml = d.description ? '<div style="color:#999;font-size:11px;margin-top:4px;white-space:pre-line;max-height:60px;overflow:hidden">' + d.description.replace(/</g,'&lt;') + '</div>' : '';
    const commentsHtml = (d.comments || []).map(c => {
      const cLabel = c.is_ai ? '🤖 ' + c.author : '✏️ ' + c.author;
      return '<div style="margin:4px 0;padding:4px 8px;background:#0f3460;border-radius:6px;font-size:12px"><span style="color:#FFB6C1">' + cLabel + ':</span> ' + c.text.replace(/</g,'&lt;') + '</div>';
    }).join('');
    const commentForm = '<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap"><input id="cmt-name-'+d.id+'" placeholder="你的署名" style="width:70px;padding:6px;border-radius:6px;border:1px solid #444;background:#0f3460;color:#eee;font-size:12px"><input id="cmt-text-'+d.id+'" placeholder="写评论..." style="flex:1;min-width:100px;padding:6px;border-radius:6px;border:1px solid #444;background:#0f3460;color:#eee;font-size:12px"><button onclick="addComment('+d.id+')" style="padding:6px 12px;border-radius:6px;border:none;background:#e91e63;color:#fff;font-size:12px;cursor:pointer;font-weight:600">发送</button></div>';
    return '<div class="gallery-card">' +
      '<div class="drawing-preview">' + d.drawing_svg + '</div>' +
      '<div style="padding:8px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span style="color:#FFB6C1;font-weight:600">' + label + '</span>' +
          '<span style="color:#666;font-size:11px">' + (d.created_at || '').slice(0,16) + '</span>' +
        '</div>' +
        answerHtml + descHtml +
        (commentsHtml ? '<div style="margin-top:6px">' + commentsHtml + '</div>' : '') +
        commentForm +
      '</div>' +
    '</div>';
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>🎨 画廊</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1a2e;color:#eee;font-family:system-ui,sans-serif;min-height:100vh;padding:16px}
h1{text-align:center;color:#87CEEB;margin-bottom:16px;font-size:1.5em}
.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.gallery-card{background:#16213e;border-radius:12px;border:1px solid #2a2a4a;overflow:hidden}
.drawing-preview{background:#fffafc;padding:4px}
.drawing-preview svg{width:100%;height:auto;display:block}
.back-link{display:inline-block;color:#87CEEB;text-decoration:none;margin-bottom:12px;font-size:14px}
.back-link:hover{text-decoration:underline}
.empty{text-align:center;color:#999;padding:60px;font-size:16px}
</style>
</head>
<body class="theme-space">
</script>

<a href="/" class="back-link">← 返回游戏</a>
<h1>🎨 画廊</h1>
${drawings.length ? '<div class="gallery-grid">' + cardsHtml + '</div>' : '<div class="empty">还没有画作哦~<br>去画一幅吧！</div>'}


</body>
</html>`;
  reply.type('text/html; charset=utf-8');
  return html;
});

fastify.get('/', async (req, reply) => {
  reply.type('text/html; charset=utf-8');
  return FRONTEND;
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🎨 Draw & Guess running at http://localhost:${process.env.PORT || 3001}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
start();



// ===== MCP Endpoint (Streamable HTTP) =====
const MCP_GAME_URL = process.env.GAME_URL || 'https://web-production-54961.up.railway.app';

