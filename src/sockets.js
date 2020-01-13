const socketIO = require('socket.io');

/** @type {string[]} */
let words = require('./webProgrammingTerms.json');

words = words.filter((word) => word.length >= 5).map((word) => word.toUpperCase());

const getRandomWord = () => words[Math.floor(Math.random() * words.length)];

/**
 * @param {string} word
 */
function createInitialGuess(word) {
  return word.replace(/[a-z0-9]/gi, '_').split('');
}

/**
 * @param {import('http').Server} server
 * @readonly void
 */
function init(server) {
  const teamTimeoutMS = 30000;
  const io = socketIO(server);

  const serverState = {
    currentWord: getRandomWord(),
  };

  console.log('CURRENT WORD', serverState.currentWord);

  const gameState = {
    guessedLetters: createInitialGuess(serverState.currentWord),
    currentTeam: 1,
    players: {},
    roundOver: false,
    teams: {
      1: {},
      2: {},
    },
    score: {
      1: 0,
      2: 0,
    },
    guessedLettersPoints: { // TODO: Change var name @lazynessmind;
      1: 0,
      2: 0,
    },
  };

  const emitGameState = () => io.emit('game-state', gameState);

  function gameEvent(event) {
    io.emit('game-event', event);
  }

  let teamTimeout = setTimeout(() => {
    gameEvent('Team timeout. Next turn.');
    nextTeam();
  }, teamTimeoutMS);

  function nextTeam() {
    if (teamTimeout) clearTimeout(teamTimeout);
    if (gameState.currentTeam == '1') {
      gameState.currentTeam = '2';
    } else {
      gameState.currentTeam = '1';
    }
    emitGameState();
    console.log(gameState);
    gameEvent(`Team ${gameState.currentTeam}'s turn.`);
    teamTimeout = setTimeout(() => {
      gameEvent('Team timeout. Next turn.');
      nextTeam();
    }, teamTimeoutMS);
  }

  /*
  * Check who score more letters then increase the score;
  * if draw: 5 points
  * else: 10 points to the winner
  * @lazynessmind
  */
  function addRoundPoints() {
    if (gameState.guessedLettersPoints[1] == gameState.guessedLettersPoints[2]) {
      gameState.score[1] += 5;
      gameState.score[2] += 5;
      gameEvent(`Both teams guessed ${gameState.guessedLettersPoints[1]} letters. Score increased by 5 points..`);
    } else if (gameState.guessedLettersPoints[1] > gameState.guessedLettersPoints[2]) {
      gameState.score[1] += 10;
      gameEvent(`Team 1 guessed ${gameState.guessedLettersPoints[1]} letters. Score increased by 10 points.`);
    } else {
      gameState.score[2] += 10;
      gameEvent(`Team 2 guessed ${gameState.guessedLettersPoints[2]} letters. Score increased by 10 points..`);
    }
    gameState.guessedLettersPoints[1] = 0;
    gameState.guessedLettersPoints[2] = 0;
  }

  io.on('connection', (socket) => {
    function getPlayer() {
      return gameState.players[socket.id];
    }

    /**
     * @param {string} errorText
     */
    function gameError(errorText) {
      socket.emit('game-error', errorText);
    }

    socket.on('game-state', (_, ack) => {
      ack(gameState);
    });

    socket.on('set-name', (settings) => {
      if (!settings) {
        return;
      }
      const { name } = settings;
      if (!name || typeof name !== 'string' || name.length > 25) {
        gameError('Name must be less than 25 characters. Refresh the page to try again.');
        return;
      }
      gameState.players[socket.id] = {
        name,
      };

      emitGameState();
    });

    socket.on('join-team', (settings) => {
      if (!settings) {
        return;
      }
      const { teamId } = settings;
      if (!teamId || (typeof teamId !== 'string' && typeof teamId !== 'number')) {
        gameError('Invalid team ID.');
        return;
      }

      if (teamId in gameState.teams === false) {
        gameError('Invalid team ID.');
        return;
      }
      const player = getPlayer();
      if (!player) {
        gameError('You must set your name before joining a team.');
        return;
      }
      if (player.teamId) {
        gameError(`You have already joined team ${player.teamId}.`);
        return;
      }
      console.log(player.name, 'joined team', teamId);
      gameState.teams[teamId][socket.id] = player;
      player.teamId = teamId;
      emitGameState();
    });

    socket.on('guess-letter', (settings) => {
      if (!settings) {
        return;
      }
      let { letter } = settings;
      if (typeof letter != 'string' || letter.length > 1 || !letter.match(/[a-z0-9]/i)) {
        gameError('Invalid letter. Your team loses a turn');
        nextTeam();
        return;
      }
      const player = getPlayer();
      if (!player) {
        gameError('You must set your name before guessing.');
        return;
      }
      if (!player.teamId) {
        gameError('You must join a team before guessing.');
        return;
      }
      if (player.teamId == gameState.currentTeam) {
        letter = letter.toUpperCase();
        if (
          serverState.currentWord.match(new RegExp(letter, 'gi'))
          && !gameState.guessedLetters.includes(letter)
        ) {
          serverState.currentWord.split('').forEach((wordLetter, i) => {
            if (wordLetter === letter) {
              gameState.guessedLetters[i] = letter;
            }
          });
          gameState.score[gameState.currentTeam] += 1;
          gameState.guessedLettersPoints[gameState.currentTeam] += 1;
          gameEvent(`Team ${player.teamId}: ${player.name} correct guess "${letter}" +1`);
        } else {
          gameState.score[gameState.currentTeam] -= 1;
          gameEvent(`Team ${player.teamId}: ${player.name} incorrect guess "${letter}" -1`);
        }

        if (gameState.guessedLetters.includes('_')) {
          nextTeam();
        } else {
          gameEvent('Round over. Next round will begin in 10 seconds.');
          gameState.roundOver = true;
          addRoundPoints();
          emitGameState();
          setTimeout(() => {
            serverState.currentWord = getRandomWord();
            console.log('CURRENT WORD', serverState.currentWord);
            gameState.guessedLetters = createInitialGuess(serverState.currentWord);
            gameState.roundOver = false;
            nextTeam();
          }, 10000);
        }
      }
    });

    socket.on('disconnect', () => {
      const player = getPlayer();
      if (!player) return;
      if (player.teamId) {
        delete gameState.teams[player.teamId][socket.id];
      }
      delete gameState.players[socket.id];
      emitGameState();
    });
  });
}

module.exports = init;
