/* eslint-env browser */
/* global io */
const socket = io();

const localState = {
  name: '',
  teamId: '',
};

const buttons = document.querySelectorAll('#pre-game button');
const preGame = document.querySelector('#pre-game');

function teamButtonClicked(button) {
  const { teamId } = button.dataset;
  localState.teamId = teamId;
  socket.emit('join-team', { teamId });
  preGame.classList.add('team-selected');
}

buttons.forEach((button) => {
  button.addEventListener('click', () => teamButtonClicked(button));
});

const team1List = document.querySelector('#team-1-list');
const team2List = document.querySelector('#team-2-list');
const team1score = document.querySelector('#team-1-score');
const team2score = document.querySelector('#team-2-score');
const letters = document.querySelector('#letters');
const guessing = document.querySelector('#guessing');
const guessInput = document.querySelector('#guess');
const submitGuessButton = document.querySelector('#submit-guess');

submitGuessButton.addEventListener('click', () => {
  if (guessInput.value) {
    socket.emit('guess-letter', { letter: guessInput.value.trim() });
    guessInput.value = '';
  }
});

function setName(name) {
  socket.emit('set-name', { name });
}

socket.on('connect', () => {
  if (!localState.name) {
    localState.name = prompt('What is your name?');
  }
  setName(localState.name);
  if (localState.teamId) {
    socket.emit('join-team', { teamId: localState.teamId });
  }

  socket.emit('game-state', '', (state) => {
    console.log(state);
  });
});

function updateTeamList(state, element, teamNumber) {
  element.innerHTML = '';
  Object.values(state.teams[teamNumber]).forEach((player) => {
    const playerElement = document.createElement('div');
    playerElement.textContent = player.name;
    element.appendChild(playerElement);
  });
}

function updateLetters(guessedLetters) {
  letters.innerHTML = '';
  guessedLetters.forEach((letter) => {
    const letterElement = document.createElement('div');
    letterElement.className = 'letter';
    letterElement.textContent = letter;
    letters.appendChild(letterElement);
  });
}

function allowCurrentTeamGuess(currentTeam, roundOver) {
  guessInput.value = '';
  if (roundOver) {
    guessing.style.display = 'none';
    return;
  }
  if (localState.teamId == currentTeam) {
    guessing.style.display = 'flex';
  } else {
    guessing.style.display = 'none';
  }
}

socket.on('game-state', (state) => {
  updateTeamList(state, team1List, 1);
  updateTeamList(state, team2List, 2);
  updateLetters(state.guessedLetters);
  allowCurrentTeamGuess(state.currentTeam, state.roundOver);
  team1score.textContent = state.score[1];
  team2score.textContent = state.score[2];
});

socket.on('game-error', (error) => {
  console.error(error);
});
