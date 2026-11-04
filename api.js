/** Apps Script transport. URLSearchParams keeps cross-origin POST requests preflight-free. */
export function createApi(scriptUrl, fetchRequest = fetch) {
  async function request(parameters, method = 'GET') {
    if (!scriptUrl) throw new Error('Google Sheets 연결 주소를 확인해주세요.');

    const body = new URLSearchParams(parameters);
    const url = method === 'GET' ? `${scriptUrl}?${body}` : scriptUrl;
    const response = await fetchRequest(url, {
      method,
      ...(method === 'POST' ? { body } : {}),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error('서버 연결에 실패했습니다. 다시 시도해주세요.');

    const result = await response.json();
    if (!result.success) throw new Error(result.error || '요청에 실패했습니다.');
    return result;
  }

  return {
    async getAnswers(side) {
      const result = await request({ action: 'getAnswers', side });
      if (!Array.isArray(result.data)) throw new Error('답변 목록 형식을 확인해주세요.');
      return result.data;
    },
    addAnswer(side, answer) {
      return request({ action: 'addAnswer', side, ...answer }, 'POST');
    },
  };
}
