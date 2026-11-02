// 把主题本体挂到 exampleSite/themes/zero，让 Hugo 能按标准方式找到它。
// 主题仓库本体就是根目录，而 Hugo 只在 <themesDir>/<themeName> 下找主题，
// 所以示例站必须多这一层链接。可重复执行。
import { lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:process';

const here = dirname(fileURLToPath(import.meta.url));
const themeRoot = resolve(here, '..');
const themesDir = join(themeRoot, 'exampleSite', 'themes');
const linkPath = join(themesDir, 'zero');

// 全新克隆时 exampleSite/themes 还不存在（它在 .gitignore 里）
mkdirSync(themesDir, { recursive: true });

// 已有的链接直接重建；真实的主题目录交回给人处理，脚本不删非空目录
let existing = null;
try {
  existing = lstatSync(linkPath);
} catch {}
if (existing?.isDirectory() && !existing.isSymbolicLink()) {
  console.error(`${linkPath} 是一个真实目录而不是链接，请先手动删除或移走再重试`);
  process.exit(1);
}
if (existing) rmSync(linkPath, { force: true });

try {
  // 目标相对于链接所在目录（exampleSite/themes）解析，故为两层 ..
  symlinkSync(join('..', '..'), linkPath, platform === 'win32' ? 'junction' : 'dir');
  console.log(`theme linked → ${linkPath}`);
} catch (err) {
  console.error('创建主题链接失败：', err.message);
  process.exit(1);
}
