// 把 zero-stack 构建好的组件产物同步到本主题的 assets/js/zero-comment.js（走资源管线加指纹）。
// 用法：node scripts/sync-comment.mjs [产物路径]
// 产物路径也可用环境变量 ZERO_COMMENT_DIST 指定；都不给时按常见目录顺序查找。
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const themeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(themeRoot, 'assets/js/zero-comment.js');

// 本仓库作为 zero-stack 的兄弟目录、或作为 git submodule 被引入时，路径深度不同，
// 因此逐个候选试一遍，而不是要求固定的目录结构。
const explicit = process.argv[2] || process.env.ZERO_COMMENT_DIST;
const autoCandidates = [
  resolve(themeRoot, '../zero-stack/packages/comment/dist/zero-comment.js'),
  resolve(themeRoot, '../../zero-stack/packages/comment/dist/zero-comment.js'),
  resolve(themeRoot, 'packages/comment/dist/zero-comment.js'),
];

const ok = (p) => existsSync(p) && statSync(p).size > 0;
let found;
if (explicit) {
  if (!ok(explicit)) {
    console.error(`指定的产物不存在或为空文件：${explicit}\n请先在 zero-stack 里执行 pnpm --filter zero-comment build`);
    process.exit(1);
  }
  found = explicit;
} else {
  found = autoCandidates.find(ok);
}

if (!found) {
  console.error(
    [
      '找不到 zero-comment 组件产物。请先在 zero-stack 仓库里构建，再重试：',
      '  pnpm install && pnpm --filter zero-comment build',
      '  node scripts/sync-comment.mjs',
      '',
      '或者直接指定产物位置：',
      '  node scripts/sync-comment.mjs D:/path/to/zero-comment.js',
      '  ZERO_COMMENT_DIST=D:/path/to/zero-comment.js node scripts/sync-comment.mjs',
      '',
      '已尝试：',
      ...autoCandidates.map((p) => '  - ' + p),
    ].join('\n')
  );
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(found, target);
console.log(`已同步组件产物 → ${target}`);
console.log(`来源：${found}（${statSync(target).size} 字节）`);
