import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git('status', '--porcelain', '--', 'public/')) {
  throw new Error('public/ 변경 사항을 먼저 커밋해주세요. 배포는 커밋된 파일을 사용합니다.');
}
const commit = git('subtree', 'split', '--prefix', 'public', 'HEAD');
execFileSync('git', ['push', 'origin', `${commit}:refs/heads/gh-pages`], { stdio: 'inherit' });
const remote = git('remote', 'get-url', 'origin');
const match = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
const siteUrl = match ? `https://${match[1]}.github.io/${match[2]}/` : remote;
console.log(`배포 요청 완료: ${siteUrl}`);
