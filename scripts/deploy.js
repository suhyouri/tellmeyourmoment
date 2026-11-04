import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git('status', '--porcelain', '--', 'public/')) {
  throw new Error('public/ 변경 사항을 먼저 커밋해주세요. 배포는 커밋된 파일을 사용합니다.');
}
const commit = git('subtree', 'split', '--prefix', 'public', 'HEAD');
execFileSync('git', ['push', 'origin', `${commit}:refs/heads/gh-pages`], { stdio: 'inherit' });
console.log('배포 요청 완료: https://suhyouri.github.io/renderTest/');
