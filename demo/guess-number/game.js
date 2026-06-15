// 猜数字游戏 — living spec 实现 (v1.1.0)
// spec: spec/spec.feature (绑定见各函数 @spec 标注)

const MAX_ATTEMPTS = 7;

let target = 0;
let attempts = 0;

/**
 * 核对猜测，返回反馈文案。
 * @spec SC-001,SC-002,SC-003
 */
function checkGuess(guess, t) {
  if (guess === t) return '猜对了';
  if (guess < t) return '太小了';
  return '太大了';
}

/**
 * 是否超过猜测次数限制。
 * @spec SC-004
 */
function checkAttemptsExceeded(tries) {
  return tries >= MAX_ATTEMPTS;
}

function render() {
  document.getElementById('attempts').textContent = attempts > 0 ? `已猜 ${attempts} 次` : '';
}

function newGame() {
  const params = new URLSearchParams(location.search);
  const fixed = parseInt(params.get('target'), 10);
  target = (!isNaN(fixed) && fixed >= 1 && fixed <= 100)
    ? fixed
    : Math.floor(Math.random() * 100) + 1;
  attempts = 0;
  document.getElementById('feedback').textContent = '';
  document.getElementById('guessInput').value = '';
  render();
}

function handleGuess() {
  const input = document.getElementById('guessInput');
  const feedback = document.getElementById('feedback');
  const guess = parseInt(input.value, 10);
  if (isNaN(guess)) { feedback.textContent = '请输入 1-100 的数字'; return; }
  attempts += 1;
  const result = checkGuess(guess, target);
  if (result === '猜对了') {
    feedback.textContent = '猜对了！你赢了 🎉';
  } else if (checkAttemptsExceeded(attempts)) {
    feedback.textContent = '游戏失败，次数用尽';
  } else {
    feedback.textContent = result;
  }
  render();
}

document.getElementById('guessBtn').addEventListener('click', handleGuess);
document.getElementById('newGameBtn').addEventListener('click', newGame);
newGame();
