import { createApi } from './api.js';

const api = createApi(window.APP_CONFIG.scriptUrl);

function renderAnswers(container, answers) {
  const fragment = document.createDocumentFragment();
  for (const { answer, nickname } of answers) {
    const post = document.createElement('section');
    post.className = 'post';
    const content = document.createElement('div');
    content.className = 'answer';
    const text = document.createElement('p');
    text.textContent = answer;
    content.append(text);

    const footer = document.createElement('footer');
    footer.className = 'footer';
    const author = document.createElement('span');
    author.className = 'post__author';
    author.textContent = nickname;
    footer.append(author);
    post.append(content, footer);
    fragment.append(post);
  }
  container.replaceChildren(fragment);
}

function setupPanel(side) {
  const form = document.getElementById(`answer-form-${side}`);
  const container = document.getElementById(`answerbox_${side}`);
  const status = document.getElementById(`status-${side}`);
  const button = form.querySelector('button');
  let saving = false;
  let loading;
  let pending;

  // Share overlapping reads so an older response cannot overwrite a newer one.
  function load() {
    if (!loading) {
      loading = api.getAnswers(side)
        .then(answers => renderAnswers(container, answers))
        .finally(() => { loading = null; });
    }
    return loading;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    const nickname = form.elements.nickname.value.trim();
    const answer = form.elements.answer.value.trim();
    if (!nickname || !answer) {
      status.textContent = '닉네임과 답변을 입력해주세요.';
      return;
    }
    // Keep the same ID on retry if the previous response was lost.
    if (!pending || pending.nickname !== nickname || pending.answer !== answer) {
      pending = { nickname, answer, requestId: crypto.randomUUID() };
    }
    saving = true;
    button.disabled = true;
    status.textContent = '저장 중…';
    try {
      await api.addAnswer(side, { ...pending, hp_email: form.elements.hp_email.value });
      pending = null;
      form.reset();
      status.textContent = '저장했습니다.';
      try {
        if (loading) await loading.catch(() => {});
        await load();
      } catch {
        status.textContent = '저장했습니다. 목록은 잠시 후 갱신됩니다.';
      }
    } catch (error) {
      status.textContent = error.name === 'TimeoutError'
        ? '응답이 지연되고 있습니다. 다시 시도해주세요.'
        : error.message;
    } finally {
      saving = false;
      button.disabled = false;
    }
  });

  load().catch(error => { status.textContent = error.message; });
  return () => { if (!saving) load().catch(() => {}); };
}

const refreshPanels = ['left', 'right'].map(setupPanel);
setInterval(() => {
  if (!document.hidden) refreshPanels.forEach(refresh => refresh());
}, window.APP_CONFIG.refreshInterval);
